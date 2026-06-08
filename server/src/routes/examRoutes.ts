import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticate, authorize, type AuthRequest } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ExamService } from "../services/ExamService";
import { assignStudentsSchema, createExamSchema, updateExamSchema } from "../validators/examValidators";

const router = Router();
router.use(authenticate);

router.post(
  "/",
  authorize(UserRole.EXAMINER),
  asyncHandler(async (req: AuthRequest, res) => {
    const body = createExamSchema.parse(req.body);
    const exam = await ExamService.create(req.user!.id, body);
    res.status(201).json(exam);
  })
);

router.get(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await ExamService.listForUser(req.user!));
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await ExamService.getAccessible(req.params.id, req.user!));
  })
);

router.patch(
  "/:id",
  authorize(UserRole.EXAMINER),
  asyncHandler(async (req: AuthRequest, res) => {
    const body = updateExamSchema.parse(req.body);
    res.json(await ExamService.update(req.params.id, req.user!, body));
  })
);

router.delete(
  "/:id",
  authorize(UserRole.EXAMINER),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await ExamService.remove(req.params.id, req.user!));
  })
);

router.post(
  "/:id/assign",
  authorize(UserRole.EXAMINER),
  asyncHandler(async (req: AuthRequest, res) => {
    const body = assignStudentsSchema.parse(req.body);
    res.json(await ExamService.assignStudents(req.params.id, { studentIds: body.studentIds, matricNumbers: body.matricNumbers, departments: body.departments }, req.user!));
  })
);

router.get(
  "/:id/assignments",
  authorize(UserRole.EXAMINER, UserRole.ADMIN),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await ExamService.assignments(req.params.id, req.user!));
  })
);

export default router;
