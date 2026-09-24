import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/// Replaces the Mongoose pre-save hook: with Prisma there is no model
/// lifecycle, so every write path that sets a password must hash it here.
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/// Returns the raw token to email out, plus the hash and expiry to store. Only
/// the hash is persisted, so a leaked database row can't be used to reset.
export function createResetPasswordToken(): {
  resetToken: string;
  resetPasswordToken: string;
  resetPasswordExpire: Date;
} {
  const resetToken = randomBytes(20).toString("hex");
  return {
    resetToken,
    resetPasswordToken: hashResetToken(resetToken),
    resetPasswordExpire: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  };
}

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
