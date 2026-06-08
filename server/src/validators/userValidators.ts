import { z } from "zod";
import { departments } from "../constants/departments";

const departmentValues = departments as unknown as [string, ...string[]];

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["STUDENT", "EXAMINER", "ADMIN"]).optional(),
  matricNumber: z.string().nullable().optional(),
  department: z.enum(departmentValues).nullable().optional(),
  isActive: z.boolean().optional()
});
