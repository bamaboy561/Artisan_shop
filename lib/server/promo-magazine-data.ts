import "server-only";
import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/seo";
import { companyContacts } from "@/lib/site-config";
import {
  displayProductName,
  isSheetFormat,
} from "@/features/storefront/plate-gallery";
import {
  getProductPromotionPrice,
  getPromotionCompareAtPrice,
  PROMOTION_PRICE_SELECT,
} from "@/lib/server/product-promotion-pricing";

const MAX_PRODUCTS = 120;

// Товары со скидкой по акции для журнала акций. Без promotionId — все акции,
// которые действуют прямо сейчас. С promotionId — только эта акция и её
// скидка, в том числе если она начнётся позже (журнал печатают заранее).
export async function getPromoMagazineData(promotionId = "") {
  const db = getDb();
  const now = new Date();
  const promotion = promotionId
    ? await db.promotion.findUnique({
        where: { id: promotionId },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          startsAt: true,
          endsAt: true,
          _count: { select: { products: true, categories: true } },
        },
      })
    : null;
  if (promotionId && !promotion) throw new Error("Акция не найдена.");

  const notEnded = { OR: [{ endsAt: null }, { endsAt: { gte: now } }] };
  // Общий журнал — только акции, которые действуют прямо сейчас (статус и
  // сроки), чтобы лимит выборки не съели просроченные или будущие акции.
  const promotionFilter = promotionId
    ? {
        id: promotionId,
        status: { in: ["ACTIVE" as const, "SCHEDULED" as const] },
        ...notEnded,
      }
    : {
        status: "ACTIVE" as const,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          notEnded,
        ],
      };
  const relationFilter = { some: { promotion: promotionFilter } };
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
      inventoryStatus: true,
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
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 2,
      },
    },
    orderBy: [{ name: "asc" }],
    take: 3000,
  });

  const siteUrl = getSiteUrl();
  // Для одной акции считаем цену так, будто она уже идёт: у запланированной
  // акции в журнале должна стоять её будущая цена.
  const onlyThis = <
    T extends {
      promotion: { id: string; status: string; startsAt: Date | null };
    },
  >(
    items: T[],
  ) =>
    promotionId
      ? items
          .filter((item) => item.promotion.id === promotionId)
          .map((item) => ({
            ...item,
            promotion: {
              ...item.promotion,
              status: "ACTIVE" as const,
              startsAt: null,
            },
          }))
      : items;

  const sorted = products
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
        name: displayProductName({
          name: product.name,
          format: product.format ?? "",
        }),
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
        // Как на витрине: без количества смотрим на статус наличия.
        isSheet: isSheetFormat(product.format ?? ""),
        inStock:
          product.stockQuantity === null
            ? product.inventoryStatus === "IN_STOCK" ||
              product.inventoryStatus === "LIMITED"
            : product.stockQuantity > 0,
        price: pricing.finalPrice,
        oldPrice,
        percent,
        promotionId: pricing.promotion.id,
        promotionName: pricing.promotion.name,
        endsAt: pricing.promotion.endsAt,
        // У плит первое фото — интерьер, второе — образец декора. В журнале,
        // как на витрине, для листовых материалов показываем сам декор.
        imageUrl:
          (isSheetFormat(product.format ?? "")
            ? product.images[1]?.url
            : undefined) ??
          product.images[0]?.url ??
          null,
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
    );
  const items = takeFairShare(sorted, MAX_PRODUCTS);

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
    // Акция начнётся позже: журнал напечатан заранее, на обложке и в
    // примечании — дата начала, а не «цены на сегодня».
    startsAt:
      promotion?.startsAt && promotion.startsAt > now
        ? promotion.startsAt
        : null,
    maxPercent: items.reduce((max, item) => Math.max(max, item.percent), 0),
    createdAt: new Date(),
    products: items,
    emptyReason: items.length ? null : explainEmpty(promotion, now),
  };
}

// Лимит журнала делим между акциями по очереди: иначе большая акция с
// крупной скидкой вытесняла все товары новой акции и та пропадала из журнала.
function takeFairShare<T extends { promotionId: string }>(
  items: T[],
  limit: number,
) {
  if (items.length <= limit) return items;
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.promotionId);
    if (group) group.push(item);
    else groups.set(item.promotionId, [item]);
  }
  const picked = new Set<T>();
  const queues = Array.from(groups.values());
  for (let round = 0; picked.size < limit; round += 1) {
    let added = false;
    for (const queue of queues) {
      const item = queue[round];
      if (!item) continue;
      picked.add(item);
      added = true;
      if (picked.size >= limit) break;
    }
    if (!added) break;
  }
  // Порядок прежний: самые большие скидки первыми.
  return items.filter((item) => picked.has(item));
}

type PromotionForReason = {
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  _count: { products: number; categories: number };
} | null;

// Почему журнал пуст: подсказка для админки вместо общей фразы.
function explainEmpty(promotion: PromotionForReason, now: Date) {
  if (!promotion)
    return "Сейчас нет действующих акций с товарами. Акции, которые начнутся позже, можно скачать кнопкой «Журнал акции» на странице самой акции.";
  if (promotion.status === "DRAFT")
    return "Акция в статусе «Черновик». Поставьте статус «Активна» и сохраните.";
  if (promotion.status === "EXPIRED" || promotion.status === "ARCHIVED")
    return "Акция завершена или в архиве. Поставьте статус «Активна» и сохраните.";
  if (promotion.endsAt && promotion.endsAt < now)
    return "Срок акции уже закончился. Продлите дату окончания.";
  if (!promotion._count.products && !promotion._count.categories)
    return "К акции не привязаны товары или категории. Откройте акцию, выберите товары и сохраните.";
  return "У товаров акции нет цены со скидкой: проверьте, что товары опубликованы, у них есть цена, а размер скидки больше нуля.";
}

export type PromoMagazineData = Awaited<
  ReturnType<typeof getPromoMagazineData>
>;
