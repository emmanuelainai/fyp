import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticate, authorize, type AuthRequest } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { SessionService } from "../services/SessionService";
import { endSessionSchema, startSessionSchema } from "../validators/sessionValidators";

const router = Router();
router.use(authenticate);

router.post(
  "/start",
  authorize(UserRole.STUDENT),
  asyncHandler(async (req: AuthRequest, res) => {
    const body = startSessionSchema.parse(req.body);
    const session = await SessionService.start({
      ...body,
      studentId: req.user!.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.status(201).json({ session, socket: { namespace: "/", rooms: [`session:${session.id}`, `exam:${session.examId}`] } });
  })
);

router.post(
  "/:id/end",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = endSessionSchema.parse(req.body);
    res.json(await SessionService.end(req.params.id, req.user!, "SUBMITTED", body.answers));
  })
);

router.get(
  "/",
  authorize(UserRole.EXAMINER, UserRole.ADMIN),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(
      await SessionService.list(
        {
          examId: req.query.examId?.toString(),
          status: req.query.status?.toString(),
          riskLevel: req.query.riskLevel?.toString(),
          studentId: req.query.studentId?.toString()
        },
        req.user!
      )
    );
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await SessionService.getAccessible(req.params.id, req.user!));
  })
);

export default router;
