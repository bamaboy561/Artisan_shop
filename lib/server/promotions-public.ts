import {
  ProductStatus,
  PromotionStatus,
  PromotionTargetType,
} from "@/generated/prisma";
import { hasDatabaseUrl, getDb } from "@/lib/db";

export type PublicPromotion = {
  id: string;
  name: string;
  description: string | null;
  badgeText: string | null;
  promoCode: string | null;
  discountType: string;
  discountValue: number;
  minOrderTotal: number | null;
  endsAt: Date | null;
  targetType: PromotionTargetType;
  href: string;
  hrefLabel: string;
};

function getPromotionHref(promotion: {
  targetType: PromotionTargetType;
  products: Array<{
    product: {
      slug: string;
      status: ProductStatus;
    };
  }>;
  categories: Array<{
    category: {
      slug: string;
    };
  }>;
}) {
  const product = promotion.products.find(
    (item) => item.product.status === ProductStatus.ACTIVE,
  )?.product;

  if (promotion.targetType === PromotionTargetType.PRODUCT && product) {
    return {
      href: `/product/${product.slug}`,
      hrefLabel: "Смотреть товар",
    };
  }

  const category = promotion.categories[0]?.category;

  if (promotion.targetType === PromotionTargetType.CATEGORY && category) {
    return {
      href: `/catalog/${category.slug}`,
      hrefLabel: "Смотреть раздел",
    };
  }

  return {
    href: "/catalog",
    hrefLabel: "Смотреть предложение",
  };
}

export async function getPublicHighlightedPromotions() {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const now = new Date();

  const promotions = await getDb().promotion.findMany({
    where: {
      status: PromotionStatus.ACTIVE,
      isHighlighted: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ endsAt: "asc" }, { updatedAt: "desc" }],
    take: 3,
    select: {
      id: true,
      name: true,
      description: true,
      badgeText: true,
      promoCode: true,
      discountType: true,
      discountValue: true,
      minOrderTotal: true,
      endsAt: true,
      targetType: true,
      products: {
        take: 1,
        select: {
          product: {
            select: {
              slug: true,
              status: true,
            },
          },
        },
      },
      categories: {
        take: 1,
        select: {
          category: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  return promotions.map((promotion) => {
    const action = getPromotionHref(promotion);

    return {
      id: promotion.id,
      name: promotion.name,
      description: promotion.description,
      badgeText: promotion.badgeText,
      promoCode: promotion.promoCode,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      minOrderTotal: promotion.minOrderTotal,
      endsAt: promotion.endsAt,
      targetType: promotion.targetType,
      href: action.href,
      hrefLabel: action.hrefLabel,
    };
  });
}
