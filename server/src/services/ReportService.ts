import type { Prisma, Recommendation, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";

const recommendationFor = (riskScore: number): Recommendation => {
  if (riskScore >= 76) return "LIKELY_VIOLATION";
  if (riskScore >= 26) return "REVIEW_REQUIRED";
  return "CLEAR";
};

const gradeAnswers = (
  questions: Array<{ id: string; prompt: string; type: string; options: Prisma.JsonValue; correctOptionIndex: number | null; points: number; order: number }>,
  answers: Record<string, string>
) => {
  const multipleChoiceQuestions = questions.filter((question) => question.type === "MULTIPLE_CHOICE");
  const details = questions.map((question) => {
    const rawAnswer = answers[question.id];
    const options = Array.isArray(question.options) ? question.options.map(String) : [];
    const selectedOptionIndex = rawAnswer === undefined || rawAnswer === "" ? null : Number(rawAnswer);
    const correctOptionIndex = question.correctOptionIndex;
    const isAutoGraded = question.type === "MULTIPLE_CHOICE";
    const isCorrect = isAutoGraded ? selectedOptionIndex !== null && correctOptionIndex !== null && selectedOptionIndex === correctOptionIndex : null;

    return {
      questionId: question.id,
      order: question.order,
      prompt: question.prompt,
      type: question.type,
      points: question.points,
      options,
      selectedOptionIndex: Number.isFinite(selectedOptionIndex) ? selectedOptionIndex : null,
      selectedAnswer: Number.isFinite(selectedOptionIndex) && selectedOptionIndex !== null ? options[selectedOptionIndex] ?? null : rawAnswer ?? null,
      correctOptionIndex,
      correctAnswer: correctOptionIndex !== null ? options[correctOptionIndex] ?? null : null,
      isCorrect,
      earnedPoints: isCorrect ? question.points : 0
    };
  });
  const autoGradedPoints = multipleChoiceQuestions.reduce((total, question) => total + question.points, 0);
  const earnedPoints = details.reduce((total, detail) => total + detail.earnedPoints, 0);
  const totalPoints = questions.reduce((total, question) => total + question.points, 0);
  const hasWrittenQuestions = details.some((detail) => detail.type === "SHORT_TEXT");

  return {
    earnedPoints,
    autoGradedPoints,
    totalPoints,
    manualGradedPoints: 0,
    isFullyGraded: !hasWrittenQuestions,
    percentage: !hasWrittenQuestions && autoGradedPoints ? Math.round((earnedPoints / autoGradedPoints) * 100) : null,
    correctCount: details.filter((detail) => detail.isCorrect === true).length,
    totalAutoGraded: multipleChoiceQuestions.length,
    details
  };
};

export class ReportService {
  static async generate(sessionId: string, generatedById?: string, answers: Record<string, string> = {}) {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        student: { select: { id: true, name: true, email: true, matricNumber: true, department: true } },
        exam: { include: { questions: { orderBy: { order: "asc" } } } },
        events: { orderBy: { timestamp: "asc" } },
        evidence: { orderBy: { createdAt: "asc" } },
        alerts: { orderBy: { createdAt: "desc" } }
      }
    });

    if (!session) {
      throw new ApiError(404, "Session not found");
    }

    const existingReport = await prisma.report.findUnique({ where: { sessionId } });
    const existingReportJson = existingReport?.reportJson as { grading?: unknown } | null | undefined;
    const highSeverityEvents = session.events.filter((event) => ["HIGH", "CRITICAL"].includes(event.severity)).length;
    const eventBreakdown = session.events.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] ?? 0) + 1;
      return acc;
    }, {});
    const suspiciousTimeline = session.events
      .filter((event) => event.severity !== "INFO" || event.eventType !== "FACE_PRESENT")
      .map((event) => ({
        eventType: event.eventType,
        severity: event.severity,
        message: event.message,
        timestamp: event.timestamp
      }));

    const recommendation = recommendationFor(session.riskScore);
    const grading = Object.keys(answers).length ? gradeAnswers(session.exam.questions, answers) : existingReportJson?.grading ?? gradeAnswers(session.exam.questions, answers);
    const summary = `Session for ${session.student.name} ended with ${session.riskLevel} risk (${session.riskScore}/100), ${session.events.length} monitoring events, and ${session.alerts.length} alerts.`;
    const reportJson = {
      student: session.student,
      exam: {
        id: session.exam.id,
        title: session.exam.title,
        durationMinutes: session.exam.durationMinutes,
        startTime: session.exam.startTime,
        endTime: session.exam.endTime,
        questions: session.exam.questions.map((question) => ({
          id: question.id,
          order: question.order,
          prompt: question.prompt,
          type: question.type,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          points: question.points
        }))
      },
      grading,
      session: {
        id: session.id,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        status: session.status,
        permissions: session.permissions,
        deviceInfo: session.deviceInfo
      },
      risk: {
        score: session.riskScore,
        level: session.riskLevel,
        recommendation
      },
      counters: {
        tabSwitchCount: session.tabSwitchCount,
        faceMissingCount: session.faceMissingCount,
        multipleFaceCount: session.multipleFaceCount,
        copyPasteCount: session.copyPasteCount,
        fullscreenExitCount: session.fullscreenExitCount
      },
      eventBreakdown,
      suspiciousTimeline,
      evidence: session.evidence.map((item) => ({
        id: item.id,
        type: item.type,
        fileUrl: item.fileUrl,
        fileName: item.fileName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        createdAt: item.createdAt
      })),
      alerts: session.alerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        severity: alert.severity,
        status: alert.status,
        createdAt: alert.createdAt
      }))
    };

    return prisma.report.upsert({
      where: { sessionId },
      update: {
        generatedById,
        summary,
        riskScore: session.riskScore,
        riskLevel: session.riskLevel,
        totalEvents: session.events.length,
        highSeverityEvents,
        recommendation,
        reportJson: reportJson as Prisma.InputJsonValue
      },
      create: {
        sessionId,
        generatedById,
        summary,
        riskScore: session.riskScore,
        riskLevel: session.riskLevel,
        totalEvents: session.events.length,
        highSeverityEvents,
        recommendation,
        reportJson: reportJson as Prisma.InputJsonValue
      }
    });
  }

  static async getForSession(sessionId: string, user: { id: string; role: UserRole }) {
    const report = await prisma.report.findUnique({
      where: { sessionId },
      include: { session: { include: { exam: true, student: { select: { id: true, name: true, email: true } } } } }
    });
    if (!report) {
      throw new ApiError(404, "Report not found");
    }
    if (user.role === "EXAMINER" && report.session.exam.createdById !== user.id) {
      throw new ApiError(403, "You do not have access to this report");
    }
    return report;
  }

  static async gradeWrittenAnswers(
    sessionId: string,
    user: { id: string; role: UserRole },
    grades: Array<{ questionId: string; score: number; feedback?: string }>
  ) {
    const report = await prisma.report.findUnique({
      where: { sessionId },
      include: { session: { include: { exam: { include: { questions: true } }, student: { select: { id: true, name: true, email: true, matricNumber: true } } } } }
    });
    if (!report) {
      throw new ApiError(404, "Report not found");
    }
    if (user.role === "EXAMINER" && report.session.exam.createdById !== user.id) {
      throw new ApiError(403, "You do not have access to grade this report");
    }

    const reportJson = report.reportJson as {
      grading?: {
        details?: Array<Record<string, unknown> & { questionId: string; type: string; points: number; earnedPoints?: number }>;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    const grading = reportJson.grading;
    if (!grading?.details) {
      throw new ApiError(400, "This report has no answer details to grade");
    }

    const gradeMap = new Map(grades.map((grade) => [grade.questionId, grade]));
    const details = grading.details.map((detail) => {
      if (detail.type !== "SHORT_TEXT") return detail;
      const grade = gradeMap.get(detail.questionId);
      if (!grade) return detail;
      const maxPoints = Number(detail.points ?? 0);
      const score = Math.max(0, Math.min(Number(grade.score), maxPoints));
      return {
        ...detail,
        manualScore: score,
        manualFeedback: grade.feedback?.trim() || null,
        earnedPoints: score,
        isCorrect: null
      };
    });
    const earnedPoints = details.reduce((total, detail) => total + Number(detail.earnedPoints ?? 0), 0);
    const totalPoints = details.reduce((total, detail) => total + Number(detail.points ?? 0), 0);
    const manualGradedPoints = details.filter((detail) => detail.type === "SHORT_TEXT").reduce((total, detail) => total + Number(detail.earnedPoints ?? 0), 0);
    const isFullyGraded = details.every((detail) => detail.type !== "SHORT_TEXT" || typeof detail.manualScore === "number");
    const nextReportJson = {
      ...reportJson,
      grading: {
        ...grading,
        details,
        earnedPoints,
        totalPoints,
        manualGradedPoints,
        isFullyGraded,
        percentage: totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : null
      }
    };

    return prisma.report.update({
      where: { id: report.id },
      data: { reportJson: nextReportJson as Prisma.InputJsonValue },
      include: {
        session: {
          include: {
            exam: true,
            student: { select: { id: true, name: true, email: true, matricNumber: true } }
          }
        }
      }
    });
  }

  static async list(filters: { examId?: string; riskLevel?: string; dateFrom?: string; dateTo?: string }, user: { id: string; role: UserRole }) {
    return prisma.report.findMany({
      where: {
        riskLevel: filters.riskLevel as never,
        createdAt: {
          gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
          lte: filters.dateTo ? new Date(filters.dateTo) : undefined
        },
        session: {
          examId: filters.examId,
          ...(user.role === "EXAMINER" ? { exam: { createdById: user.id } } : {})
        }
      },
      include: {
        session: {
          include: {
            exam: true,
            student: { select: { id: true, name: true, email: true, matricNumber: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
