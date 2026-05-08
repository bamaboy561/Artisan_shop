import type { PrismaClient } from "@/generated/prisma";

let brandLogoColumnPromise: Promise<void> | null = null;

export function ensureBrandLogoColumn(db: PrismaClient) {
  brandLogoColumnPromise ??= db
    .$executeRawUnsafe(
      'ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT',
    )
    .then(() => undefined)
    .catch((error) => {
      brandLogoColumnPromise = null;
      throw error;
    });

  return brandLogoColumnPromise;
}
