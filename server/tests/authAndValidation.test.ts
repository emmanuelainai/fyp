import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { AuthService } from "../src/services/AuthService";
import { canAccessRole } from "../src/middlewares/auth";
import { startSessionSchema, eventSchema } from "../src/validators/sessionValidators";

describe("auth helpers and request validation", () => {
  it("hashes and verifies passwords for login/register flows", async () => {
    const hash = await AuthService.hashPassword("Student123!");
    await expect(AuthService.verifyPassword("Student123!", hash)).resolves.toBe(true);
    await expect(AuthService.verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("enforces role checks", () => {
    expect(canAccessRole(UserRole.ADMIN, [UserRole.ADMIN])).toBe(true);
    expect(canAccessRole(UserRole.STUDENT, [UserRole.EXAMINER, UserRole.ADMIN])).toBe(false);
  });

  it("validates session start consent and permissions payload", () => {
    const parsed = startSessionSchema.parse({
      examId: "00000000-0000-4000-8000-000000000001",
      consentAccepted: true,
      permissions: {
        cameraGranted: true,
        fullscreenGranted: true,
        notificationGranted: false
      },
      deviceInfo: { browser: "vitest" }
    });

    expect(parsed.consentAccepted).toBe(true);
    expect(() =>
      startSessionSchema.parse({
        examId: "00000000-0000-4000-8000-000000000001",
        consentAccepted: false,
        permissions: {}
      })
    ).toThrow();
  });

  it("validates monitoring event submission payloads", () => {
    const parsed = eventSchema.parse({
      eventType: "TAB_SWITCH",
      severity: "MEDIUM",
      message: "Page visibility changed"
    });

    expect(parsed.eventType).toBe("TAB_SWITCH");
    expect(() => eventSchema.parse({ eventType: "UNKNOWN", message: "bad" })).toThrow();
  });
});
