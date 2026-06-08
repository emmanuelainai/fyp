import type { ExamStatus, Prisma, QuestionType, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { examSettingsSchema } from "../validators/examValidators";

export class ExamService {
  static normalizeSettings(settings?: unknown) {
    return examSettingsSchema.parse(settings ?? {});
  }

  static async create(createdById: string, input: {
    title: string;
    description?: string;
    durationMinutes: number;
    startTime: Date;
    endTime: Date;
    status?: ExamStatus;
    settings?: unknown;
    questions?: { prompt: string; type?: QuestionType; options?: string[]; correctOptionIndex?: number; points?: number }[];
  }) {
    if (input.endTime <= input.startTime) {
      throw new ApiError(400, "Exam end time must be after start time");
    }

    return prisma.exam.create({
      data: {
        title: input.title,
        description: input.description,
        durationMinutes: input.durationMinutes,
        startTime: input.startTime,
        endTime: input.endTime,
        status: input.status ?? "SCHEDULED",
        settings: this.normalizeSettings(input.settings) as Prisma.InputJsonValue,
        createdById,
        questions: {
          create: (input.questions?.length ? input.questions : [{ prompt: "Answer the exam question provided by your examiner.", points: 1 }]).map((question, index) => ({
            prompt: question.prompt,
            type: question.type ?? "SHORT_TEXT",
            options: question.type === "MULTIPLE_CHOICE" ? (question.options ?? []) : undefined,
            correctOptionIndex: question.type === "MULTIPLE_CHOICE" ? question.correctOptionIndex : undefined,
            points: question.points ?? 1,
            order: index + 1
          }))
        }
      },
      include: { questions: { orderBy: { order: "asc" } } }
    });
  }

  static async listForUser(user: { id: string; role: UserRole }) {
    if (user.role === "ADMIN") {
      return prisma.exam.findMany({
        include: { createdBy: { select: { id: true, name: true, email: true, role: true } }, assignments: true, questions: { orderBy: { order: "asc" } } },
        orderBy: { startTime: "desc" }
      });
    }

    if (user.role === "EXAMINER") {
      return prisma.exam.findMany({
        where: { createdById: user.id },
        include: { assignments: true, questions: { orderBy: { order: "asc" } } },
        orderBy: { startTime: "desc" }
      });
    }

    return prisma.exam.findMany({
      where: { assignments: { some: { studentId: user.id } } },
      include: {
        assignments: { where: { studentId: user.id } },
        questions: { orderBy: { order: "asc" } },
        sessions: { where: { studentId: user.id }, include: { report: true }, orderBy: { startedAt: "desc" } }
      },
      orderBy: { startTime: "desc" }
    });
  }

  static async getAccessible(examId: string, user: { id: string; role: UserRole }) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        assignments: {
          include: { student: { select: { id: true, name: true, email: true, matricNumber: true, department: true } } }
        },
        questions: { orderBy: { order: "asc" } }
      }
    });

    if (!exam) {
      throw new ApiError(404, "Exam not found");
    }

    const allowed =
      user.role === "ADMIN" ||
      exam.createdById === user.id ||
      exam.assignments.some((assignment) => assignment.studentId === user.id);

    if (!allowed) {
      throw new ApiError(403, "You do not have access to this exam");
    }

    return exam;
  }

  static async update(examId: string, user: { id: string; role: UserRole }, input: Record<string, unknown>) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      throw new ApiError(404, "Exam not found");
    }
    if (user.role !== "ADMIN" && exam.createdById !== user.id) {
      throw new ApiError(403, "Only the creator or an admin can update this exam");
    }

    const data: Prisma.ExamUpdateInput = { ...input };
    if (input.settings) {
      data.settings = this.normalizeSettings(input.settings) as Prisma.InputJsonValue;
    }
    if (input.endTime && input.startTime && new Date(input.endTime as string) <= new Date(input.startTime as string)) {
      throw new ApiError(400, "Exam end time must be after start time");
    }

    return prisma.exam.update({ where: { id: examId }, data });
  }

  static async remove(examId: string, user: { id: string; role: UserRole }) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      throw new ApiError(404, "Exam not found");
    }
    if (user.role !== "ADMIN" && exam.createdById !== user.id) {
      throw new ApiError(403, "Only the creator or an admin can delete this exam");
    }
    return prisma.exam.delete({ where: { id: examId } });
  }

  static async assignStudents(
    examId: string,
    identifiers: { studentIds?: string[]; matricNumbers?: string[]; departments?: string[] },
    user: { id: string; role: UserRole }
  ) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      throw new ApiError(404, "Exam not found");
    }
    if (user.role !== "ADMIN" && exam.createdById !== user.id) {
      throw new ApiError(403, "Only the creator or an admin can assign students");
    }

    const matricNumbers = identifiers.matricNumbers?.map((value) => value.trim()).filter(Boolean) ?? [];
    const departments = identifiers.departments?.map((value) => value.trim()).filter(Boolean) ?? [];
    const studentIds = identifiers.studentIds ?? [];
    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        isActive: true,
        OR: [
          ...(studentIds.length ? [{ id: { in: studentIds } }] : []),
          ...(matricNumbers.length ? [{ matricNumber: { in: matricNumbers, mode: "insensitive" as const } }] : []),
          ...(departments.length ? [{ department: { in: departments } }] : [])
        ]
      },
      select: { id: true, matricNumber: true, department: true }
    });
    const expectedCount = studentIds.length + matricNumbers.length;
    const matchedDirectStudents = students.filter(
      (student) => studentIds.includes(student.id) || (student.matricNumber ? matricNumbers.some((value) => value.toLowerCase() === student.matricNumber?.toLowerCase()) : false)
    );
    if (matchedDirectStudents.length !== expectedCount) {
      throw new ApiError(400, "One or more student matric numbers are invalid");
    }
    const resolvedStudentIds = students.map((student) => student.id);

    await prisma.$transaction(
      resolvedStudentIds.map((studentId) =>
        prisma.examAssignment.upsert({
          where: { examId_studentId: { examId, studentId } },
          create: { examId, studentId },
          update: { status: "ASSIGNED" }
        })
      )
    );

    return prisma.examAssignment.findMany({
      where: { examId },
      include: { student: { select: { id: true, name: true, email: true, matricNumber: true, department: true } } }
    });
  }

  static async assignments(examId: string, user: { id: string; role: UserRole }) {
    await this.getAccessible(examId, user);
    return prisma.examAssignment.findMany({
      where: { examId },
      include: { student: { select: { id: true, name: true, email: true, matricNumber: true, department: true } } },
      orderBy: { createdAt: "desc" }
    });
  }
}
