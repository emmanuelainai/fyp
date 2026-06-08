import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticate, authorize, type AuthRequest } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { evidenceUpload } from "../middlewares/upload";
import { MonitoringService } from "../services/MonitoringService";
import { EvidenceService } from "../services/EvidenceService";
import { eventSchema, evidenceMetadataSchema } from "../validators/sessionValidators";

const router = Router();
router.use(authenticate);

router.post(
  "/:id/events",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = eventSchema.parse(req.body);
    const result = await MonitoringService.logEvent(req.params.id, req.user!, body);
    res.status(201).json(result);
  })
);

router.get(
  "/:id/events",
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await MonitoringService.listEvents(req.params.id, req.user!, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined
    });
    res.json(result);
  })
);

router.post(
  "/:id/evidence",
  evidenceUpload.single("file"),
  asyncHandler(async (req: AuthRequest, res) => {
    const body = evidenceMetadataSchema.parse(req.body);
    const metadata = body.metadata ? JSON.parse(body.metadata) : undefined;
    const result = await EvidenceService.create(req.params.id, req.user!, req.file, {
      type: body.type,
      eventId: body.eventId,
      metadata
    });
    res.status(201).json(result);
  })
);

router.get(
  "/:id/evidence",
  authorize(UserRole.EXAMINER, UserRole.ADMIN),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await EvidenceService.list(req.params.id, req.user!));
  })
);

export default router;
