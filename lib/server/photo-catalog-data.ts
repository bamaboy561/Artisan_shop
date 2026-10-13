import "server-only";
import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/seo";
import { companyContacts } from "@/lib/site-config";
import {
  getProductPromotionPrice,
  getPromotionCompareAtPrice,
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
          slug: true,
          name: true,
          brandId: true,
          categoryId: true,
          price: true,
          compareAtPrice: true,
          stockQuantity: true,
          inventoryStatus: true,
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
  const siteUrl = getSiteUrl();
  return {
    siteUrl,
    contacts: companyContacts,
    title: brandId
      ? brands.find((brand) => brand.id === brandId)!.name
      : "Все бренды",
    createdAt: new Date(),
    products: products
      .map(({ promotions, category, images, ...product }) => {
        const pricing = getProductPromotionPrice(
          product.price,
          promotions,
          category.promotions,
        );
        const price = pricing.finalPrice;
        // Зачёркнутая цена как на витрине: большая из обычной цены при акции
        // и «старой цены» из карточки.
        const compareAt = getPromotionCompareAtPrice(
          product.compareAtPrice,
          pricing,
        );
        const oldPrice =
          price != null && compareAt != null && compareAt > price
            ? compareAt
            : null;
        return {
          ...product,
          price,
          oldPrice,
          url: `${siteUrl}/product/${encodeURIComponent(product.slug)}`,
          brand:
            brands.find((brand) => brand.id === product.brandId)?.name ??
            "Без бренда",
          category: categoryPath(product.categoryId),
          imageUrl: images[0]?.url ?? null,
        };
      })
      // Каталог листается разделами: категория, внутри бренд и название.
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category, "ru", { numeric: true }) ||
          a.brand.localeCompare(b.brand, "ru", { numeric: true }) ||
          a.name.localeCompare(b.name, "ru", { numeric: true }),
      ),
  };
}

export type PhotoCatalogData = Awaited<ReturnType<typeof getPhotoCatalogData>>;
