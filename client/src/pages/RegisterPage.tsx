import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../api/http";
import { departments } from "../utils/departments";
import type { RegistrationChallengeResponse } from "../api/endpoints";

export const RegisterPage = () => {
  const { register, verifyRegistration } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", matricNumber: "", department: "" });
  const [challenge, setChallenge] = useState<RegistrationChallengeResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await register(form);
      setChallenge(result);
      setCode("");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    setError("");
    setLoading(true);
    try {
      await verifyRegistration(challenge.challengeId, code);
      navigate("/student", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-blue-800">
          <ShieldCheck className="h-7 w-7" />
          <span className="text-lg font-semibold">ExamSentinel</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-slate-950">{challenge ? "Verify your email" : "Create student account"}</h1>
        {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {challenge ? (
          <form className="mt-5 grid gap-4" onSubmit={verify}>
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                challenge.emailDelivery.sent ? "border-blue-200 bg-blue-50 text-blue-900" : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <p>{challenge.message}</p>
              <p className="mt-1">Email: {challenge.email}</p>
              {!challenge.emailDelivery.sent && challenge.emailDelivery.reason && <p className="mt-1">Reason: {challenge.emailDelivery.reason}</p>}
              {challenge.devCode && <p className="mt-1 font-semibold">Development code: {challenge.devCode}</p>}
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Verification code</span>
              <input
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </label>
            <button className="focus-ring rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800" disabled={loading}>
              {loading ? "Verifying..." : "Verify and continue"}
            </button>
            <button
              className="focus-ring rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              type="button"
              onClick={() => {
                setChallenge(null);
                setCode("");
                setError("");
              }}
            >
              Edit account details
            </button>
          </form>
        ) : (
          <form className="mt-5 grid gap-4" onSubmit={submit}>
            {[
              ["name", "Full name", "text"],
              ["email", "Email", "email"],
              ["password", "Password", "password"],
              ["matricNumber", "Matric number", "text"]
            ].map(([key, label, type]) => (
              <label className="block" key={key}>
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  required={key !== "matricNumber"}
                />
              </label>
            ))}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Department</span>
              <select
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={form.department}
                onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                required
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <button className="focus-ring rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800" disabled={loading}>
              {loading ? "Sending code..." : "Create account"}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link className="font-medium text-blue-700 hover:text-blue-800" to="/">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
};
