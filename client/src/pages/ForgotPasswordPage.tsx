import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { apiErrorMessage } from "../api/http";
import { useAuth } from "../context/AuthContext";
import type { PasswordResetChallengeResponse } from "../api/endpoints";

export const ForgotPasswordPage = () => {
  const { forgotPassword, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<PasswordResetChallengeResponse | null>(null);
  const [form, setForm] = useState({ code: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      setChallenge(result);
      setMessage(result.message);
      setForm({ code: "", newPassword: "" });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge?.challengeId) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await resetPassword({
        challengeId: challenge.challengeId,
        code: form.code,
        newPassword: form.newPassword
      });
      setMessage(result);
      setChallenge(null);
      setEmail("");
      setForm({ code: "", newPassword: "" });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-blue-800">
          <ShieldCheck className="h-7 w-7" />
          <span className="text-lg font-semibold">ExamSentinel</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-slate-950">Reset password</h1>
        <p className="mt-1 text-sm text-slate-500">A 6-digit code is sent to your email before a new password can be saved.</p>
        {message && <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</div>}
        {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {!challenge?.challengeId ? (
          <form className="mt-5 space-y-4" onSubmit={requestCode}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Account email</span>
              <input
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <button className="focus-ring w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800" disabled={loading}>
              {loading ? "Sending code..." : "Send reset code"}
            </button>
          </form>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submitReset}>
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                challenge.emailDelivery?.sent ? "border-blue-200 bg-blue-50 text-blue-900" : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <p>{challenge.emailDelivery?.sent ? `Enter the code sent to ${challenge.email ?? email}.` : challenge.message}</p>
              {!challenge.emailDelivery?.sent && challenge.emailDelivery?.reason && <p className="mt-1">Reason: {challenge.emailDelivery.reason}</p>}
              {challenge.devCode && <p className="mt-1 font-semibold">Development code: {challenge.devCode}</p>}
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Verification code</span>
              <input
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
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
            <button className="focus-ring w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800" disabled={loading}>
              {loading ? "Resetting..." : "Reset password"}
            </button>
            <button
              className="focus-ring w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              type="button"
              onClick={() => {
                setChallenge(null);
                setForm({ code: "", newPassword: "" });
                setError("");
              }}
            >
              Use a different email
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-600">
          Remembered it?{" "}
          <Link className="font-medium text-blue-700 hover:text-blue-800" to="/">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
};
