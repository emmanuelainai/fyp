import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, ClipboardList, KeyRound, LayoutDashboard, LogOut, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const baseLink = "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium";

export const AppShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links =
    user?.role === "STUDENT"
      ? [
          { to: "/student", label: "My exams", icon: ClipboardList },
          { to: "/student/completed", label: "Completed", icon: BarChart3 },
          { to: "/security", label: "Security", icon: KeyRound }
        ]
      : user?.role === "ADMIN"
        ? [
            { to: "/admin/users", label: "Users", icon: Users },
            { to: "/alerts", label: "Alerts", icon: AlertTriangle },
            { to: "/reports", label: "Reports", icon: BarChart3 },
            { to: "/security", label: "Security", icon: KeyRound }
          ]
      : [
          { to: "/examiner", label: "Dashboard", icon: LayoutDashboard },
          { to: "/examiner/completed", label: "Completed exams", icon: ClipboardList },
          { to: "/alerts", label: "Alerts", icon: AlertTriangle },
          { to: "/reports", label: "Reports", icon: BarChart3 },
          { to: "/security", label: "Security", icon: KeyRound }
        ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to={user?.role === "STUDENT" ? "/student" : user?.role === "ADMIN" ? "/admin/users" : "/examiner"} className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <ShieldCheck className="h-6 w-6 text-blue-700" />
            ExamSentinel
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${baseLink} ${isActive ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-100"}`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
