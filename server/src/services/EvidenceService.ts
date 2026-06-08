import path from "path";
import fs from "fs/promises";
import type { EvidenceType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { emitToExam, emitToSession } from "../sockets/SocketService";
import { MonitoringService } from "./MonitoringService";

export class EvidenceService {
  static async create(sessionId: string, user: { id: string; role: UserRole }, file: Express.Multer.File | undefined, input: {
    type: EvidenceType;
    eventId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const session = await MonitoringService.assertSessionAccess(sessionId, user, user.role === "STUDENT");
    if (!file) {
      throw new ApiError(400, "Evidence file is required");
    }
    if (!file.mimetype.startsWith("image/") && input.type !== "REPORT_FILE") {
      await fs.unlink(file.path).catch(() => undefined);
      throw new ApiError(400, "Only report evidence may use non-image file uploads");
    }
    if (user.role === "STUDENT" && session.status !== "ACTIVE") {
      throw new ApiError(400, "Evidence can only be uploaded for active sessions");
    }

    const publicPath = path.posix.join("/", env.UPLOAD_DIR, "evidence", file.filename);
    const event = await prisma.monitoringEvent.create({
      data: {
        sessionId,
        eventType: "SCREENSHOT_CAPTURED",
        severity: "INFO",
        message: `${input.type.replaceAll("_", " ").toLowerCase()} evidence captured`,
        metadata: {
          originalName: file.originalname,
          type: input.type,
          ...(input.metadata ?? {})
        } as Prisma.InputJsonValue
      }
    });

    const evidence = await prisma.evidence.create({
      data: {
        sessionId,
        eventId: input.eventId ?? event.id,
        type: input.type,
        fileUrl: publicPath,
        fileName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        metadata: input.metadata as Prisma.InputJsonValue | undefined
      }
    });

    emitToSession(sessionId, "event:new", event);
    emitToExam(session.examId, "event:new", { event, sessionId });
    emitToSession(sessionId, "evidence:new", evidence);
    emitToExam(session.examId, "evidence:new", evidence);
    return { evidence, event };
  }

  static async list(sessionId: string, user: { id: string; role: UserRole }) {
    const session = await MonitoringService.assertSessionAccess(sessionId, user, false);
    if (user.role === "STUDENT") {
      throw new ApiError(403, "Students cannot view evidence listings");
    }
    return prisma.evidence.findMany({
      where: { sessionId },
      include: { event: true },
      orderBy: { createdAt: "desc" }
    });
  }
}
