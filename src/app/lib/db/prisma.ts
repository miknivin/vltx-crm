import { PrismaClient } from "@prisma/client";

// One client per process. Next.js hot-reloads modules in development, so
// without the global cache every edit would open a new connection pool and
// exhaust Neon's connection limit within a few saves.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
