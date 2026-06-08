export type Role = "STUDENT" | "EXAMINER" | "ADMIN";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  matricNumber?: string | null;
  department?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExamSettings = {
  requireWebcam?: boolean;
  requireFullscreen?: boolean;
  allowCalculator?: boolean;
  allowTabSwitches?: boolean;
  maxTabSwitches?: number;
  screenshotIntervalSeconds?: number;
  enableFacePresence?: boolean;
  enableMultipleFaceDetection?: boolean;
  enableGazeDetection?: boolean;
  enableAudioMonitoring?: boolean;
};

export type ExamQuestion = {
  id: string;
  examId: string;
  prompt: string;
  type: "SHORT_TEXT" | "MULTIPLE_CHOICE";
  options?: string[] | null;
  correctOptionIndex?: number | null;
  points: number;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Exam = {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  settings: ExamSettings;
  createdById: string;
  questions?: ExamQuestion[];
  assignments?: ExamAssignment[];
  sessions?: ExamSession[];
};

export type ExamAssignment = {
  id: string;
  examId: string;
  studentId: string;
  status: "ASSIGNED" | "STARTED" | "SUBMITTED" | "FLAGGED" | "CANCELLED";
  createdAt: string;
  student?: User;
};

export type ExamSession = {
  id: string;
  examId: string;
  studentId: string;
  startedAt: string;
  endedAt?: string | null;
  status: "INITIALIZING" | "ACTIVE" | "SUBMITTED" | "TERMINATED" | "FLAGGED";
  consentAccepted: boolean;
  permissions: Record<string, unknown>;
  deviceInfo: Record<string, unknown>;
  riskScore: number;
  riskLevel: RiskLevel;
  tabSwitchCount: number;
  faceMissingCount: number;
  multipleFaceCount: number;
  copyPasteCount: number;
  fullscreenExitCount: number;
  exam: Exam;
  student: User;
  alerts?: Alert[];
  report?: Report | null;
};

export type MonitoringEvent = {
  id: string;
  sessionId: string;
  eventType: string;
  severity: Severity;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
};

export type Alert = {
  id: string;
  sessionId: string;
  eventId?: string | null;
  title: string;
  description: string;
  severity: Exclude<Severity, "INFO">;
  status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
  session?: ExamSession;
};

export type Evidence = {
  id: string;
  sessionId: string;
  eventId?: string | null;
  type: "SCREENSHOT" | "WEBCAM_FRAME" | "REPORT_FILE" | "OTHER";
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type Report = {
  id: string;
  sessionId: string;
  summary: string;
  riskScore: number;
  riskLevel: RiskLevel;
  totalEvents: number;
  highSeverityEvents: number;
  recommendation: "CLEAR" | "REVIEW_REQUIRED" | "LIKELY_VIOLATION";
  reportJson: {
    grading?: {
      earnedPoints: number;
      autoGradedPoints: number;
      totalPoints?: number;
      manualGradedPoints?: number;
      isFullyGraded?: boolean;
      percentage: number | null;
      correctCount: number;
      totalAutoGraded: number;
      details: Array<{
        questionId: string;
        order: number;
        prompt: string;
        type: "SHORT_TEXT" | "MULTIPLE_CHOICE";
        points: number;
        options: string[];
        selectedOptionIndex: number | null;
        selectedAnswer: string | null;
        correctOptionIndex: number | null;
        correctAnswer: string | null;
        isCorrect: boolean | null;
        earnedPoints: number;
        manualScore?: number | null;
        manualFeedback?: string | null;
      }>;
    };
    [key: string]: unknown;
  };
  createdAt: string;
  session?: ExamSession;
};

export type DashboardOverview = {
  activeSessions: number;
  totalAlerts: number;
  highRiskSessions: number;
  completedSessions: number;
  averageRiskScore: number;
  recentAlerts: Alert[];
};
