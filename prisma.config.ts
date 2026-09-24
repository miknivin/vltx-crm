import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// The Prisma CLI only auto-loads `.env`, but this project keeps its variables
// in `.env.local` (what Next.js reads). Without this, `prisma migrate deploy`
// would run with no DATABASE_URL while the app itself starts fine.
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;

    const [, key, rawValue] = match;
    // Existing variables win, so a value exported in the shell or injected by
    // the host still overrides the file.
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadEnvLocal();

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx --env-file=.env.local prisma/seed.ts",
  },
});
