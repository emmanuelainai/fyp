import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { RiskScoringService } from "./RiskScoringService";
import { emitToExam, emitToSession } from "../sockets/SocketService";

export class MonitoringService {
  static async assertSessionAccess(sessionId: string, user: { id: string; role: UserRole }, studentWriteOnly = false) {
    const session = await prisma.examSession.findUnique({ where: { id: sessionId }, include: { exam: true } });
    if (!session) {
      throw new ApiError(404, "Session not found");
    }

    const allowed = user.role === "ADMIN" || session.studentId === user.id || (!studentWriteOnly && user.role === "EXAMINER" && session.exam.createdById === user.id);
    if (!allowed) {
      throw new ApiError(403, "You do not have access to this session");
    }

    return session;
  }

  static async logEvent(sessionId: string, user: { id: string; role: UserRole }, input: {
    eventType: string;
    severity: string;
    message: string;
    metadata?: Record<string, unknown>;
    timestamp?: Date;
  }) {
    const session = await this.assertSessionAccess(sessionId, user, user.role === "STUDENT");
    if (user.role === "STUDENT" && session.status !== "ACTIVE") {
      throw new ApiError(400, "Monitoring events can only be submitted for active sessions");
    }

    const event = await prisma.monitoringEvent.create({
      data: {
        sessionId,
        eventType: input.eventType as never,
        severity: input.severity as never,
        message: input.message,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        timestamp: input.timestamp ?? new Date()
      }
    });

    const risk = await RiskScoringService.applyEvent(event);
    emitToSession(sessionId, "event:new", event);
    emitToExam(session.examId, "event:new", { event, sessionId });
    emitToExam(session.examId, "risk:updated", risk.session);
    emitToSession(sessionId, "risk:updated", risk.session);

    if (risk.alert) {
      emitToExam(session.examId, "alert:new", risk.alert);
      emitToSession(sessionId, "alert:new", risk.alert);
    }

    return { event, session: risk.session, alert: risk.alert };
  }

  static async listEvents(sessionId: string, user: { id: string; role: UserRole }, query: { page?: number; limit?: number }) {
    await this.assertSessionAccess(sessionId, user, false);
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const [items, total] = await prisma.$transaction([
      prisma.monitoringEvent.findMany({
        where: { sessionId },
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.monitoringEvent.count({ where: { sessionId } })
    ]);
    return { items, total, page, limit };
  }
}
