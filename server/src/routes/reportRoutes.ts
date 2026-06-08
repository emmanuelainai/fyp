import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticate, authorize, type AuthRequest } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ReportService } from "../services/ReportService";
import { z } from "zod";

const router = Router();
router.use(authenticate, authorize(UserRole.EXAMINER, UserRole.ADMIN));

const gradeReportSchema = z.object({
  grades: z.array(
    z.object({
      questionId: z.string().uuid(),
      score: z.number().min(0),
      feedback: z.string().optional()
    })
  )
});

router.get(
  "/reports",
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(
      await ReportService.list(
        {
          examId: req.query.examId?.toString(),
          riskLevel: req.query.riskLevel?.toString(),
          dateFrom: req.query.dateFrom?.toString(),
          dateTo: req.query.dateTo?.toString()
        },
        req.user!
      )
    );
  })
);

router.post(
  "/sessions/:id/report/generate",
  asyncHandler(async (req: AuthRequest, res) => {
    res.status(201).json(await ReportService.generate(req.params.id, req.user!.id));
  })
);

router.get(
  "/sessions/:id/report",
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await ReportService.getForSession(req.params.id, req.user!));
  })
);

router.patch(
  "/sessions/:id/report/grade",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = gradeReportSchema.parse(req.body);
    res.json(await ReportService.gradeWrittenAnswers(req.params.id, req.user!, body.grades));
  })
);

export default router;
