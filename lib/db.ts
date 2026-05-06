import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma";

type GlobalPrisma = {
  prisma?: PrismaClient;
};

const globalForPrisma = globalThis as typeof globalThis & GlobalPrisma;

export function isDemoModeEnabled() {
  return process.env.ARTISAN_DEMO_MODE === "true";
}

function createPrismaClient() {
  if (isDemoModeEnabled()) {
    throw new Error(
      "Prisma is disabled while ARTISAN_DEMO_MODE=true. Turn off demo mode before using the database layer.",
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL before using Prisma.",
    );
  }

  const adapter = new PrismaPg(process.env.DATABASE_URL, { schema: "public" });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export function hasDatabaseUrl() {
  return !isDemoModeEnabled() && Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}
