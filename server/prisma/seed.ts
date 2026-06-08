import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const passwordHash = async (password: string) => bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS ?? 10));

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@examsentinel.com" },
    update: {},
    create: {
      name: "ExamSentinel Admin",
      email: "admin@examsentinel.com",
      passwordHash: await passwordHash("Admin123!"),
      role: "ADMIN"
    }
  });

  const examiner = await prisma.user.upsert({
    where: { email: "examiner@examsentinel.com" },
    update: {},
    create: {
      name: "Sample Examiner",
      email: "examiner@examsentinel.com",
      passwordHash: await passwordHash("Examiner123!"),
      role: "EXAMINER",
      department: "Computer Science"
    }
  });

  const student = await prisma.user.upsert({
    where: { email: "student@examsentinel.com" },
    update: {},
    create: {
      name: "Sample Student",
      email: "student@examsentinel.com",
      passwordHash: await passwordHash("Student123!"),
      role: "STUDENT",
      matricNumber: "ESM/2026/001",
      department: "Computer Science"
    }
  });

  const now = new Date();
  const startTime = new Date(now.getTime() - 60 * 60 * 1000);
  const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const exam = await prisma.exam.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {
      startTime,
      endTime,
      status: "ACTIVE"
    },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Sample Secure Programming Exam",
      description: "A seeded exam for testing ExamSentinel monitoring.",
      durationMinutes: 90,
      startTime,
      endTime,
      status: "ACTIVE",
      createdById: examiner.id,
      settings: {
        requireWebcam: true,
        requireFullscreen: true,
        allowCalculator: false,
        allowTabSwitches: false,
        maxTabSwitches: 3,
        screenshotIntervalSeconds: 60,
        enableFacePresence: true,
        enableMultipleFaceDetection: true,
        enableGazeDetection: false,
        enableAudioMonitoring: false
      }
    }
  });

  await prisma.examQuestion.upsert({
    where: { examId_order: { examId: exam.id, order: 1 } },
    update: {
      prompt: "Explain two security benefits of hashing passwords before storage.",
      type: "SHORT_TEXT",
      options: undefined,
      correctOptionIndex: undefined,
      points: 5
    },
    create: {
      examId: exam.id,
      order: 1,
      prompt: "Explain two security benefits of hashing passwords before storage.",
      type: "SHORT_TEXT",
      points: 5
    }
  });

  await prisma.examQuestion.upsert({
    where: { examId_order: { examId: exam.id, order: 2 } },
    update: {
      prompt: "Describe how role-based access control helps an examination platform.",
      type: "SHORT_TEXT",
      options: undefined,
      correctOptionIndex: undefined,
      points: 5
    },
    create: {
      examId: exam.id,
      order: 2,
      prompt: "Describe how role-based access control helps an examination platform.",
      type: "SHORT_TEXT",
      points: 5
    }
  });

  await prisma.examQuestion.upsert({
    where: { examId_order: { examId: exam.id, order: 3 } },
    update: {
      prompt: "Which browser permission is required for webcam monitoring?",
      type: "MULTIPLE_CHOICE",
      options: ["Camera", "Clipboard contents", "Location", "Contacts"],
      correctOptionIndex: 0,
      points: 2
    },
    create: {
      examId: exam.id,
      order: 3,
      prompt: "Which browser permission is required for webcam monitoring?",
      type: "MULTIPLE_CHOICE",
      options: ["Camera", "Clipboard contents", "Location", "Contacts"],
      correctOptionIndex: 0,
      points: 2
    }
  });

  await prisma.examAssignment.upsert({
    where: { examId_studentId: { examId: exam.id, studentId: student.id } },
    update: { status: "ASSIGNED" },
    create: { examId: exam.id, studentId: student.id }
  });

  await prisma.systemSetting.upsert({
    where: { key: "privacy_notice" },
    update: {
      value: {
        text: "Monitoring starts only after consent and browser permissions are granted."
      }
    },
    create: {
      key: "privacy_notice",
      value: {
        text: "Monitoring starts only after consent and browser permissions are granted."
      }
    }
  });

  console.log("Seeded ExamSentinel users and sample exam");
  console.log(`Admin: ${admin.email} / Admin123!`);
  console.log(`Examiner: ${examiner.email} / Examiner123!`);
  console.log(`Student: ${student.email} / Student123!`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
