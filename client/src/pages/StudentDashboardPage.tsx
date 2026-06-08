import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ClipboardList } from "lucide-react";
import { examsApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import type { Exam } from "../types";
import { formatDateTime, formatDuration } from "../utils/time";

export const StudentDashboardPage = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const assignedExams = exams.filter((exam) => {
    const assignment = exam.assignments?.[0];
    const activeSession = exam.sessions?.find((session) => session.status === "ACTIVE");
    return Boolean(activeSession || assignment?.status === "ASSIGNED" || assignment?.status === "STARTED");
  });

  useEffect(() => {
    examsApi
      .list()
      .then((response) => setExams(response.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Assigned exams</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user?.department ? `${user.department} · ` : ""}Start an exam only after reviewing the instructions and consent screen.
        </p>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {assignedExams.length === 0 ? (
        <EmptyState title="No assigned exams" message="Assigned exams will appear here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assignedExams.map((exam) => {
            const assignment = exam.assignments?.[0];
            const activeSession = exam.sessions?.find((session) => session.status === "ACTIVE");
            const submittedAttempts = exam.sessions?.filter((session) => session.status === "SUBMITTED").length ?? 0;
            const isRetake = !activeSession && (assignment?.status === "ASSIGNED" || assignment?.status === "STARTED") && submittedAttempts > 0;
            return (
              <article key={exam.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{exam.title}</h2>
                      {isRetake && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          Retake {submittedAttempts}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{exam.description ?? "No description provided."}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">{assignment?.status ?? exam.status}</span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-blue-700" />
                    {formatDateTime(exam.startTime)} to {formatDateTime(exam.endTime)}
                  </p>
                  <p className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-teal-700" />
                    Duration: {formatDuration(exam.durationMinutes)}
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {activeSession ? (
                    <Link className="focus-ring rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" to={`/sessions/${activeSession.id}/exam`}>
                      Resume exam
                    </Link>
                  ) : (
                    <Link className="focus-ring rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" to={`/exams/${exam.id}/instructions`}>
                      Start exam
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
