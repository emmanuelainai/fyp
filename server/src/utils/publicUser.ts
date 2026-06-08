import type { User } from "@prisma/client";

export type PublicUser = Omit<User, "passwordHash">;

export const toPublicUser = (user: User): PublicUser => {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
};
