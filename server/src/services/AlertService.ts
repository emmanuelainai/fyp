import type { Severity, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";

export class AlertService {
  static async list(filters: { examId?: string; sessionId?: string; severity?: Severity; status?: string }, user: { id: string; role: UserRole }) {
    return prisma.alert.findMany({
      where: {
        severity: filters.severity,
        status: filters.status as never,
        sessionId: filters.sessionId,
        session: {
          examId: filters.examId,
          ...(user.role === "EXAMINER" ? { exam: { createdById: user.id } } : {})
        }
      },
      include: {
        session: { include: { student: { select: { id: true, name: true, email: true, matricNumber: true } }, exam: true } },
        event: true,
        resolvedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async get(id: string, user: { id: string; role: UserRole }) {
    const alert = await prisma.alert.findUnique({
      where: { id },
      include: {
        session: { include: { student: { select: { id: true, name: true, email: true, matricNumber: true } }, exam: true } },
        event: true,
        resolvedBy: { select: { id: true, name: true, email: true } }
      }
    });
    if (!alert) {
      throw new ApiError(404, "Alert not found");
    }
    if (user.role === "EXAMINER" && alert.session.exam.createdById !== user.id) {
      throw new ApiError(403, "You do not have access to this alert");
    }
    return alert;
  }

  static async resolve(id: string, userId: string, input: { status: "RESOLVED" | "DISMISSED" | "REVIEWING"; resolutionNote?: string }) {
    return prisma.alert.update({
      where: { id },
      data: {
        status: input.status,
        resolutionNote: undefined,
        resolvedById: input.status === "REVIEWING" ? undefined : userId
      },
      include: { session: true, event: true }
    });
  }
}
