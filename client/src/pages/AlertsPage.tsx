import { useEffect, useState } from "react";
import { alertsApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import { SeverityBadge } from "../components/RiskBadge";
import type { Alert } from "../types";
import { formatDateTime } from "../utils/time";

export const AlertsPage = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  const refresh = () => {
    alertsApi
      .list(filter ? { status: filter } : undefined)
      .then((response) => setAlerts(response.data))
      .catch((err) => setError(apiErrorMessage(err)));
  };

  useEffect(refresh, [filter]);

  const resolve = async (id: string, status: "RESOLVED" | "DISMISSED" | "REVIEWING") => {
    setError("");
    try {
      await alertsApi.resolve(id, { status });
      refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Alerts</h1>
          <p className="mt-1 text-sm text-slate-500">Review suspicious monitoring events and mark outcomes.</p>
        </div>
        <select className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="REVIEWING">Reviewing</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Alert</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{alert.title}</p>
                    <p className="mt-1 text-slate-600">{alert.description}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(alert.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{alert.session?.student?.name ?? "Unknown"}</p>
                    <p className="text-xs text-slate-500">{alert.session?.student?.matricNumber ?? "No matric number"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">{alert.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-40 gap-2">
                      <button className="focus-ring rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800" onClick={() => resolve(alert.id, "RESOLVED")}>
                        Resolve
                      </button>
                      <button className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => resolve(alert.id, "DISMISSED")}>
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
