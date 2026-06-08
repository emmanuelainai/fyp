import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://examsentinel:examsentinel@localhost:5432/examsentinel"),
  JWT_SECRET: z.string().min(16).default("dev-only-change-this-secret"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(10),
  ENABLE_SCREENSHOTS: z.coerce.boolean().default(true),
  ENABLE_AUDIO_MONITORING: z.coerce.boolean().default(false),
  ENABLE_AI_SERVICE: z.coerce.boolean().default(false),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default("noreply@examsentinel.local")
});

export const env = envSchema.parse(process.env);
