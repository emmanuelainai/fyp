import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../api/http";

export const SecurityPage = () => {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const response = await changePassword(form);
      setMessage(response);
      setForm({ currentPassword: "", newPassword: "" });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Security</h1>
        <p className="mt-1 text-sm text-slate-500">Change your password. ExamSentinel sends an email notification after a successful change.</p>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-blue-700" />
          <h2 className="text-lg font-semibold text-slate-950">Password</h2>
        </div>
        {message && <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</div>}
        {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Current password</span>
            <input
              className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">New password</span>
            <input
              className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              type="password"
              minLength={8}
              value={form.newPassword}
              onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
              required
            />
          </label>
          <button className="focus-ring rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800" disabled={loading}>
            {loading ? "Changing..." : "Change password"}
          </button>
        </form>
      </section>
    </div>
  );
};
