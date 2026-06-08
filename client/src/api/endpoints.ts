import { http } from "./http";
import type { Alert, DashboardOverview, Evidence, Exam, ExamSession, MonitoringEvent, Report, User } from "../types";

export type AuthTokenResponse = { token: string; user: User };

export type EmailDelivery = {
  sent: boolean;
  configured: boolean;
  reason?: string;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
};

export type RegistrationChallengeResponse = {
  requiresEmailVerification: true;
  challengeId: string;
  email: string;
  message: string;
  emailDelivery: EmailDelivery;
  devCode?: string;
};

export type PasswordResetChallengeResponse = {
  message: string;
  emailDelivery?: EmailDelivery;
  challengeId?: string;
  email?: string;
  devCode?: string;
};

export type ExamQuestionInput = {
  prompt: string;
  type?: "SHORT_TEXT" | "MULTIPLE_CHOICE";
  options?: string[];
  correctOptionIndex?: number;
  points?: number;
};

export const authApi = {
  login: (email: string, password: string) => http.post<AuthTokenResponse>("/auth/login", { email, password }),
  register: (data: { name: string; email: string; password: string; matricNumber?: string; department?: string }) =>
    http.post<RegistrationChallengeResponse>("/auth/register", data),
  verifyRegistration: (challengeId: string, code: string) => http.post<AuthTokenResponse>("/auth/register/verify", { challengeId, code }),
  forgotPassword: (email: string) => http.post<PasswordResetChallengeResponse>("/auth/password/forgot", { email }),
  resetPassword: (data: { challengeId: string; code: string; newPassword: string }) => http.post<{ message: string }>("/auth/password/reset", data),
  me: () => http.get<{ user: User }>("/auth/me"),
  changePassword: (data: { currentPassword: string; newPassword: string }) => http.post<{ message: string }>("/auth/change-password", data)
};

export const usersApi = {
  list: () => http.get<User[]>("/users"),
  update: (id: string, data: Partial<User>) => http.patch<User>(`/users/${id}`, data),
  remove: (id: string) => http.delete<User>(`/users/${id}`)
};

export const examsApi = {
  list: () => http.get<Exam[]>("/exams"),
  get: (id: string) => http.get<Exam>(`/exams/${id}`),
  create: (data: Partial<Omit<Exam, "questions">> & { questions?: ExamQuestionInput[] }) => http.post<Exam>("/exams", data),
  update: (id: string, data: Partial<Exam>) => http.patch<Exam>(`/exams/${id}`, data),
  remove: (id: string) => http.delete<Exam>(`/exams/${id}`),
  assign: (id: string, data: { matricNumbers?: string[]; departments?: string[] }) => http.post(`/exams/${id}/assign`, data),
  assignments: (id: string) => http.get(`/exams/${id}/assignments`)
};

export const sessionsApi = {
  list: (params?: Record<string, string>) => http.get<ExamSession[]>("/sessions", { params }),
  get: (id: string) => http.get<ExamSession>(`/sessions/${id}`),
  start: (data: {
    examId: string;
    consentAccepted: boolean;
    permissions: { cameraGranted: boolean; fullscreenGranted: boolean; notificationGranted: boolean };
    deviceInfo: Record<string, unknown>;
  }) => http.post<{ session: ExamSession }>("/sessions/start", data),
  end: (id: string, answers?: Record<string, string>) => http.post<{ session: ExamSession; report: Report }>(`/sessions/${id}/end`, { answers: answers ?? {} })
};

export const monitoringApi = {
  submitEvent: (sessionId: string, data: { eventType: string; severity: string; message: string; metadata?: Record<string, unknown> }) =>
    http.post<{ event: MonitoringEvent; session: ExamSession; alert?: Alert }>(`/sessions/${sessionId}/events`, data),
  events: (sessionId: string) => http.get<{ items: MonitoringEvent[]; total: number }>(`/sessions/${sessionId}/events`),
  evidence: (sessionId: string) => http.get<Evidence[]>(`/sessions/${sessionId}/evidence`),
  uploadEvidence: (sessionId: string, formData: FormData) =>
    http.post<{ evidence: Evidence; event: MonitoringEvent }>(`/sessions/${sessionId}/evidence`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
};

export const alertsApi = {
  list: (params?: Record<string, string>) => http.get<Alert[]>("/alerts", { params }),
  resolve: (id: string, data: { status: "RESOLVED" | "DISMISSED" | "REVIEWING" }) =>
    http.patch<Alert>(`/alerts/${id}/resolve`, data)
};

export const reportsApi = {
  list: (params?: Record<string, string>) => http.get<Report[]>("/reports", { params }),
  get: (sessionId: string) => http.get<Report>(`/sessions/${sessionId}/report`),
  generate: (sessionId: string) => http.post<Report>(`/sessions/${sessionId}/report/generate`),
  grade: (sessionId: string, grades: { questionId: string; score: number; feedback?: string }[]) =>
    http.patch<Report>(`/sessions/${sessionId}/report/grade`, { grades })
};

export const dashboardApi = {
  overview: () => http.get<DashboardOverview>("/dashboard/overview"),
  exam: (examId: string) => http.get(`/dashboard/exam/${examId}`)
};
