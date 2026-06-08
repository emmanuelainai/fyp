import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { reportsApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import type { Report } from "../types";
import { formatDateTime } from "../utils/time";

type GradeDraft = Record<string, { score: number; feedback: string }>;

export const ExaminerCompletedExamsPage = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedExamId, setExpandedExamId] = useState("");
  const [detailSessionId, setDetailSessionId] = useState("");
  const [gradingSessionId, setGradingSessionId] = useState("");
  const [gradeDraft, setGradeDraft] = useState<GradeDraft>({});
  const [error, setError] = useState("");

  const refresh = () => {
    reportsApi
      .list()
      .then((response) => setReports(response.data.filter((report) => report.session?.status === "SUBMITTED")))
      .catch((err) => setError(apiErrorMessage(err)));
  };

  useEffect(refresh, []);

  const groupedReports = useMemo(() => {
    const groups = new Map<string, { examTitle: string; reports: Report[] }>();
    reports.forEach((report) => {
      const examId = report.session?.examId ?? report.session?.exam?.id ?? "unknown";
      const examTitle = report.session?.exam?.title ?? "Completed exam";
      const group = groups.get(examId) ?? { examTitle, reports: [] };
      group.reports.push(report);
      groups.set(examId, group);
    });
    return Array.from(groups.entries()).map(([examId, group]) => ({ examId, ...group }));
  }, [reports]);

  const startGrading = (report: Report) => {
    const details = report.reportJson.grading?.details ?? [];
    const draft = details
      .filter((detail) => detail.type === "SHORT_TEXT")
      .reduce<GradeDraft>((acc, detail) => {
        acc[detail.questionId] = {
          score: detail.manualScore ?? 0,
          feedback: detail.manualFeedback ?? ""
        };
        return acc;
      }, {});
    setGradeDraft(draft);
    setGradingSessionId(report.sessionId);
    setDetailSessionId(report.sessionId);
  };

  const saveGrades = async (event: FormEvent, report: Report) => {
    event.preventDefault();
    setError("");
    try {
      const details = report.reportJson.grading?.details ?? [];
      const grades = details
        .filter((detail) => detail.type === "SHORT_TEXT")
        .map((detail) => ({
          questionId: detail.questionId,
          score: Number(gradeDraft[detail.questionId]?.score ?? 0),
          feedback: gradeDraft[detail.questionId]?.feedback
        }));
      const response = await reportsApi.grade(report.sessionId, grades);
      setReports((current) => current.map((item) => (item.id === response.data.id ? response.data : item)));
      setGradingSessionId("");
      setGradeDraft({});
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Completed exams</h1>
        <p className="mt-1 text-sm text-slate-500">Review submitted students, multiple-choice scores, and grade written answers.</p>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="space-y-4">
        {groupedReports.map((group) => {
          const isExpanded = expandedExamId === group.examId;
          return (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={group.examId}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{group.examTitle}</h2>
                  <p className="mt-1 text-sm text-slate-500">{group.reports.length} submitted student{group.reports.length === 1 ? "" : "s"}</p>
                </div>
                <button
                  className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => setExpandedExamId((current) => (current === group.examId ? "" : group.examId))}
                >
                  {isExpanded ? "Hide students" : "View students"}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2 pr-4 font-medium">Student</th>
                        <th className="py-2 pr-4 font-medium">Submitted</th>
                        <th className="py-2 pr-4 font-medium">Score</th>
                        <th className="py-2 pr-4 font-medium">Written answers</th>
                        <th className="py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.reports.map((report) => {
                        const grading = report.reportJson.grading;
                        const details = grading?.details ?? [];
                        const writtenDetails = details.filter((detail) => detail.type === "SHORT_TEXT");
                        const hasWritten = writtenDetails.length > 0;
                        const canShowScore = !hasWritten || Boolean(grading?.isFullyGraded);
                        const showDetails = detailSessionId === report.sessionId;
                        const isGrading = gradingSessionId === report.sessionId;
                        const scoreDenominator = grading?.totalPoints ?? grading?.autoGradedPoints ?? 0;

                        return (
                          <tr key={report.id} className="align-top">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-slate-900">{report.session?.student?.name ?? "Unknown student"}</p>
                              <p className="text-xs text-slate-500">{report.session?.student?.matricNumber ?? "No matric number"}</p>
                            </td>
                            <td className="py-3 pr-4 text-slate-600">{formatDateTime(report.createdAt)}</td>
                            <td className="py-3 pr-4">
                              <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {canShowScore ? `${grading?.earnedPoints ?? 0}/${scoreDenominator}` : "Pending"}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {hasWritten ? (grading?.isFullyGraded ? "Graded" : "Needs grading") : "Multiple choice only"}
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  onClick={() => setDetailSessionId((current) => (current === report.sessionId ? "" : report.sessionId))}
                                >
                                  {showDetails ? "Hide details" : "See details"}
                                </button>
                                {hasWritten && (
                                  <button
                                    className="focus-ring rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                                    onClick={() => startGrading(report)}
                                  >
                                    {grading?.isFullyGraded ? "Update grade" : "Grade"}
                                  </button>
                                )}
                              </div>
                              {showDetails && (
                                <div className="mt-3 max-w-2xl space-y-3">
                                  {details.map((detail) => (
                                    <div className="rounded-md border border-slate-200 p-3" key={detail.questionId}>
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <p className="font-medium text-slate-950">Question {detail.order}</p>
                                          <p className="mt-1 text-slate-600">{detail.prompt}</p>
                                        </div>
                                        {canShowScore && <span className="shrink-0 text-xs font-semibold text-slate-500">{detail.earnedPoints}/{detail.points}</span>}
                                      </div>
                                      {detail.type === "MULTIPLE_CHOICE" ? (
                                        <div className="mt-2 space-y-1">
                                          {detail.options.map((option, optionIndex) => {
                                            const picked = detail.selectedOptionIndex === optionIndex;
                                            const correct = canShowScore && detail.correctOptionIndex === optionIndex;
                                            return (
                                              <p
                                                className={`rounded border px-2 py-1 text-xs ${
                                                  correct ? "border-green-300 bg-green-50 text-green-900" : picked ? "border-red-300 bg-red-50 text-red-900" : "border-slate-200 text-slate-600"
                                                }`}
                                                key={optionIndex}
                                              >
                                                {option}
                                                {picked && " · picked"}
                                                {correct && " · correct"}
                                              </p>
                                            );
                                          })}
                                          {detail.selectedOptionIndex === null && <p className="text-xs font-semibold text-red-700">No answer selected</p>}
                                        </div>
                                      ) : (
                                        <div className="mt-2 space-y-2 text-xs text-slate-600">
                                          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1">Answer: {detail.selectedAnswer ?? "No answer submitted"}</p>
                                          {detail.manualFeedback && <p className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-900">Feedback: {detail.manualFeedback}</p>}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {isGrading && (
                                <form className="mt-3 max-w-2xl space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3" onSubmit={(event) => saveGrades(event, report)}>
                                  {writtenDetails.map((detail) => (
                                    <label className="block" key={detail.questionId}>
                                      <span className="text-xs font-semibold text-blue-950">Question {detail.order}: {detail.prompt}</span>
                                      <p className="mt-1 rounded border border-blue-100 bg-white px-2 py-1 text-xs text-slate-600">Answer: {detail.selectedAnswer ?? "No answer submitted"}</p>
                                      <div className="mt-2 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                                        <input
                                          className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm"
                                          type="number"
                                          min={0}
                                          max={detail.points}
                                          value={gradeDraft[detail.questionId]?.score ?? 0}
                                          onChange={(event) =>
                                            setGradeDraft((current) => ({
                                              ...current,
                                              [detail.questionId]: { score: Number(event.target.value), feedback: current[detail.questionId]?.feedback ?? "" }
                                            }))
                                          }
                                        />
                                        <input
                                          className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm"
                                          placeholder="Feedback optional"
                                          value={gradeDraft[detail.questionId]?.feedback ?? ""}
                                          onChange={(event) =>
                                            setGradeDraft((current) => ({
                                              ...current,
                                              [detail.questionId]: { score: current[detail.questionId]?.score ?? 0, feedback: event.target.value }
                                            }))
                                          }
                                        />
                                      </div>
                                    </label>
                                  ))}
                                  <div className="flex gap-2">
                                    <button className="focus-ring rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Save grade</button>
                                    <button className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white" type="button" onClick={() => setGradingSessionId("")}>
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
        {groupedReports.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No completed exams yet.
          </div>
        )}
      </div>
    </div>
  );
};
