import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { reportsApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import { RiskBadge } from "../components/RiskBadge";
import type { Report } from "../types";
import { formatDateTime } from "../utils/time";

export const ReportsPage = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [riskLevel, setRiskLevel] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    reportsApi
      .list(riskLevel ? { riskLevel } : undefined)
      .then((response) => setReports(response.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [riskLevel]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Post-exam summaries, risk levels, recommendations, and evidence references.</p>
        </div>
        <select className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}>
          <option value="">All risks</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid gap-4">
        {reports.map((report) => (
          <article key={report.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{report.session?.student?.name ?? "Student session"}</h2>
                <p className="mt-1 text-sm text-slate-500">{report.session?.exam?.title}</p>
              </div>
              <RiskBadge level={report.riskLevel} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{report.summary}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
              <span>Events: {report.totalEvents}</span>
              <span>High severity: {report.highSeverityEvents}</span>
              <span>Recommendation: {report.recommendation.replaceAll("_", " ")}</span>
              <span>Generated: {formatDateTime(report.createdAt)}</span>
            </div>
            {report.sessionId && (
              <Link className="mt-4 inline-flex font-medium text-blue-700 hover:text-blue-800" to={`/sessions/${report.sessionId}/live`}>
                Open session detail
              </Link>
            )}
          </article>
        ))}
        {reports.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No reports found.</div>}
      </div>
    </div>
  );
};
