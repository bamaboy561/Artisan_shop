import { spawnSync } from "node:child_process";

const isVercelBuild = Boolean(process.env.VERCEL);
const isProduction = process.env.VERCEL_ENV === "production";

if (!isVercelBuild) {
  console.log("[vercel-prisma-push] Local build detected, skipping database push.");
  process.exit(0);
}

if (!isProduction) {
  console.log(
    `[vercel-prisma-push] ${process.env.VERCEL_ENV ?? "unknown"} build detected, skipping production database push.`,
  );
  process.exit(0);
}

const databaseUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.warn(
    "[vercel-prisma-push] DATABASE_URL is not available during Vercel build; skipping database push.",
  );
  process.exit(0);
}

process.env.DATABASE_URL = databaseUrl;

console.log("[vercel-prisma-push] Applying Prisma schema to production database...");

const result = spawnSync("npx", ["prisma", "db", "push", "--accept-data-loss"], {
  env: process.env,
  shell: true,
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("[vercel-prisma-push] Prisma db push failed.");
  process.exit(result.status ?? 1);
}

console.log("[vercel-prisma-push] Prisma schema is up to date.");
