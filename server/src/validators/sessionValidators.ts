import { z } from "zod";

export const startSessionSchema = z.object({
  examId: z.string().uuid(),
  consentAccepted: z.literal(true),
  permissions: z.object({
    cameraGranted: z.boolean().default(false),
    fullscreenGranted: z.boolean().default(false),
    notificationGranted: z.boolean().default(false)
  }),
  deviceInfo: z.record(z.unknown()).default({})
});

export const endSessionSchema = z.object({
  answers: z.record(z.string()).default({})
});

export const eventSchema = z.object({
  eventType: z.enum([
    "SESSION_STARTED",
    "SESSION_ENDED",
    "CONSENT_ACCEPTED",
    "PERMISSION_GRANTED",
    "PERMISSION_DENIED",
    "FACE_PRESENT",
    "FACE_MISSING",
    "MULTIPLE_FACES",
    "TAB_SWITCH",
    "WINDOW_BLUR",
    "WINDOW_FOCUS",
    "FULLSCREEN_EXIT",
    "FULLSCREEN_ENTER",
    "COPY_ATTEMPT",
    "PASTE_ATTEMPT",
    "RIGHT_CLICK",
    "SCREENSHOT_CAPTURED",
    "SUSPICIOUS_BEHAVIOR",
    "AI_ANALYSIS",
    "SYSTEM_WARNING"
  ]),
  severity: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("INFO"),
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.coerce.date().optional()
});

export const evidenceMetadataSchema = z.object({
  type: z.enum(["SCREENSHOT", "WEBCAM_FRAME", "REPORT_FILE", "OTHER"]).default("SCREENSHOT"),
  metadata: z.string().optional(),
  eventId: z.string().uuid().optional()
});

export const resolveAlertSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED", "REVIEWING"]).default("RESOLVED"),
  resolutionNote: z.string().min(2).optional()
});
