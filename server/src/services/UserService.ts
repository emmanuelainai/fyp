import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { toPublicUser } from "../utils/publicUser";

export class UserService {
  static async list() {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" }
    });
    return users.map(toPublicUser);
  }

  static async getById(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    return toPublicUser(user);
  }

  static async update(id: string, data: Prisma.UserUpdateInput) {
    const user = await prisma.user.update({ where: { id }, data });
    return toPublicUser(user);
  }

  static async deactivate(id: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });
    return toPublicUser(user);
  }
}
