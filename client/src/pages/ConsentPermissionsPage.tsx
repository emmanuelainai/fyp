import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, CheckCircle2, Expand, ShieldCheck, XCircle } from "lucide-react";
import { examsApi, sessionsApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import type { Exam } from "../types";
import { analyzeFaceFrame, faceAnalysisLabel, faceAnalysisStartError, type FaceAnalysis } from "../utils/faceDetection";

const waitForVideoReady = async (video: HTMLVideoElement) => {
  if (video.readyState >= 2 && video.videoWidth > 0) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Camera preview did not become ready. Try allowing camera access again."));
    }, 8000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
  });
};

export const ConsentPermissionsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysis | null>(null);
  const [checkingFace, setCheckingFace] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    examsApi
      .get(id)
      .then((response) => setExam(response.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [id]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const requestCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
      await waitForVideoReady(videoRef.current);
    }
    setCameraGranted(true);
    return stream;
  }, []);

  const checkFace = useCallback(async () => {
    if (!videoRef.current) return null;
    setCheckingFace(true);
    try {
      await waitForVideoReady(videoRef.current);
      const analysis = await analyzeFaceFrame(videoRef.current);
      setFaceAnalysis(analysis);
      return analysis;
    } finally {
      setCheckingFace(false);
    }
  }, []);

  useEffect(() => {
    if (!cameraGranted) return;
    let active = true;
    const run = () => {
      checkFace()
        .then((analysis) => {
          if (!active || !analysis) return;
          setFaceAnalysis(analysis);
        })
        .catch((err) => {
          if (active) setError(apiErrorMessage(err));
        });
    };
    run();
    const interval = window.setInterval(run, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [cameraGranted, checkFace]);

  const requestFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    setFullscreenGranted(true);
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationGranted(result === "granted");
  };

  const start = async () => {
    if (!exam || !id) return;
    setError("");
    setLoading(true);
    try {
      if (!accepted) throw new Error("You must accept the consent statement before monitoring can start.");
      let nextCameraGranted = cameraGranted;
      let nextFullscreenGranted = fullscreenGranted;
      if (exam.settings.requireWebcam !== false && !nextCameraGranted) {
        await requestCamera();
        nextCameraGranted = true;
      }
      if (exam.settings.requireWebcam !== false && exam.settings.enableFacePresence !== false) {
        const analysis = await checkFace();
        if (!analysis || analysis.status !== "present") {
          throw new Error(faceAnalysisStartError(analysis ?? { status: "waiting", faceCount: 0, detector: "quality", detail: "Waiting for the camera frame" }));
        }
      }
      if (exam.settings.requireFullscreen !== false && !nextFullscreenGranted) {
        await requestFullscreen();
        nextFullscreenGranted = true;
      }

      const response = await sessionsApi.start({
        examId: id,
        consentAccepted: true,
        permissions: { cameraGranted: nextCameraGranted, fullscreenGranted: nextFullscreenGranted, notificationGranted },
        deviceInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          screen: { width: window.screen.width, height: window.screen.height }
        }
      });
      navigate(`/sessions/${response.data.session.id}/exam`, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!exam) return <div className="text-slate-600">Loading consent screen...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Consent and permissions</h1>
        <p className="mt-1 text-sm text-slate-500">{exam.title}</p>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 text-blue-700" />
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Monitoring notice</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              <li>Webcam access is required when this exam requires camera monitoring.</li>
              <li>Tab switching, fullscreen exit, copy/paste attempts, page visibility changes, and focus changes will be logged.</li>
              <li>Screenshots or webcam frame evidence may be captured only during the active exam session.</li>
              <li>Monitoring data is used only for academic integrity review.</li>
              <li>You can cancel if you do not agree. Monitoring will not start before consent and permissions are granted.</li>
            </ul>
            <label className="mt-5 flex items-start gap-3 rounded-md border border-slate-200 p-3">
              <input className="mt-1 h-4 w-4" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span className="text-sm font-medium text-slate-800">I understand and consent to ExamSentinel monitoring during this exam session.</span>
            </label>
          </div>
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <button className="focus-ring rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50" onClick={() => requestCamera().catch((err) => setError(apiErrorMessage(err)))}>
          <Camera className="h-5 w-5 text-blue-700" />
          <p className="mt-3 font-medium text-slate-900">Camera</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
            {cameraGranted ? <CheckCircle2 className="h-4 w-4 text-green-700" /> : <XCircle className="h-4 w-4 text-slate-400" />}
            {cameraGranted ? "Granted" : "Request access"}
          </p>
        </button>
        <button className="focus-ring rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50" onClick={() => requestFullscreen().catch((err) => setError(apiErrorMessage(err)))}>
          <Expand className="h-5 w-5 text-teal-700" />
          <p className="mt-3 font-medium text-slate-900">Fullscreen</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
            {fullscreenGranted ? <CheckCircle2 className="h-4 w-4 text-green-700" /> : <XCircle className="h-4 w-4 text-slate-400" />}
            {fullscreenGranted ? "Active" : "Enter fullscreen"}
          </p>
        </button>
        <button className="focus-ring rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50" onClick={() => requestNotifications().catch((err) => setError(apiErrorMessage(err)))}>
          <ShieldCheck className="h-5 w-5 text-orange-700" />
          <p className="mt-3 font-medium text-slate-900">Notifications</p>
          <p className="mt-1 text-sm text-slate-600">{notificationGranted ? "Granted" : "Optional"}</p>
        </button>
      </section>
      {exam.settings.requireWebcam !== false && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
            <video ref={videoRef} className="aspect-video w-full rounded-md bg-slate-950 object-cover" style={{ transform: "scaleX(-1)" }} autoPlay muted playsInline />
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Face check</h2>
              <p className="mt-1 text-sm text-slate-600">Your face must be visible before the exam starts. Dark or unclear camera frames are blocked.</p>
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{faceAnalysis ? faceAnalysisLabel(faceAnalysis) : cameraGranted ? "Checking camera" : "Camera not started"}</p>
                <p className="mt-1">{faceAnalysis?.detail ?? "Request camera access to run the pre-exam face check."}</p>
                {faceAnalysis && (
                  <p className="mt-1 text-xs text-slate-500">
                    Detector: {faceAnalysis.detector === "mediapipe" ? "MediaPipe face detector" : faceAnalysis.detector === "native" ? "browser face detector" : "camera quality check"}
                  </p>
                )}
              </div>
              <button
                className="focus-ring mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                type="button"
                onClick={() => {
                  (cameraGranted ? checkFace() : requestCamera().then(() => checkFace())).catch((err) => setError(apiErrorMessage(err)));
                }}
                disabled={checkingFace}
              >
                {checkingFace ? "Checking..." : "Run face check"}
              </button>
            </div>
          </div>
        </section>
      )}
      <div className="flex gap-3">
        <button
          className="focus-ring rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          onClick={start}
          disabled={loading || !accepted || checkingFace}
        >
          {loading ? "Starting..." : "Start monitored exam"}
        </button>
        <button className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => navigate("/student")}>
          Cancel
        </button>
      </div>
    </div>
  );
};
