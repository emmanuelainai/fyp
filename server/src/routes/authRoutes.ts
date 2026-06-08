import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../config/prisma";
import { authenticate, type AuthRequest } from "../middlewares/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { toPublicUser } from "../utils/publicUser";
import { AuthService } from "../services/AuthService";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyRegistrationSchema
} from "../validators/authValidators";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false
});

router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const result = await AuthService.register({ ...body, role: "STUDENT" });
    res.status(201).json(result);
  })
);

router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await AuthService.login(body.email, body.password);
    res.json(result);
  })
);

router.post(
  "/register/verify",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = verifyRegistrationSchema.parse(req.body);
    const result = await AuthService.verifyRegistration(body.challengeId, body.code);
    res.json(result);
  })
);

router.post(
  "/password/forgot",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = forgotPasswordSchema.parse(req.body);
    const result = await AuthService.requestPasswordReset(body.email);
    res.json(result);
  })
);

router.post(
  "/password/reset",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    const result = await AuthService.resetPassword(body.challengeId, body.code, body.newPassword);
    res.json(result);
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ user: toPublicUser(user) });
  })
);

router.post(
  "/change-password",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = changePasswordSchema.parse(req.body);
    res.json(await AuthService.changePassword(req.user!.id, body.currentPassword, body.newPassword));
  })
);

router.post("/logout", (_req, res) => {
  res.json({ message: "Token removed on client" });
});

export default router;
