import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, ClipboardList, Plus, Users } from "lucide-react";
import { dashboardApi, examsApi, sessionsApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import { RiskBadge, SeverityBadge } from "../components/RiskBadge";
import { StatCard } from "../components/StatCard";
import { useSocket } from "../hooks/useSocket";
import type { Alert, DashboardOverview, Exam, ExamSession } from "../types";
import { departments } from "../utils/departments";
import { formatDateTime } from "../utils/time";

type QuestionDraft = {
  prompt: string;
  type: "SHORT_TEXT" | "MULTIPLE_CHOICE";
  options: string[];
  correctOptionIndex: number;
  points: number;
};

const newQuestion = (): QuestionDraft => ({
  prompt: "",
  type: "SHORT_TEXT",
  options: ["", ""],
  correctOptionIndex: 0,
  points: 1
});

const defaultExamForm = () => {
  const start = new Date(Date.now() - 5 * 60 * 1000);
  const end = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    durationMinutes: 60,
    startTime: start.toISOString().slice(0, 16),
    endTime: end.toISOString().slice(0, 16),
    questions: [newQuestion()]
  };
};

const examToEditableForm = (exam: Exam) => ({
  title: exam.title,
  description: exam.description ?? "",
  durationMinutes: exam.durationMinutes,
  startTime: new Date(exam.startTime).toISOString().slice(0, 16),
  endTime: new Date(exam.endTime).toISOString().slice(0, 16),
  status: exam.status
});

const defaultManageForm = () => ({
  title: "",
  description: "",
  durationMinutes: 60,
  startTime: new Date().toISOString().slice(0, 16),
  endTime: new Date(Date.now() + 3600_000).toISOString().slice(0, 16),
  status: "ACTIVE" as Exam["status"]
});

export const ExaminerDashboardPage = () => {
  const socket = useSocket();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [form, setForm] = useState(defaultExamForm);
  const [assignExamId, setAssignExamId] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"department" | "matric">("department");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [studentMatricNumber, setStudentMatricNumber] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState("");
  const [manageExamId, setManageExamId] = useState("");
  const [manageForm, setManageForm] = useState(defaultManageForm);
  const [updatingExam, setUpdatingExam] = useState(false);
  const [deletingExam, setDeletingExam] = useState(false);
  const [manageMessage, setManageMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    Promise.all([dashboardApi.overview(), sessionsApi.list(), examsApi.list()])
      .then(([overviewResponse, sessionsResponse, examsResponse]) => {
        setOverview(overviewResponse.data);
        setSessions(sessionsResponse.data);
        setExams(examsResponse.data);
        setAssignExamId((current) => current || examsResponse.data[0]?.id || "");
        setManageExamId((current) => current || examsResponse.data[0]?.id || "");
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    const onStarted = (session: ExamSession) => setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
    const onRisk = (session: ExamSession) => setSessions((current) => current.map((item) => (item.id === session.id ? { ...item, ...session } : item)));
    const onEnded = ({ session }: { session: ExamSession }) => onRisk(session);
    const onAlert = (alert: Alert) => {
      setOverview((current) =>
        current
          ? {
              ...current,
              totalAlerts: current.totalAlerts + 1,
              recentAlerts: [alert, ...current.recentAlerts].slice(0, 10)
            }
          : current
      );
    };
    socket.on("session:started", onStarted);
    socket.on("risk:updated", onRisk);
    socket.on("session:ended", onEnded);
    socket.on("alert:new", onAlert);
    return () => {
      socket.off("session:started", onStarted);
      socket.off("risk:updated", onRisk);
      socket.off("session:ended", onEnded);
      socket.off("alert:new", onAlert);
    };
  }, [socket]);

  const activeSessions = useMemo(() => sessions.filter((session) => session.status === "ACTIVE"), [sessions]);
  const managedExam = useMemo(() => exams.find((exam) => exam.id === manageExamId), [exams, manageExamId]);

  useEffect(() => {
    if (managedExam) setManageForm(examToEditableForm(managedExam));
  }, [managedExam]);

  const createExam = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const startTime = new Date(form.startTime);
      const endTime = new Date(form.endTime);
      const questions = form.questions
        .filter((question) => question.prompt.trim())
        .map((question) => {
          const optionEntries = question.options.map((option, optionIndex) => ({ text: option.trim(), originalIndex: optionIndex })).filter((option) => option.text);
          const correctOptionIndex = optionEntries.findIndex((option) => option.originalIndex === question.correctOptionIndex);

          return {
            prompt: question.prompt.trim(),
            type: question.type,
            options: question.type === "MULTIPLE_CHOICE" ? optionEntries.map((option) => option.text) : undefined,
            correctOptionIndex: question.type === "MULTIPLE_CHOICE" ? Math.max(correctOptionIndex, 0) : undefined,
            points: Number(question.points) || 1
          };
        });

      if (form.title.trim().length < 3) {
        setError("Exam title must be at least 3 characters.");
        return;
      }
      if (!Number.isInteger(Number(form.durationMinutes)) || Number(form.durationMinutes) < 1) {
        setError("Exam duration must be at least 1 minute.");
        return;
      }
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
        setError("Exam end time must be after the start time.");
        return;
      }
      if (!questions.length) {
        setError("Create at least one question before creating the exam.");
        return;
      }
      const incompleteMultipleChoice = questions.find((question) => question.type === "MULTIPLE_CHOICE" && (!question.options || question.options.length < 2));
      if (incompleteMultipleChoice) {
        setError("Multiple choice questions need at least two filled options.");
        return;
      }

      const response = await examsApi.create({
        title: form.title,
        description: form.description.trim() || undefined,
        durationMinutes: Number(form.durationMinutes),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: "ACTIVE",
        questions,
        settings: {
          requireWebcam: true,
          requireFullscreen: true,
          allowTabSwitches: false,
          maxTabSwitches: 3,
          screenshotIntervalSeconds: 60,
          enableFacePresence: true,
          enableMultipleFaceDetection: true,
          enableAudioMonitoring: false
        }
      });
      setAssignExamId(response.data.id);
      setForm(defaultExamForm());
      refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const assignStudent = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setAssignMessage("");
    setAssigning(true);
    try {
      const response = await examsApi.assign(assignExamId, assignmentMode === "department" ? { departments: [selectedDepartment] } : { matricNumbers: [studentMatricNumber] });
      const assignmentCount = Array.isArray(response.data) ? response.data.length : 0;
      setAssignMessage(`Assignment saved. ${assignmentCount} student${assignmentCount === 1 ? "" : "s"} currently assigned to this exam.`);
      setSelectedDepartment("");
      setStudentMatricNumber("");
      refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAssigning(false);
    }
  };

  const updateManagedExam = async (event: FormEvent) => {
    event.preventDefault();
    if (!manageExamId) return;
    setError("");
    setManageMessage("");
    setUpdatingExam(true);
    try {
      const startTime = new Date(manageForm.startTime);
      const endTime = new Date(manageForm.endTime);
      if (manageForm.title.trim().length < 3) {
        setError("Exam title must be at least 3 characters.");
        return;
      }
      if (!Number.isInteger(Number(manageForm.durationMinutes)) || Number(manageForm.durationMinutes) < 1) {
        setError("Exam duration must be at least 1 minute.");
        return;
      }
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
        setError("Exam end time must be after the start time.");
        return;
      }
      await examsApi.update(manageExamId, {
        title: manageForm.title.trim(),
        description: manageForm.description.trim() || undefined,
        durationMinutes: Number(manageForm.durationMinutes),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: manageForm.status
      });
      setManageMessage("Exam updated.");
      refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUpdatingExam(false);
    }
  };

  const deleteManagedExam = async () => {
    if (!manageExamId || !window.confirm("Delete this exam? This cannot be undone.")) return;
    setError("");
    setManageMessage("");
    setDeletingExam(true);
    try {
      const deletedId = manageExamId;
      await examsApi.remove(manageExamId);
      setManageMessage("Exam deleted.");
      setAssignExamId((current) => (current === deletedId ? "" : current));
      setManageExamId("");
      setManageForm(defaultManageForm());
      refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDeletingExam(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Examiner dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Monitor active sessions, risk changes, and alerts in real time.</p>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active sessions" value={overview?.activeSessions ?? 0} icon={Activity} accent="text-blue-700" />
        <StatCard label="Total alerts" value={overview?.totalAlerts ?? 0} icon={AlertTriangle} accent="text-orange-700" />
        <StatCard label="High risk" value={overview?.highRiskSessions ?? 0} icon={ShieldIcon} accent="text-red-700" />
        <StatCard label="Completed" value={overview?.completedSessions ?? 0} icon={CheckCircle2} accent="text-teal-700" />
        <StatCard label="Avg. risk" value={Math.round(overview?.averageRiskScore ?? 0)} icon={ClipboardList} accent="text-slate-700" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Live sessions</h2>
            <span className="text-sm text-slate-500">{activeSessions.length} active</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Exam</th>
                  <th className="py-2 pr-4 font-medium">Risk</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900">{session.student.name}</p>
                      <p className="text-xs text-slate-500">{session.student.matricNumber ?? "No matric number"}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{session.exam.title}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <RiskBadge level={session.riskLevel} />
                        <span className="text-slate-600">{Math.round(session.riskScore)}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{session.status}</td>
                    <td className="py-3">
                      <Link className="font-medium text-blue-700 hover:text-blue-800" to={`/sessions/${session.id}/live`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-5">
          <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={createExam}>
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-700" />
              <h2 className="text-lg font-semibold text-slate-950">Create exam</h2>
            </div>
            <div className="mt-4 space-y-3">
              <input className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Exam title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
              <textarea className="focus-ring min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              <input className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="number" min={1} value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} />
              <input className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="datetime-local" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} />
              <input className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="datetime-local" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} />
              <div className="space-y-2 rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Questions</p>
                  <button
                    className="focus-ring rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, questions: [...current.questions, newQuestion()] }))}
                  >
                    Add
                  </button>
                </div>
                {form.questions.map((question, index) => (
                  <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3" key={index}>
                    <textarea
                      className="focus-ring min-h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder={`Question ${index + 1}`}
                      value={question.prompt}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          questions: current.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, prompt: event.target.value } : item))
                        }))
                      }
                      required={index === 0}
                    />
                    <div className="flex gap-2">
                      <select
                        className="focus-ring min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={question.type}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            questions: current.questions.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, type: event.target.value as QuestionDraft["type"], correctOptionIndex: 0 } : item
                            )
                          }))
                        }
                        aria-label={`Question ${index + 1} type`}
                      >
                        <option value="SHORT_TEXT">Short answer</option>
                        <option value="MULTIPLE_CHOICE">Multiple choice</option>
                      </select>
                      <input
                        className="focus-ring w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        type="number"
                        min={1}
                        max={100}
                        value={question.points}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            questions: current.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, points: Number(event.target.value) } : item))
                          }))
                        }
                        aria-label={`Question ${index + 1} points`}
                      />
                    </div>
                    {question.type === "MULTIPLE_CHOICE" && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Options</p>
                        {question.options.map((option, optionIndex) => (
                          <div className="flex items-center gap-2" key={optionIndex}>
                            <input
                              className="focus-ring min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                              placeholder={`Option ${optionIndex + 1}`}
                              value={option}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  questions: current.questions.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          options: item.options.map((currentOption, currentOptionIndex) =>
                                            currentOptionIndex === optionIndex ? event.target.value : currentOption
                                          )
                                        }
                                      : item
                                  )
                                }))
                              }
                              required={question.type === "MULTIPLE_CHOICE"}
                            />
                            {question.options.length > 2 && (
                              <button
                                className="focus-ring rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                                type="button"
                                onClick={() =>
                                  setForm((current) => ({
                                    ...current,
                                    questions: current.questions.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            options: item.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex),
                                            correctOptionIndex:
                                              item.correctOptionIndex === optionIndex
                                                ? 0
                                                : item.correctOptionIndex > optionIndex
                                                  ? item.correctOptionIndex - 1
                                                  : Math.min(item.correctOptionIndex, item.options.length - 2)
                                          }
                                        : item
                                    )
                                  }))
                                }
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correct answer</span>
                          <select
                            className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                            value={question.correctOptionIndex}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                questions: current.questions.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, correctOptionIndex: Number(event.target.value) } : item
                                )
                              }))
                            }
                            required
                          >
                            {question.options.map((option, optionIndex) => (
                              <option key={optionIndex} value={optionIndex}>
                                Option {optionIndex + 1}{option.trim() ? `: ${option.trim()}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        {question.options.length < 8 && (
                          <button
                            className="focus-ring rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                questions: current.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, options: [...item.options, ""] } : item))
                              }))
                            }
                          >
                            Add option
                          </button>
                        )}
                      </div>
                    )}
                    <div>
                      {form.questions.length > 1 && (
                        <button
                          className="focus-ring rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, questions: current.questions.filter((_, itemIndex) => itemIndex !== index) }))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="focus-ring w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Create</button>
            </div>
          </form>

          <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={assignStudent}>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-950">Assign exam</h2>
            </div>
            <div className="mt-4 space-y-3">
              <select className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={assignExamId} onChange={(event) => setAssignExamId(event.target.value)} required>
                <option value="">Select exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
                <button
                  className={`focus-ring rounded px-3 py-1.5 text-xs font-semibold ${assignmentMode === "department" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}
                  type="button"
                  onClick={() => setAssignmentMode("department")}
                >
                  Department
                </button>
                <button
                  className={`focus-ring rounded px-3 py-1.5 text-xs font-semibold ${assignmentMode === "matric" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}
                  type="button"
                  onClick={() => setAssignmentMode("matric")}
                >
                  Matric no.
                </button>
              </div>
              {assignmentMode === "department" ? (
                <select
                  className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={selectedDepartment}
                  onChange={(event) => setSelectedDepartment(event.target.value)}
                  required
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Student matric number"
                  value={studentMatricNumber}
                  onChange={(event) => setStudentMatricNumber(event.target.value)}
                  required
                />
              )}
              {assignMessage && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">{assignMessage}</div>}
              <button className="focus-ring w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70" disabled={assigning}>
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          </form>

          <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={updateManagedExam}>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-950">Manage exams</h2>
            </div>
            <div className="mt-4 space-y-3">
              <select
                className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={manageExamId}
                onChange={(event) => setManageExamId(event.target.value)}
              >
                <option value="">Select exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}
                  </option>
                ))}
              </select>
              {manageExamId ? (
                <>
                  <input
                    className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Exam title"
                    value={manageForm.title}
                    onChange={(event) => setManageForm((current) => ({ ...current, title: event.target.value }))}
                    required
                  />
                  <textarea
                    className="focus-ring min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Description"
                    value={manageForm.description}
                    onChange={(event) => setManageForm((current) => ({ ...current, description: event.target.value }))}
                  />
                  <input
                    className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    type="number"
                    min={1}
                    value={manageForm.durationMinutes}
                    onChange={(event) => setManageForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}
                  />
                  <input
                    className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    type="datetime-local"
                    value={manageForm.startTime}
                    onChange={(event) => setManageForm((current) => ({ ...current, startTime: event.target.value }))}
                  />
                  <input
                    className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    type="datetime-local"
                    value={manageForm.endTime}
                    onChange={(event) => setManageForm((current) => ({ ...current, endTime: event.target.value }))}
                  />
                  <select
                    className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={manageForm.status}
                    onChange={(event) => setManageForm((current) => ({ ...current, status: event.target.value as Exam["status"] }))}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  {manageMessage && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">{manageMessage}</div>}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="focus-ring rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70" disabled={updatingExam}>
                      {updatingExam ? "Updating..." : "Update"}
                    </button>
                    <button
                      className="focus-ring rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                      type="button"
                      onClick={deleteManagedExam}
                      disabled={deletingExam}
                    >
                      {deletingExam ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Select an existing exam to update or delete it.</p>
              )}
            </div>
          </form>
        </aside>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Recent alerts</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {(overview?.recentAlerts ?? []).map((alert) => (
            <div key={alert.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="font-medium text-slate-900">{alert.title}</p>
                <p className="text-sm text-slate-500">{formatDateTime(alert.createdAt)}</p>
              </div>
              <SeverityBadge severity={alert.severity} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ShieldIcon = AlertTriangle;
