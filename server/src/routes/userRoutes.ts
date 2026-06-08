import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticate, authorize, type AuthRequest } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { UserService } from "../services/UserService";
import { updateUserSchema } from "../validators/userValidators";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize(UserRole.ADMIN),
  asyncHandler(async (_req, res) => {
    res.json(await UserService.list());
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user!.role !== "ADMIN" && req.user!.id !== req.params.id) {
      throw new ApiError(403, "You can only view your own user record");
    }
    res.json(await UserService.getById(req.params.id));
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req: AuthRequest, res) => {
    const body = updateUserSchema.parse(req.body);
    if (req.user!.role !== "ADMIN" && req.user!.id !== req.params.id) {
      throw new ApiError(403, "You can only update your own profile");
    }

    const allowedSelfUpdate = req.user!.role !== "ADMIN";
    const data = allowedSelfUpdate
      ? {
          name: body.name,
          matricNumber: body.matricNumber,
          department: body.department
        }
      : body;

    res.json(await UserService.update(req.params.id, data));
  })
);

router.delete(
  "/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    res.json(await UserService.deactivate(req.params.id));
  })
);

export default router;
