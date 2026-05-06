import { getDb } from "@/lib/db";

export async function getAdminPromotions() {
  const db = getDb();

  return db.promotion.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: {
      products: {
        take: 2,
        select: {
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
      },
      categories: {
        take: 2,
        select: {
          category: {
            select: {
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          products: true,
          categories: true,
        },
      },
    },
  });
}

export async function getPromotionFormOptions() {
  const db = getDb();

  const [products, categories] = await Promise.all([
    db.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    }),
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return { products, categories };
}
