import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticate, authorize, type AuthRequest } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AlertService } from "../services/AlertService";
import { resolveAlertSchema } from "../validators/sessionValidators";
import { emitToExam, emitToSession } from "../sockets/SocketService";

const router = Router();
router.use(authenticate, authorize(UserRole.EXAMINER, UserRole.ADMIN));

router.get(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(
      await AlertService.list(
        {
          examId: req.query.examId?.toString(),
          sessionId: req.query.sessionId?.toString(),
          severity: req.query.severity?.toString() as never,
          status: req.query.status?.toString()
        },
        req.user!
      )
    );
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await AlertService.get(req.params.id, req.user!));
  })
);

router.patch(
  "/:id/resolve",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = resolveAlertSchema.parse(req.body);
    const alert = await AlertService.resolve(req.params.id, req.user!.id, body);
    emitToSession(alert.sessionId, "alert:resolved", alert);
    emitToExam(alert.session.examId, "alert:resolved", alert);
    res.json(alert);
  })
);

export default router;
