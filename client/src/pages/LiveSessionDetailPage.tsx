import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileText, ImageIcon, RefreshCw } from "lucide-react";
import { API_BASE_URL, apiErrorMessage } from "../api/http";
import { monitoringApi, reportsApi, sessionsApi } from "../api/endpoints";
import { RiskBadge, SeverityBadge } from "../components/RiskBadge";
import { useSocket } from "../hooks/useSocket";
import type { Evidence, ExamSession, MonitoringEvent, Report } from "../types";
import { formatDateTime } from "../utils/time";

const assetBase = API_BASE_URL.replace(/\/api$/, "");

export const LiveSessionDetailPage = () => {
  const { id } = useParams();
  const socket = useSocket();
  const [session, setSession] = useState<ExamSession | null>(null);
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  const refresh = () => {
    if (!id) return;
    Promise.all([sessionsApi.get(id), monitoringApi.events(id), monitoringApi.evidence(id)])
      .then(([sessionResponse, eventsResponse, evidenceResponse]) => {
        setSession(sessionResponse.data);
        setEvents(eventsResponse.data.items);
        setEvidence(evidenceResponse.data);
      })
      .catch((err) => setError(apiErrorMessage(err)));
    reportsApi
      .get(id)
      .then((response) => setReport(response.data))
      .catch(() => setReport(null));
  };

  useEffect(refresh, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit("session:join", { sessionId: id });
    const onEvent = (event: MonitoringEvent) => setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
    const onRisk = (updated: ExamSession) => setSession((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
    const onEvidence = (item: Evidence) => setEvidence((current) => [item, ...current.filter((existing) => existing.id !== item.id)]);
    socket.on("event:new", onEvent);
    socket.on("risk:updated", onRisk);
    socket.on("evidence:new", onEvidence);
    return () => {
      socket.off("event:new", onEvent);
      socket.off("risk:updated", onRisk);
      socket.off("evidence:new", onEvidence);
    };
  }, [id, socket]);

  const generateReport = async () => {
    if (!id) return;
    try {
      const response = await reportsApi.generate(id);
      setReport(response.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (error) return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!session) return <div className="text-slate-600">Loading session...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{session.student.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {session.student.matricNumber ?? "No matric number"} · {session.exam.title} · started {formatDateTime(session.startedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={session.riskLevel} />
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800">{Math.round(session.riskScore)}/100</span>
          <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-5">
        {[
          ["Tab switches", session.tabSwitchCount],
          ["Fullscreen exits", session.fullscreenExitCount],
          ["Copy/paste", session.copyPasteCount],
          ["Face missing", session.faceMissingCount],
          ["Multiple faces", session.multipleFaceCount]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Event timeline</h2>
          <div className="mt-4 max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
            {events.map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{event.eventType.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm text-slate-600">{event.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(event.timestamp)}</p>
                </div>
                <SeverityBadge severity={event.severity} />
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-700" />
              <h2 className="text-lg font-semibold text-slate-950">Evidence</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {evidence.map((item) => (
                <a key={item.id} href={`${assetBase}${item.fileUrl}`} target="_blank" rel="noreferrer" className="block rounded-md border border-slate-200 p-2 hover:bg-slate-50">
                  {item.mimeType.startsWith("image/") ? <img src={`${assetBase}${item.fileUrl}`} alt={item.type} className="aspect-video w-full rounded object-cover" /> : null}
                  <p className="mt-2 text-sm font-medium text-slate-900">{item.type}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                </a>
              ))}
              {evidence.length === 0 && <p className="text-sm text-slate-500">No evidence uploaded yet.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-950">Report</h2>
            </div>
            {report ? (
              <div className="mt-3 text-sm text-slate-600">
                <p>{report.summary}</p>
                <p className="mt-2 font-semibold text-slate-900">Recommendation: {report.recommendation.replaceAll("_", " ")}</p>
                <Link className="mt-3 inline-flex font-medium text-blue-700 hover:text-blue-800" to="/reports">
                  View all reports
                </Link>
              </div>
            ) : (
              <button className="focus-ring mt-4 w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800" onClick={generateReport}>
                Generate report
              </button>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
};
