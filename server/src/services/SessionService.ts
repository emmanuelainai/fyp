import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { emitToExam, emitToSession } from "../sockets/SocketService";
import { ReportService } from "./ReportService";

type PermissionPayload = {
  cameraGranted: boolean;
  fullscreenGranted: boolean;
  notificationGranted: boolean;
};

export class SessionService {
  static async start(input: {
    examId: string;
    studentId: string;
    consentAccepted: true;
    permissions: PermissionPayload;
    deviceInfo: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const assignment = await prisma.examAssignment.findUnique({
      where: { examId_studentId: { examId: input.examId, studentId: input.studentId } },
      include: { exam: true }
    });
    if (!assignment) {
      throw new ApiError(403, "You are not assigned to this exam");
    }

    const now = new Date();
    if (assignment.exam.status === "CANCELLED" || assignment.exam.status === "COMPLETED" || assignment.exam.status === "DRAFT") {
      throw new ApiError(400, "This exam is not available to start");
    }
    if (now < assignment.exam.startTime || now > assignment.exam.endTime) {
      throw new ApiError(400, "This exam can only be started during the scheduled time window");
    }

    const settings = assignment.exam.settings as Record<string, unknown>;
    if (settings.requireWebcam !== false && !input.permissions.cameraGranted) {
      throw new ApiError(400, "Camera permission is required for this exam");
    }
    if (settings.requireFullscreen !== false && !input.permissions.fullscreenGranted) {
      throw new ApiError(400, "Fullscreen permission is required for this exam");
    }

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.examSession.create({
        data: {
          examId: input.examId,
          studentId: input.studentId,
          status: "ACTIVE",
          consentAccepted: input.consentAccepted,
          permissions: input.permissions as Prisma.InputJsonValue,
          deviceInfo: input.deviceInfo as Prisma.InputJsonValue,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent
        },
        include: {
          student: { select: { id: true, name: true, email: true, matricNumber: true } },
          exam: { include: { questions: { orderBy: { order: "asc" } } } }
        }
      });

      await tx.examAssignment.update({
        where: { examId_studentId: { examId: input.examId, studentId: input.studentId } },
        data: { status: "STARTED" }
      });

      await tx.monitoringEvent.createMany({
        data: [
          {
            sessionId: created.id,
            eventType: "CONSENT_ACCEPTED",
            severity: "INFO",
            message: "Student accepted exam monitoring consent"
          },
          {
            sessionId: created.id,
            eventType: "SESSION_STARTED",
            severity: "INFO",
            message: "Exam monitoring session started"
          },
          {
            sessionId: created.id,
            eventType: "PERMISSION_GRANTED",
            severity: "INFO",
            message: "Required browser monitoring permissions were granted",
            metadata: input.permissions as Prisma.InputJsonValue
          }
        ]
      });

      return created;
    });

    emitToExam(input.examId, "session:started", session);
    emitToSession(session.id, "session:started", session);

    return session;
  }

  static async end(sessionId: string, user: { id: string; role: UserRole }, status: "SUBMITTED" | "TERMINATED" = "SUBMITTED", answers: Record<string, string> = {}) {
    const existing = await prisma.examSession.findUnique({ where: { id: sessionId }, include: { exam: true } });
    if (!existing) {
      throw new ApiError(404, "Session not found");
    }

    const allowed = user.role === "ADMIN" || existing.studentId === user.id || (user.role === "EXAMINER" && existing.exam.createdById === user.id);
    if (!allowed) {
      throw new ApiError(403, "You do not have access to end this session");
    }

    const ended = await prisma.$transaction(async (tx) => {
      const updated = await tx.examSession.update({
        where: { id: sessionId },
        data: {
          endedAt: new Date(),
          status,
          riskLevel: existing.riskLevel
        },
        include: {
          student: { select: { id: true, name: true, email: true, matricNumber: true } },
          exam: { include: { questions: { orderBy: { order: "asc" } } } }
        }
      });

      await tx.examAssignment.updateMany({
        where: { examId: existing.examId, studentId: existing.studentId },
        data: { status: status === "SUBMITTED" ? "SUBMITTED" : "FLAGGED" }
      });

      await tx.monitoringEvent.create({
        data: {
          sessionId,
          eventType: "SESSION_ENDED",
          severity: "INFO",
          message: status === "SUBMITTED" ? "Student submitted the exam" : "Session was terminated"
        }
      });

      return updated;
    });

    const report = await ReportService.generate(sessionId, user.role === "STUDENT" ? undefined : user.id, answers);
    emitToExam(ended.examId, "session:ended", { session: ended, report });
    emitToSession(sessionId, "session:ended", { session: ended, report });
    return { session: ended, report };
  }

  static async getAccessible(sessionId: string, user: { id: string; role: UserRole }) {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        student: { select: { id: true, name: true, email: true, matricNumber: true, department: true } },
        exam: { include: { questions: { orderBy: { order: "asc" } } } },
        report: true
      }
    });
    if (!session) {
      throw new ApiError(404, "Session not found");
    }

    const allowed = user.role === "ADMIN" || session.studentId === user.id || (user.role === "EXAMINER" && session.exam.createdById === user.id);
    if (!allowed) {
      throw new ApiError(403, "You do not have access to this session");
    }

    return session;
  }

  static async list(filters: { examId?: string; status?: string; riskLevel?: string; studentId?: string }, user: { id: string; role: UserRole }) {
    return prisma.examSession.findMany({
      where: {
        examId: filters.examId,
        status: filters.status as never,
        riskLevel: filters.riskLevel as never,
        studentId: filters.studentId,
        ...(user.role === "EXAMINER" ? { exam: { createdById: user.id } } : {})
      },
      include: {
        student: { select: { id: true, name: true, email: true, matricNumber: true } },
        exam: { include: { questions: { orderBy: { order: "asc" } } } },
        alerts: { where: { status: { in: ["OPEN", "REVIEWING"] } } }
      },
      orderBy: { startedAt: "desc" }
    });
  }
}
