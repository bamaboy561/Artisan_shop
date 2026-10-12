import { getDb } from "@/lib/db";

export async function getAdminPromotions() {
  const db = getDb();

  return db.promotion.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: {
      products: {
        take: 2,
        select: {
          productId: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      },
      categories: {
        take: 2,
        select: {
          categoryId: true,
          category: {
            select: {
              id: true,
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

export async function getAdminPromotion(id: string) {
  const db = getDb();

  return db.promotion.findUnique({
    where: { id },
    include: {
      products: {
        take: 1,
        select: {
          productId: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      },
      categories: {
        take: 1,
        select: {
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
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
