import "server-only";

import { getDb } from "@/lib/db";
import type { CatalogExportData } from "@/features/admin/catalog-export";

export async function getCatalogExportData(): Promise<CatalogExportData> {
  const db = getDb();
  // All three sheets describe the same snapshot, even during catalog edits.
  const [products, categories, brands] = await db.$transaction(
    [
      db.product.findMany({
        select: {
          id: true,
          sku: true,
          name: true,
          slug: true,
          categoryId: true,
          brandId: true,
          status: true,
          orderMode: true,
          inventoryStatus: true,
          price: true,
          compareAtPrice: true,
          stockQuantity: true,
          format: true,
          thicknessMm: true,
          edgeThicknessMm: true,
          edgeWidthMm: true,
          summary: true,
          description: true,
          images: {
            select: { url: true },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            take: 1,
          },
        },
        orderBy: { id: "asc" },
      }),
      db.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          kind: true,
          sortOrder: true,
        },
        orderBy: { id: "asc" },
      }),
      db.brand.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          country: true,
          website: true,
          logoUrl: true,
        },
        orderBy: { id: "asc" },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    products: products.map(({ images, ...product }) => ({
      ...product,
      imageUrl: images[0]?.url ?? null,
    })),
    categories,
    brands,
  };
}
