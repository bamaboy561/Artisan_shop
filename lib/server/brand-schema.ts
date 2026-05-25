import type { PrismaClient } from "@/generated/prisma";

let brandLogoColumnPromise: Promise<void> | null = null;

export function ensureBrandLogoColumn(db: PrismaClient) {
  brandLogoColumnPromise ??= db
    .$executeRawUnsafe(
      'ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT',
    )
    .then(() =>
      db.$executeRawUnsafe(
        'ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "homeBannerImageUrls" TEXT',
      ),
    )
    .then(() =>
      db.$executeRawUnsafe(
        'UPDATE "Brand" SET "name" = \'Emaks\' WHERE "slug" = \'emmax\' AND "name" = \'Emmax\'',
      ),
    )
    .then(() => undefined)
    .catch((error) => {
      brandLogoColumnPromise = null;
      throw error;
    });

  return brandLogoColumnPromise;
}
