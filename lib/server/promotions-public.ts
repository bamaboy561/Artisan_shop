import { PromotionStatus } from "@/generated/prisma";
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
};

export async function getPublicHighlightedPromotions() {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const now = new Date();

  return getDb().promotion.findMany({
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
    },
  });
}
