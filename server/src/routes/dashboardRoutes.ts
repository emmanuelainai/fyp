import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authenticate, authorize, type AuthRequest } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate, authorize(UserRole.EXAMINER, UserRole.ADMIN));

const examinerWhere = (user: { id: string; role: UserRole }) => (user.role === "EXAMINER" ? { exam: { createdById: user.id } } : {});

router.get(
  "/overview",
  asyncHandler(async (req: AuthRequest, res) => {
    const where = examinerWhere(req.user!);
    const [activeSessions, totalAlerts, highRiskSessions, completedSessions, aggregate, recentAlerts] = await prisma.$transaction([
      prisma.examSession.count({ where: { ...where, status: "ACTIVE" } }),
      prisma.alert.count({ where: { session: where } }),
      prisma.examSession.count({ where: { ...where, riskLevel: { in: ["HIGH", "CRITICAL"] } } }),
      prisma.examSession.count({ where: { ...where, status: { in: ["SUBMITTED", "TERMINATED"] } } }),
      prisma.examSession.aggregate({ where, _avg: { riskScore: true } }),
      prisma.alert.findMany({
        where: { session: where },
        include: {
          session: {
            include: { student: { select: { id: true, name: true, email: true } }, exam: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);

    res.json({
      activeSessions,
      totalAlerts,
      highRiskSessions,
      completedSessions,
      averageRiskScore: aggregate._avg.riskScore ?? 0,
      recentAlerts
    });
  })
);

router.get(
  "/exam/:examId",
  asyncHandler(async (req: AuthRequest, res) => {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.examId } });
    if (!exam || (req.user!.role === "EXAMINER" && exam.createdById !== req.user!.id)) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const [sessions, alerts, riskBreakdown] = await prisma.$transaction([
      prisma.examSession.findMany({
        where: { examId: req.params.examId },
        include: { student: { select: { id: true, name: true, email: true } }, alerts: true },
        orderBy: { startedAt: "desc" }
      }),
      prisma.alert.findMany({ where: { session: { examId: req.params.examId } }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.examSession.groupBy({
        by: ["riskLevel"],
        where: { examId: req.params.examId },
        orderBy: { riskLevel: "asc" },
        _count: { riskLevel: true }
      })
    ]);

    res.json({ exam, sessions, alerts, riskBreakdown });
  })
);

export default router;
