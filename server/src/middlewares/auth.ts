import type { NextFunction, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email: string;
  };
}

export const signToken = (payload: { id: string; role: UserRole; email: string }) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] });

export const authenticate = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new ApiError(401, "Authentication token is required"));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: UserRole; email: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, email: true, isActive: true }
    });

    if (!user || !user.isActive) {
      return next(new ApiError(401, "User account is inactive or unavailable"));
    }

    req.user = { id: user.id, role: user.role, email: user.email };
    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired authentication token"));
  }
};

export const canAccessRole = (userRole: UserRole | undefined, allowedRoles: UserRole[]) =>
  Boolean(userRole && allowedRoles.includes(userRole));

export const authorize =
  (...roles: UserRole[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!canAccessRole(req.user?.role, roles)) {
      return next(new ApiError(403, "You do not have permission to access this resource"));
    }
    return next();
  };
