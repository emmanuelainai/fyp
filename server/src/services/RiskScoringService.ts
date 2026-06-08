import type { MonitoringEvent, MonitoringEventType, Severity } from "@prisma/client";
import { prisma } from "../config/prisma";

export const EVENT_WEIGHTS: Record<MonitoringEventType, number> = {
  SESSION_STARTED: 0,
  SESSION_ENDED: 0,
  CONSENT_ACCEPTED: 0,
  PERMISSION_GRANTED: 0,
  PERMISSION_DENIED: 25,
  FACE_PRESENT: 0,
  FACE_MISSING: 5,
  MULTIPLE_FACES: 20,
  TAB_SWITCH: 15,
  WINDOW_BLUR: 8,
  WINDOW_FOCUS: 0,
  FULLSCREEN_EXIT: 15,
  FULLSCREEN_ENTER: 0,
  COPY_ATTEMPT: 10,
  PASTE_ATTEMPT: 10,
  RIGHT_CLICK: 5,
  SCREENSHOT_CAPTURED: 0,
  SUSPICIOUS_BEHAVIOR: 20,
  AI_ANALYSIS: 0,
  SYSTEM_WARNING: 5
};

export const calculateIncrement = (eventType: MonitoringEventType, recentSameEventCount = 0) => {
  const base = EVENT_WEIGHTS[eventType] ?? 0;
  if (eventType === "FACE_MISSING" && recentSameEventCount >= 3) {
    return base + 10;
  }
  return base;
};

export const classifyRisk = (score: number) => {
  if (score >= 76) return "CRITICAL" as const;
  if (score >= 51) return "HIGH" as const;
  if (score >= 26) return "MEDIUM" as const;
  return "LOW" as const;
};

export const shouldCreateRiskAlert = (oldScore: number, newScore: number, eventType: MonitoringEventType, severity: Severity) => {
  const oldLevel = classifyRisk(oldScore);
  const newLevel = classifyRisk(newScore);
  return (
    severity === "HIGH" ||
    severity === "CRITICAL" ||
    eventType === "MULTIPLE_FACES" ||
    newLevel === "HIGH" ||
    newLevel === "CRITICAL" ||
    oldLevel !== newLevel
  );
};

const alertSeverityForScore = (score: number, eventSeverity: Severity): Severity => {
  if (eventSeverity === "CRITICAL") return "CRITICAL";
  if (score >= 76) return "CRITICAL";
  if (eventSeverity === "HIGH" || score >= 51) return "HIGH";
  if (score >= 26) return "MEDIUM";
  return "LOW";
};

export class RiskScoringService {
  static async applyEvent(event: MonitoringEvent) {
    const session = await prisma.examSession.findUnique({ where: { id: event.sessionId } });
    if (!session) {
      throw new Error("Session not found for risk scoring");
    }

    const since = new Date(Date.now() - 2 * 60 * 1000);
    const recentSameEventCount = await prisma.monitoringEvent.count({
      where: {
        sessionId: event.sessionId,
        eventType: event.eventType,
        timestamp: { gte: since }
      }
    });

    const increment = calculateIncrement(event.eventType, recentSameEventCount);
    const newScore = Math.min(100, session.riskScore + increment);
    const newLevel = classifyRisk(newScore);

    const updated = await prisma.examSession.update({
      where: { id: event.sessionId },
      data: {
        riskScore: newScore,
        riskLevel: newLevel,
        tabSwitchCount: event.eventType === "TAB_SWITCH" ? { increment: 1 } : undefined,
        faceMissingCount: event.eventType === "FACE_MISSING" ? { increment: 1 } : undefined,
        multipleFaceCount: event.eventType === "MULTIPLE_FACES" ? { increment: 1 } : undefined,
        copyPasteCount: ["COPY_ATTEMPT", "PASTE_ATTEMPT"].includes(event.eventType) ? { increment: 1 } : undefined,
        fullscreenExitCount: event.eventType === "FULLSCREEN_EXIT" ? { increment: 1 } : undefined
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        exam: true
      }
    });

    let alert = null;
    if (increment > 0 && shouldCreateRiskAlert(session.riskScore, newScore, event.eventType, event.severity)) {
      const severity = alertSeverityForScore(newScore, event.severity);
      alert = await prisma.alert.create({
        data: {
          sessionId: event.sessionId,
          eventId: event.id,
          severity,
          title: `${event.eventType.replaceAll("_", " ")} detected`,
          description: `${event.message}. Current risk score is ${newScore}.`
        }
      });
    }

    return { session: updated, alert, increment };
  }
}
