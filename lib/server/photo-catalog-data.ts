import "server-only";
import { getDb } from "@/lib/db";
import {
  getProductPromotionPrice,
  PROMOTION_PRICE_SELECT,
} from "@/lib/server/product-promotion-pricing";

export async function getPhotoCatalogData(brandId: string, inStock: boolean) {
  const db = getDb();
  const [products, brands, categories] = await db.$transaction(
    [
      db.product.findMany({
        where: {
          status: "ACTIVE",
          ...(brandId ? { brandId } : {}),
          ...(inStock ? { stockQuantity: { gt: 0 } } : {}),
        },
        select: {
          sku: true,
          name: true,
          brandId: true,
          categoryId: true,
          price: true,
          stockQuantity: true,
          format: true,
          thicknessMm: true,
          edgeThicknessMm: true,
          edgeWidthMm: true,
          promotions: {
            select: { promotion: { select: PROMOTION_PRICE_SELECT } },
          },
          category: {
            select: {
              promotions: {
                select: { promotion: { select: PROMOTION_PRICE_SELECT } },
              },
            },
          },
          images: {
            select: { url: true },
            orderBy: { sortOrder: "asc" },
            take: 1,
          },
        },
        orderBy: [
          { brandId: "asc" },
          { categoryId: "asc" },
          { name: "asc" },
          { sku: "asc" },
        ],
      }),
      db.brand.findMany({ select: { id: true, name: true } }),
      db.category.findMany({
        select: { id: true, name: true, parentId: true },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  if (brandId && !brands.some((brand) => brand.id === brandId)) {
    throw new Error("Бренд не найден.");
  }
  const categoryMap = new Map(
    categories.map((category) => [category.id, category]),
  );
  function categoryPath(id: string) {
    const names: string[] = [];
    const seen = new Set<string>();
    let current = categoryMap.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = current.parentId
        ? categoryMap.get(current.parentId)
        : undefined;
    }
    return names.join(" / ");
  }
  return {
    title: brandId
      ? brands.find((brand) => brand.id === brandId)!.name
      : "Все бренды",
    createdAt: new Date(),
    products: products.map((product) => ({
      ...product,
      price: getProductPromotionPrice(
        product.price,
        product.promotions,
        product.category.promotions,
      ).finalPrice,
      brand:
        brands.find((brand) => brand.id === product.brandId)?.name ??
        "Без бренда",
      category: categoryPath(product.categoryId),
      imageUrl: product.images[0]?.url ?? null,
    })),
  };
}

export type PhotoCatalogData = Awaited<ReturnType<typeof getPhotoCatalogData>>;
