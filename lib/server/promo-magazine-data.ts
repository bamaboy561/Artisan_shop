import "server-only";
import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/seo";
import { companyContacts } from "@/lib/site-config";
import {
  getProductPromotionPrice,
  getPromotionCompareAtPrice,
  PROMOTION_PRICE_SELECT,
} from "@/lib/server/product-promotion-pricing";

const MAX_PRODUCTS = 120;

// Товары, у которых прямо сейчас действует скидка по акции: для журнала
// акций. С promotionId — только товары этой акции и только её скидка.
export async function getPromoMagazineData(promotionId = "") {
  const db = getDb();
  const promotion = promotionId
    ? await db.promotion.findUnique({
        where: { id: promotionId },
        select: { id: true, name: true, description: true, endsAt: true },
      })
    : null;
  if (promotionId && !promotion) throw new Error("Акция не найдена.");

  const relationFilter = promotionId
    ? { some: { promotionId } }
    : { some: { promotion: { status: "ACTIVE" as const } } };
  const products = await db.product.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { promotions: relationFilter },
        { category: { promotions: relationFilter } },
      ],
    },
    select: {
      sku: true,
      slug: true,
      name: true,
      price: true,
      compareAtPrice: true,
      stockQuantity: true,
      format: true,
      thicknessMm: true,
      brand: { select: { name: true } },
      category: {
        select: {
          name: true,
          promotions: {
            select: { promotion: { select: PROMOTION_PRICE_SELECT } },
          },
        },
      },
      promotions: {
        select: { promotion: { select: PROMOTION_PRICE_SELECT } },
      },
      images: {
        select: { url: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
    orderBy: [{ name: "asc" }],
    take: 600,
  });

  const siteUrl = getSiteUrl();
  const onlyThis = <T extends { promotion: { id: string } }>(items: T[]) =>
    promotionId
      ? items.filter((item) => item.promotion.id === promotionId)
      : items;

  const items = products
    .map((product) => {
      const pricing = getProductPromotionPrice(
        product.price,
        onlyThis(product.promotions),
        onlyThis(product.category.promotions),
      );
      if (
        pricing.unitDiscountAmount <= 0 ||
        pricing.finalPrice == null ||
        !pricing.promotion
      )
        return null;
      const compareAt = getPromotionCompareAtPrice(
        product.compareAtPrice,
        pricing,
      );
      const oldPrice =
        compareAt != null && compareAt > pricing.finalPrice ? compareAt : null;
      const percent = oldPrice
        ? Math.round(((oldPrice - pricing.finalPrice) / oldPrice) * 100)
        : 0;
      return {
        sku: product.sku,
        name: product.name,
        brand: product.brand?.name ?? "",
        category: product.category.name,
        format: [
          product.format,
          product.thicknessMm != null &&
          !(product.format ?? "").includes(`${product.thicknessMm} мм`)
            ? `${product.thicknessMm} мм`
            : null,
        ]
          .filter(Boolean)
          .join(", "),
        inStock: (product.stockQuantity ?? 0) > 0,
        price: pricing.finalPrice,
        oldPrice,
        percent,
        promotionName: pricing.promotion.name,
        endsAt: pricing.promotion.endsAt,
        imageUrl: product.images[0]?.url ?? null,
        url: `${siteUrl}/product/${encodeURIComponent(product.slug)}`,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    // Самые большие скидки — первыми: они попадают на обложку и в начало.
    .sort(
      (a, b) =>
        b.percent - a.percent ||
        Number(b.inStock) - Number(a.inStock) ||
        a.name.localeCompare(b.name, "ru", { numeric: true }),
    )
    .slice(0, MAX_PRODUCTS);

  const endDates = items
    .map((item) => item.endsAt)
    .filter((date): date is Date => date instanceof Date);
  return {
    siteUrl,
    contacts: companyContacts,
    title: promotion?.name ?? "Акции месяца",
    subtitle: promotion?.description ?? null,
    promotionNames: Array.from(new Set(items.map((i) => i.promotionName))),
    // Срок на обложке — самая поздняя дата окончания среди акций журнала.
    endsAt: endDates.length
      ? new Date(Math.max(...endDates.map((date) => date.getTime())))
      : null,
    maxPercent: items.reduce((max, item) => Math.max(max, item.percent), 0),
    createdAt: new Date(),
    products: items,
  };
}

export type PromoMagazineData = Awaited<
  ReturnType<typeof getPromoMagazineData>
>;
