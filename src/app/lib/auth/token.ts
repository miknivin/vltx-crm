import jwt from "jsonwebtoken";

export interface JwtPayload {
  id: string;
}

function getSecret(): jwt.Secret {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  return secret as jwt.Secret;
}

/// Replaces `user.getJwtToken()`. The payload shape is unchanged, so cookies
/// issued before the Postgres migration still decode — they just resolve to a
/// user id that no longer exists, which the middleware rejects as "login again".
export function signJwtToken(userId: string): string {
  return jwt.sign({ id: userId }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_TIME || "7d",
  } as jwt.SignOptions);
}

export function verifyJwtToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}

export const AUTH_COOKIE = "token";

export function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: maxAgeSeconds,
    path: "/",
  };
}

export const SESSION_MAX_AGE_SECONDS =
  (Number(process.env.COOKIE_EXPIRES_TIME) || 7) * 24 * 60 * 60;
