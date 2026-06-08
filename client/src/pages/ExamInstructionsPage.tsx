import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Camera, Expand, ShieldAlert } from "lucide-react";
import { examsApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/http";
import type { Exam } from "../types";
import { formatDateTime, formatDuration } from "../utils/time";

export const ExamInstructionsPage = () => {
  const { id } = useParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    examsApi
      .get(id)
      .then((response) => setExam(response.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [id]);

  if (error) return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!exam) return <div className="text-slate-600">Loading exam...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{exam.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{exam.description}</p>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">Window</p>
            <p className="mt-1 font-medium text-slate-900">
              {formatDateTime(exam.startTime)} to {formatDateTime(exam.endTime)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Duration</p>
            <p className="mt-1 font-medium text-slate-900">{formatDuration(exam.durationMinutes)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <p className="mt-1 font-medium text-slate-900">{exam.status}</p>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Monitoring requirements</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 p-4">
            <Camera className="h-5 w-5 text-blue-700" />
            <p className="mt-3 font-medium text-slate-900">Webcam presence</p>
            <p className="mt-1 text-sm text-slate-600">Camera permission is requested before the session starts.</p>
          </div>
          <div className="rounded-md border border-slate-200 p-4">
            <Expand className="h-5 w-5 text-teal-700" />
            <p className="mt-3 font-medium text-slate-900">Fullscreen mode</p>
            <p className="mt-1 text-sm text-slate-600">Exiting fullscreen during the exam is logged as an incident.</p>
          </div>
          <div className="rounded-md border border-slate-200 p-4">
            <ShieldAlert className="h-5 w-5 text-orange-700" />
            <p className="mt-3 font-medium text-slate-900">Browser events</p>
            <p className="mt-1 text-sm text-slate-600">Tab switches, blur/focus, copy/paste, and right-click attempts are logged.</p>
          </div>
        </div>
        <div className="mt-5">
          <Link className="focus-ring inline-flex rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" to={`/exams/${exam.id}/consent`}>
            Continue to consent
          </Link>
        </div>
      </section>
    </div>
  );
};
