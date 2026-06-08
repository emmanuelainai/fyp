import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../api/http";
import type { Role } from "../types";

const homeForRole = (role: Role) => (role === "STUDENT" ? "/student" : role === "ADMIN" ? "/admin/users" : "/examiner");

export const LoginPage = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("student@examsentinel.com");
  const [password, setPassword] = useState("Student123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedIn = await login(email, password);
      const from = location.state?.from?.pathname;
      navigate(from ?? homeForRole(loggedIn.role), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <div className="flex items-center gap-3 text-blue-800">
            <ShieldCheck className="h-9 w-9" />
            <span className="text-xl font-semibold">ExamSentinel</span>
          </div>
          <h1 className="mt-8 max-w-2xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">Secure online exams with transparent monitoring.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Students grant consent before monitoring begins. Examiners review live sessions, alerts, evidence, and post-exam reports from one dashboard.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 text-sm text-slate-700 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">Consent-led permissions</div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">Real-time alerts</div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">Risk reports</div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use the seeded accounts after running the database seed command.</p>
          {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <div className="flex items-center justify-end">
              <Link className="text-sm font-medium text-blue-700 hover:text-blue-800" to="/forgot-password">
                Forgot password?
              </Link>
            </div>
            <button className="focus-ring w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-600">
            New student?{" "}
            <Link className="font-medium text-blue-700 hover:text-blue-800" to="/register">
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
};
