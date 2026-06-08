import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList } from "lucide-react";
import { examsApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import { EmptyState } from "../components/EmptyState";
import type { Exam } from "../types";
import { formatDateTime, formatDuration } from "../utils/time";

export const StudentCompletedExamsPage = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [expandedExamId, setExpandedExamId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    examsApi
      .list()
      .then((response) => setExams(response.data.filter((exam) => exam.sessions?.some((session) => session.status === "SUBMITTED"))))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Completed exams</h1>
        <p className="mt-1 text-sm text-slate-500">Review submitted exams, multiple-choice scores, and answer details.</p>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {exams.length === 0 ? (
        <EmptyState title="No completed exams" message="Submitted exams and scores will appear here." />
      ) : (
        <div className="grid gap-4">
          {exams.map((exam) => {
            const session = exam.sessions?.find((item) => item.status === "SUBMITTED");
            const grading = session?.report?.reportJson?.grading;
            const hasWritten = grading?.details.some((detail) => detail.type === "SHORT_TEXT") ?? false;
            const canShowScore = !hasWritten || Boolean(grading?.isFullyGraded);
            const isExpanded = expandedExamId === exam.id;

            return (
              <article key={exam.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{exam.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{exam.description ?? "No description provided."}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Submitted
                  </span>
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
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                    {canShowScore
                      ? `Score: ${grading?.earnedPoints ?? 0}/${grading?.totalPoints ?? grading?.autoGradedPoints ?? 0} (${grading?.percentage ?? 0}%)`
                      : "Score pending examiner grading"}
                  </div>
                  <button
                    className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    onClick={() => setExpandedExamId((current) => (current === exam.id ? "" : exam.id))}
                  >
                    {isExpanded ? "Hide details" : "View details"}
                  </button>
                </div>
                {isExpanded && (
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
