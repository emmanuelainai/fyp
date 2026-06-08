import { z } from "zod";
import { departments } from "../constants/departments";

const departmentValues = departments as unknown as [string, ...string[]];

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  matricNumber: z.string().optional(),
  department: z.enum(departmentValues).optional(),
  role: z.enum(["STUDENT", "EXAMINER", "ADMIN"]).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const verifyRegistrationSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits")
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  newPassword: z.string().min(8)
});
