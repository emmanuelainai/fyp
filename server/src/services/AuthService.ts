import bcrypt from "bcrypt";
import crypto from "crypto";
import type { UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { signToken } from "../middlewares/auth";
import { toPublicUser } from "../utils/publicUser";
import { EmailService } from "./EmailService";

type RegistrationPayload = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  matricNumber?: string;
  department?: string;
};

const codeExpiresAt = () => new Date(Date.now() + 10 * 60 * 1000);
const generateCode = () => crypto.randomInt(100000, 1000000).toString();
const devCodeFor = (code: string) => (process.env.NODE_ENV === "production" || EmailService.isConfigured() ? undefined : code);

const emailDeliveryFor = (result: { sent: boolean; reason?: string }) => ({
  sent: result.sent,
  configured: EmailService.isConfigured(),
  reason: result.reason,
  messageId: "messageId" in result ? result.messageId : undefined,
  accepted: "accepted" in result ? result.accepted : undefined,
  rejected: "rejected" in result ? result.rejected : undefined
});

const emailMessageFor = (sentMessage: string, unsentMessage: string, result: { sent: boolean }) => (result.sent ? sentMessage : unsentMessage);

const readRegistrationPayload = (payload: unknown): RegistrationPayload => {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Registration challenge is invalid");
  }

  const data = payload as Partial<RegistrationPayload>;
  if (!data.name || !data.email || !data.passwordHash || !data.role) {
    throw new ApiError(400, "Registration challenge is invalid");
  }

  return {
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    role: data.role,
    matricNumber: data.matricNumber,
    department: data.department
  };
};

export class AuthService {
  static async hashPassword(password: string) {
    return bcrypt.hash(password, env.BCRYPT_ROUNDS);
  }

  static async verifyPassword(password: string, passwordHash: string) {
    return bcrypt.compare(password, passwordHash);
  }

  static async register(input: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    matricNumber?: string;
    department?: string;
  }) {
    const email = input.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "Email is already registered");
    }

    const code = generateCode();
    const payload: RegistrationPayload = {
      name: input.name,
      email,
      passwordHash: await this.hashPassword(input.password),
      role: input.role ?? "STUDENT"
    };
    if (input.matricNumber) payload.matricNumber = input.matricNumber;
    if (input.department) payload.department = input.department;

    await prisma.authCode.updateMany({
      where: { email, purpose: "ACCOUNT_CREATION", consumedAt: null },
      data: { consumedAt: new Date() }
    });

    const challenge = await prisma.authCode.create({
      data: {
        email,
        purpose: "ACCOUNT_CREATION",
        codeHash: await bcrypt.hash(code, env.BCRYPT_ROUNDS),
        payload,
        expiresAt: codeExpiresAt()
      }
    });

    const emailResult = await EmailService.sendAccountVerificationCode(email, input.name, code);

    return {
      requiresEmailVerification: true,
      challengeId: challenge.id,
      email,
      devCode: devCodeFor(code),
      emailDelivery: emailDeliveryFor(emailResult),
      message: emailMessageFor(
        "A 6-digit account verification code was sent to your email address.",
        "Email delivery is not configured. Use the development code shown below, or configure SMTP in server/.env.",
        emailResult
      )
    };
  }

  static async verifyRegistration(challengeId: string, code: string) {
    const challenge = await prisma.authCode.findUnique({ where: { id: challengeId } });

    if (!challenge || challenge.purpose !== "ACCOUNT_CREATION" || challenge.consumedAt || challenge.expiresAt < new Date()) {
      throw new ApiError(401, "Verification code is invalid or expired");
    }

    const matches = await bcrypt.compare(code, challenge.codeHash);
    if (!matches) {
      throw new ApiError(401, "Verification code is invalid or expired");
    }

    const payload = readRegistrationPayload(challenge.payload);
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      await prisma.authCode.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      throw new ApiError(409, "Email is already registered");
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: payload.name,
          email: payload.email,
          passwordHash: payload.passwordHash,
          role: payload.role,
          matricNumber: payload.matricNumber,
          department: payload.department
        }
      });
      await tx.authCode.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      return created;
    });

    await EmailService.sendAccountCreated(user.email, user.name);

    return {
      token: signToken({ id: user.id, role: user.role, email: user.email }),
      user: toPublicUser(user)
    };
  }

  static async login(emailInput: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email: emailInput.toLowerCase() } });
    if (!user || !user.isActive) {
      throw new ApiError(401, "Invalid email or password");
    }

    const passwordMatches = await this.verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      throw new ApiError(401, "Invalid email or password");
    }

    return {
      token: signToken({ id: user.id, role: user.role, email: user.email }),
      user: toPublicUser(user)
    };
  }

  static async requestPasswordReset(emailInput: string) {
    const email = emailInput.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    const message = "If the email exists, a password reset code has been sent.";

    if (!user || !user.isActive) {
      return { message };
    }

    const code = generateCode();
    await prisma.authCode.updateMany({
      where: { email, purpose: "PASSWORD_RESET", consumedAt: null },
      data: { consumedAt: new Date() }
    });

    const challenge = await prisma.authCode.create({
      data: {
        email,
        purpose: "PASSWORD_RESET",
        codeHash: await bcrypt.hash(code, env.BCRYPT_ROUNDS),
        payload: { userId: user.id },
        expiresAt: codeExpiresAt()
      }
    });

    const emailResult = await EmailService.sendPasswordResetCode(user.email, user.name, code);

    return {
      message: emailMessageFor(message, "Email delivery is not configured. Use the development code shown below, or configure SMTP in server/.env.", emailResult),
      challengeId: challenge.id,
      email,
      emailDelivery: emailDeliveryFor(emailResult),
      devCode: devCodeFor(code)
    };
  }

  static async resetPassword(challengeId: string, code: string, newPassword: string) {
    const challenge = await prisma.authCode.findUnique({ where: { id: challengeId } });

    if (!challenge || challenge.purpose !== "PASSWORD_RESET" || challenge.consumedAt || challenge.expiresAt < new Date()) {
      throw new ApiError(401, "Verification code is invalid or expired");
    }

    const matches = await bcrypt.compare(code, challenge.codeHash);
    if (!matches) {
      throw new ApiError(401, "Verification code is invalid or expired");
    }

    const user = await prisma.user.findUnique({ where: { email: challenge.email } });
    if (!user || !user.isActive) {
      throw new ApiError(404, "User not found");
    }

    const passwordHash = await this.hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.authCode.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } })
    ]);
    await EmailService.sendPasswordChanged(user.email, user.name);

    return { message: "Password reset successfully" };
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new ApiError(404, "User not found");
    }

    const passwordMatches = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new ApiError(401, "Current password is incorrect");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.hashPassword(newPassword) }
    });
    await EmailService.sendPasswordChanged(user.email, user.name);

    return { message: "Password changed successfully" };
  }
}
