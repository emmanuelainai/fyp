import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Camera, CheckCircle2, Send, ShieldAlert } from "lucide-react";
import { monitoringApi, sessionsApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import { RiskBadge } from "../components/RiskBadge";
import { useSocket } from "../hooks/useSocket";
import type { ExamQuestion, ExamSession, Report } from "../types";
import { analyzeFaceFrame, faceAnalysisLabel, resetFaceDetector, type FaceAnalysis } from "../utils/faceDetection";

type PresenceStatus = {
  label: string;
  detail: string;
  mode: FaceAnalysis["detector"];
  faces: number;
};

const eventMessages: Record<string, string> = {
  TAB_SWITCH: "Student moved away from the exam tab",
  WINDOW_BLUR: "Exam window lost focus",
  WINDOW_FOCUS: "Exam window regained focus",
  FULLSCREEN_EXIT: "Student exited fullscreen mode",
  FULLSCREEN_ENTER: "Student entered fullscreen mode",
  COPY_ATTEMPT: "Copy attempt detected inside the exam page",
  PASTE_ATTEMPT: "Paste attempt detected inside the exam page",
  RIGHT_CLICK: "Right-click attempt detected inside the exam page",
  FACE_MISSING: "Webcam presence signal could not verify a face or clear presence",
  FACE_PRESENT: "Webcam presence signal is clear",
  MULTIPLE_FACES: "Multiple faces detected in the webcam frame"
};

const mergeSessionUpdate = (current: ExamSession | null, updated: ExamSession): ExamSession => {
  if (!current) return updated;
  const currentQuestions = current.exam?.questions ?? [];
  const updatedQuestions = updated.exam?.questions ?? [];
  return {
    ...current,
    ...updated,
    exam: {
      ...current.exam,
      ...updated.exam,
      questions: updatedQuestions.length ? updatedQuestions : currentQuestions
    }
  };
};

export const ExamMonitoringPage = () => {
  const { id } = useParams();
  const socket = useSocket();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSentRef = useRef<Record<string, number>>({});
  const answersRef = useRef<Record<string, string>>({});
  const submittedRef = useRef(false);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>({
    label: "Starting",
    detail: "Waiting for webcam",
    mode: "quality",
    faces: 0
  });
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submittedReport, setSubmittedReport] = useState<Report | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!id) return;
    sessionsApi
      .get(id)
      .then((response) => {
        setSession(response.data);
        setExamQuestions(response.data.exam.questions ?? []);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [id]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!socket || !id || !session) return;
    socket.emit("session:join", { sessionId: id });
    const heartbeat = window.setInterval(() => socket.emit("session:heartbeat", { sessionId: id }), 10_000);
    const updateSession = (updated: ExamSession) => setSession((current) => (current?.id === updated.id ? mergeSessionUpdate(current, updated) : current));
    const onSessionEnded = ({ session: ended }: { session: ExamSession }) => updateSession(ended);
    socket.on("risk:updated", updateSession);
    socket.on("session:ended", onSessionEnded);
    return () => {
      window.clearInterval(heartbeat);
      socket.off("risk:updated", updateSession);
      socket.off("session:ended", onSessionEnded);
    };
  }, [id, session, socket]);

  const submitEvent = useCallback(
    async (eventType: string, severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", metadata?: Record<string, unknown>) => {
      if (!id) return;
      const now = Date.now();
      const throttleMs = eventType === "FACE_PRESENT" ? 30_000 : eventType === "FACE_MISSING" || eventType === "MULTIPLE_FACES" ? 10_000 : 5_000;
      if (lastSentRef.current[eventType] && now - lastSentRef.current[eventType] < throttleMs) return;
      lastSentRef.current[eventType] = now;
      try {
        const response = await monitoringApi.submitEvent(id, {
          eventType,
          severity,
          message: eventMessages[eventType] ?? eventType,
          metadata
        });
        setSession((current) => mergeSessionUpdate(current, response.data.session));
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    },
    [id]
  );

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      })
      .catch((err) => {
        setError(apiErrorMessage(err));
        void submitEvent("PERMISSION_DENIED", "HIGH", { permission: "camera" });
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [submitEvent]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void submitEvent("TAB_SWITCH", "MEDIUM", { visibilityState: document.visibilityState });
      }
    };
    const onBlur = () => void submitEvent("WINDOW_BLUR", "LOW");
    const onFocus = () => void submitEvent("WINDOW_FOCUS", "INFO");
    const onFullscreen = () => {
      if (document.fullscreenElement) {
        void submitEvent("FULLSCREEN_ENTER", "INFO");
      } else {
        void submitEvent("FULLSCREEN_EXIT", "MEDIUM");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [submitEvent]);

  useEffect(() => {
    if (!cameraReady) return;
    let analyzing = false;

    const interval = window.setInterval(async () => {
      if (analyzing) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      analyzing = true;

      try {
        const analysis = await analyzeFaceFrame(video);
        setPresenceStatus({
          label: faceAnalysisLabel(analysis),
          detail: analysis.detail,
          mode: analysis.detector,
          faces: analysis.faceCount
        });

        const metadata = {
          faceCount: analysis.faceCount,
          detector: analysis.detector,
          averageLuminance: analysis.averageLuminance,
          contrast: analysis.contrast,
          confidence: analysis.confidence
        };

        if (analysis.status === "multiple") {
          void submitEvent("MULTIPLE_FACES", "HIGH", metadata);
        } else if (analysis.status === "present") {
          void submitEvent("FACE_PRESENT", "INFO", metadata);
        } else if (analysis.status === "missing" || analysis.status === "poor_lighting") {
          void submitEvent("FACE_MISSING", "MEDIUM", metadata);
        } else if (analysis.status === "detector_unavailable") {
          void submitEvent("SYSTEM_WARNING", "LOW", metadata);
        }
      } catch (err) {
        resetFaceDetector();
        setPresenceStatus({ label: "Detector restarting", detail: "Face detector could not analyze this frame", mode: "quality", faces: 0 });
      } finally {
        analyzing = false;
      }
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [cameraReady, submitEvent]);

  const uploadFrame = useCallback(async () => {
    if (!id || !videoRef.current || videoRef.current.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return;
    const form = new FormData();
    form.append("file", blob, `webcam-frame-${Date.now()}.jpg`);
    form.append("type", "WEBCAM_FRAME");
    form.append("metadata", JSON.stringify({ capturedFrom: "browser-video-frame" }));
    await monitoringApi.uploadEvidence(id, form);
  }, [id]);

  useEffect(() => {
    if (!session || import.meta.env.VITE_ENABLE_SCREENSHOTS === "false") return;
    const seconds = session.exam.settings.screenshotIntervalSeconds ?? 60;
    const interval = window.setInterval(() => {
      uploadFrame().catch((err) => setError(apiErrorMessage(err)));
    }, Math.max(seconds, 15) * 1000);
    return () => window.clearInterval(interval);
  }, [session, uploadFrame]);

  const finish = useCallback(async () => {
    if (!id || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await sessionsApi.end(id, answersRef.current);
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setSubmittedReport(response.data.report);
      setSession((current) => mergeSessionUpdate(current, response.data.session));
    } catch (err) {
      submittedRef.current = false;
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [id]);

  useEffect(() => {
    if (!session || submittedReport) return;
    const calculateRemaining = () => {
      const startedAt = new Date(session.startedAt).getTime();
      const durationMs = session.exam.durationMinutes * 60_000;
      return Math.max(0, Math.ceil((startedAt + durationMs - Date.now()) / 1000));
    };
    setRemainingSeconds(calculateRemaining());
    const interval = window.setInterval(() => {
      const nextRemaining = calculateRemaining();
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0) {
        window.clearInterval(interval);
        void finish();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [finish, session?.exam.durationMinutes, session?.startedAt, submittedReport]);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        <button className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setError("")}>
          Dismiss
        </button>
      </div>
    );
  }
  if (!session) return <div className="text-slate-600">Loading monitored exam...</div>;
  const questions = examQuestions.length
    ? examQuestions
    : session.exam.questions?.length
      ? session.exam.questions
    : [
        {
          id: "fallback-question",
          examId: session.examId,
          prompt: "Answer the exam question provided by your examiner.",
          type: "SHORT_TEXT" as const,
          options: null,
          correctOptionIndex: null,
          points: 1,
          order: 1,
          createdAt: "",
          updatedAt: ""
        }
      ];
  const safeQuestionIndex = Math.min(currentQuestionIndex, questions.length - 1);
  const currentQuestion = questions[safeQuestionIndex];
  const formatRemaining = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  };

  if (submittedReport) {
    const grading = submittedReport.reportJson.grading;
    const hasWritten = grading?.details.some((detail) => detail.type === "SHORT_TEXT") ?? false;
    const canShowScore = !hasWritten || Boolean(grading?.isFullyGraded);
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Exam submitted</h1>
          <p className="mt-1 text-sm text-slate-500">{canShowScore ? "Your exam score is ready." : "Your submission is waiting for examiner grading."}</p>
        </div>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Score</p>
              {canShowScore ? (
                <>
                  <p className="mt-1 text-3xl font-semibold text-slate-950">
                    {grading?.earnedPoints ?? 0}/{grading?.totalPoints ?? grading?.autoGradedPoints ?? 0}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {grading?.percentage ?? 0}% · {grading?.correctCount ?? 0} of {grading?.totalAutoGraded ?? 0} multiple-choice questions correct
                  </p>
                </>
              ) : (
                <p className="mt-1 text-lg font-semibold text-slate-950">Pending examiner grading</p>
              )}
            </div>
            <button className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setShowDetails((value) => !value)}>
              {showDetails ? "Hide details" : "See details"}
            </button>
          </div>
          {showDetails && (
            <div className="mt-5 space-y-3">
              {(grading?.details ?? []).map((detail) => (
                <div className="rounded-md border border-slate-200 p-4" key={detail.questionId}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-950">Question {detail.order}</p>
                      <p className="mt-1 text-sm text-slate-600">{detail.prompt}</p>
                    </div>
                    {detail.type === "MULTIPLE_CHOICE" && (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${detail.isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {detail.isCorrect ? "Correct" : "Wrong"}
                      </span>
                    )}
                  </div>
                  {detail.type === "MULTIPLE_CHOICE" ? (
                    <div className="mt-3 space-y-2">
                      {detail.options.map((option, optionIndex) => {
                        const isPicked = detail.selectedOptionIndex === optionIndex;
                        const isCorrect = canShowScore && detail.correctOptionIndex === optionIndex;
                        return (
                          <div
                            className={`rounded-md border px-3 py-2 text-sm ${
                              isCorrect ? "border-green-300 bg-green-50 text-green-900" : isPicked ? "border-red-300 bg-red-50 text-red-900" : "border-slate-200 text-slate-600"
                            }`}
                            key={optionIndex}
                          >
                            {option}
                            {isPicked && <span className="ml-2 font-semibold">Your answer</span>}
                            {isCorrect && <span className="ml-2 font-semibold">Correct answer</span>}
                          </div>
                        );
                      })}
                      {detail.selectedOptionIndex === null && <p className="text-sm font-semibold text-red-700">No answer selected</p>}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Written answer saved for examiner review.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        <Link className="focus-ring inline-flex rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" to="/student">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div
      className="space-y-5"
      onCopy={(event) => {
        event.preventDefault();
        void submitEvent("COPY_ATTEMPT", "LOW");
      }}
      onPaste={(event) => {
        event.preventDefault();
        void submitEvent("PASTE_ATTEMPT", "LOW");
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        void submitEvent("RIGHT_CLICK", "LOW");
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{session.exam.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Monitoring is active only in this exam session.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${remainingSeconds !== null && remainingSeconds <= 60 ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-800"}`}>
            Time {formatRemaining(remainingSeconds)}
          </span>
          <RiskBadge level={session.riskLevel} />
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800">Risk {Math.round(session.riskScore)}/100</span>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4" />
              Exam workspace
            </div>
            <p className="mt-1">Copy, paste, right-click, tab switching, visibility changes, and fullscreen exits are logged during this active session.</p>
          </div>
          <div className="space-y-5">
              <div className="block" key={currentQuestion.id}>
                <p className="font-medium text-slate-900">
                  Question {safeQuestionIndex + 1} of {questions.length}
                  <span className="ml-2 text-xs font-normal text-slate-500">{currentQuestion.points} point{currentQuestion.points === 1 ? "" : "s"}</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">{currentQuestion.prompt}</p>
                {currentQuestion.type === "MULTIPLE_CHOICE" ? (
                  <div className="mt-3 space-y-2">
                    {(currentQuestion.options ?? []).map((option, optionIndex) => (
                      <label className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" key={`${currentQuestion.id}-${optionIndex}`}>
                        <input
                          className="mt-0.5 h-4 w-4"
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          checked={answers[currentQuestion.id] === String(optionIndex)}
                          onChange={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: String(optionIndex) }))}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="focus-ring mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2"
                    value={answers[currentQuestion.id] ?? ""}
                    onChange={(event) => setAnswers((current) => ({ ...current, [currentQuestion.id]: event.target.value }))}
                  />
                )}
              </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <button
              className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}
              disabled={safeQuestionIndex === 0}
            >
              Previous
            </button>
            <button
              className="focus-ring rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setCurrentQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}
              disabled={safeQuestionIndex >= questions.length - 1}
            >
              Next
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-950">Webcam</p>
              <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
                {cameraReady ? <CheckCircle2 className="h-4 w-4 text-green-700" /> : <Camera className="h-4 w-4 text-slate-400" />}
                {cameraReady ? "Active" : "Starting"}
              </span>
            </div>
            <video ref={videoRef} className="mt-3 aspect-video w-full rounded-md bg-slate-950 object-cover" style={{ transform: "scaleX(-1)" }} autoPlay muted playsInline />
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{presenceStatus.label}</p>
              <p className="mt-0.5">{presenceStatus.detail}</p>
              <p className="mt-0.5">
                Detector: {presenceStatus.mode === "mediapipe" ? "MediaPipe face detector" : presenceStatus.mode === "native" ? "browser face detector" : "camera quality check"}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <p className="font-semibold text-slate-950">Session counters</p>
            <dl className="mt-3 space-y-2 text-slate-600">
              <div className="flex justify-between">
                <dt>Tab switches</dt>
                <dd className="font-semibold text-slate-900">{session.tabSwitchCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Fullscreen exits</dt>
                <dd className="font-semibold text-slate-900">{session.fullscreenExitCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Copy/paste</dt>
                <dd className="font-semibold text-slate-900">{session.copyPasteCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Presence misses</dt>
                <dd className="font-semibold text-slate-900">{session.faceMissingCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Multiple faces</dt>
                <dd className="font-semibold text-slate-900">{session.multipleFaceCount}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>
      <div className="sticky bottom-0 z-20 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              Question {safeQuestionIndex + 1} of {questions.length}
            </span>
            <span className="mx-2 text-slate-300">|</span>
            <span>Time {formatRemaining(remainingSeconds)}</span>
          </div>
          <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50" onClick={finish} disabled={submitting}>
            <Send className="h-4 w-4" />
            {submitting ? "Submitting..." : "Submit exam"}
          </button>
        </div>
      </div>
    </div>
  );
};
