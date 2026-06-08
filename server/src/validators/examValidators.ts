import { z } from "zod";
import { departments } from "../constants/departments";

const departmentValues = departments as unknown as [string, ...string[]];

export const examSettingsSchema = z.object({
  requireWebcam: z.boolean().default(true),
  requireFullscreen: z.boolean().default(true),
  allowCalculator: z.boolean().default(false),
  allowTabSwitches: z.boolean().default(false),
  maxTabSwitches: z.number().int().min(0).default(3),
  screenshotIntervalSeconds: z.number().int().min(15).max(900).default(60),
  enableFacePresence: z.boolean().default(true),
  enableMultipleFaceDetection: z.boolean().default(true),
  enableGazeDetection: z.boolean().default(false),
  enableAudioMonitoring: z.boolean().default(false)
});

export const examQuestionSchema = z
  .object({
    prompt: z.string().min(3),
    type: z.enum(["SHORT_TEXT", "MULTIPLE_CHOICE"]).default("SHORT_TEXT"),
    options: z.array(z.string().trim().min(1)).min(2).max(8).optional(),
    correctOptionIndex: z.number().int().min(0).optional(),
    points: z.number().int().min(1).max(100).default(1)
  })
  .superRefine((question, context) => {
    if (question.type !== "MULTIPLE_CHOICE") return;

    if (!question.options?.length || question.options.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Multiple choice questions need at least two options"
      });
    }

    if (question.correctOptionIndex === undefined || question.correctOptionIndex >= (question.options?.length ?? 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctOptionIndex"],
        message: "Select a valid correct option"
      });
    }
  });

export const createExamSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(1).max(600),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  settings: examSettingsSchema.partial().optional(),
  questions: z
    .array(examQuestionSchema)
    .min(1, "Create at least one question")
    .optional()
});

export const updateExamSchema = createExamSchema.partial();

export const assignStudentsSchema = z
  .object({
    studentIds: z.array(z.string().uuid()).min(1).optional(),
    matricNumbers: z.array(z.string().min(1)).min(1).optional(),
    departments: z.array(z.enum(departmentValues)).min(1).optional()
  })
  .refine((value) => Boolean(value.studentIds?.length || value.matricNumbers?.length || value.departments?.length), {
    message: "Provide at least one student matric number or department"
  });
