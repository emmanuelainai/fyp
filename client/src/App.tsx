import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage";
import { StudentCompletedExamsPage } from "./pages/StudentCompletedExamsPage";
import { ExamInstructionsPage } from "./pages/ExamInstructionsPage";
import { ConsentPermissionsPage } from "./pages/ConsentPermissionsPage";
import { ExamMonitoringPage } from "./pages/ExamMonitoringPage";
import { ExaminerDashboardPage } from "./pages/ExaminerDashboardPage";
import { ExaminerCompletedExamsPage } from "./pages/ExaminerCompletedExamsPage";
import { LiveSessionDetailPage } from "./pages/LiveSessionDetailPage";
import { AlertsPage } from "./pages/AlertsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { SecurityPage } from "./pages/SecurityPage";

export const App = () => (
  <Routes>
    <Route path="/" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />

    <Route element={<ProtectedRoute roles={["STUDENT"]} />}>
      <Route element={<AppShell />}>
        <Route path="/student" element={<StudentDashboardPage />} />
        <Route path="/student/completed" element={<StudentCompletedExamsPage />} />
        <Route path="/exams/:id/instructions" element={<ExamInstructionsPage />} />
        <Route path="/exams/:id/consent" element={<ConsentPermissionsPage />} />
        <Route path="/sessions/:id/exam" element={<ExamMonitoringPage />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute roles={["EXAMINER"]} />}>
      <Route element={<AppShell />}>
        <Route path="/examiner" element={<ExaminerDashboardPage />} />
        <Route path="/examiner/completed" element={<ExaminerCompletedExamsPage />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute roles={["EXAMINER", "ADMIN"]} />}>
      <Route element={<AppShell />}>
        <Route path="/sessions/:id/live" element={<LiveSessionDetailPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute roles={["STUDENT", "EXAMINER", "ADMIN"]} />}>
      <Route element={<AppShell />}>
        <Route path="/security" element={<SecurityPage />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
      <Route element={<AppShell />}>
        <Route path="/admin/users" element={<AdminUsersPage />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
