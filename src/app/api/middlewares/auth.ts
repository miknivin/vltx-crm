import { NextRequest } from "next/server";
import type { Role, User } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { AUTH_COOKIE, verifyJwtToken } from "@/app/lib/auth/token";

/// Returns the full row minus the password hash, so a handler can never leak it
/// by spreading the authenticated user into a response.
///
/// `_id` mirrors `id`. Routes still on Mongoose read `user._id`, and they are
/// migrated phase by phase rather than all at once; the alias keeps them
/// compiling in the meantime and comes out with the last of them.
export type AuthenticatedUser = Omit<User, "password"> & { _id: string };

const SAFE_USER_SELECT = {
  id: true,
  uid: true,
  name: true,
  email: true,
  phone: true,
  avatarPublicId: true,
  avatarUrl: true,
  role: true,
  signupMethod: true,
  resetPasswordToken: true,
  resetPasswordExpire: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const isAuthenticatedUser = async (req: NextRequest): Promise<AuthenticatedUser> => {
  const token = req.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    throw new Error("You need to login to access this resource");
  }

  let decoded;
  try {
    decoded = verifyJwtToken(token);
  } catch {
    throw new Error("Session expired. Please login again.");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: SAFE_USER_SELECT,
  });

  if (!user) {
    throw new Error("User not found. Please login again.");
  }

  return { ...user, _id: user.id };
};

export const authorizeRoles = (user: { role: Role }, ...roles: Role[]): void => {
  if (!roles.includes(user.role)) {
    throw new Error("Not allowed");
  }
};
