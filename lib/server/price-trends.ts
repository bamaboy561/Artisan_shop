import "server-only";

import { CategoryKind, OrderStatus, type Prisma } from "@/generated/prisma";
import {
  buildPriceTrendReport,
  getPriceTrendMonthKey,
  listPriceTrendMonths,
} from "@/features/admin/price-trends";
import { getDb } from "@/lib/db";

export const priceTrendPeriods = [6, 12, 24] as const;
export type PriceTrendPeriod = (typeof priceTrendPeriods)[number];

export type PriceTrendFilters = {
  kind: CategoryKind | "ALL";
  query: string;
  months: PriceTrendPeriod;
};

export async function getPriceTrend(filters: PriceTrendFilters) {
  const monthKeys = listPriceTrendMonths(
    getPriceTrendMonthKey(new Date()),
    filters.months,
  );
  const [startYear, startMonth] = monthKeys[0].split("-").map(Number);
  // С запасом в сутки назад: месяц потом точно определяется по времени Бишкека.
  const from = new Date(Date.UTC(startYear, startMonth - 1, 1) - 86_400_000);

  const where: Prisma.OrderItemWhereInput = {
    unitPrice: { gt: 0 },
    order: {
      status: { not: OrderStatus.CANCELED },
      createdAt: { gte: from },
    },
  };
  const and: Prisma.OrderItemWhereInput[] = [];

  if (filters.kind !== "ALL") {
    and.push({
      OR: [
        { snapshotCategoryKind: filters.kind },
        {
          snapshotCategoryKind: null,
          product: { category: { kind: filters.kind } },
        },
      ],
    });
  }

  if (filters.query) {
    and.push({
      OR: [
        { snapshotName: { contains: filters.query, mode: "insensitive" } },
        { snapshotSku: { contains: filters.query, mode: "insensitive" } },
      ],
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  const items = await getDb().orderItem.findMany({
    where,
    select: {
      productId: true,
      snapshotName: true,
      snapshotSku: true,
      unitPrice: true,
      quantity: true,
      product: { select: { name: true, sku: true } },
      order: { select: { createdAt: true } },
    },
  });

  return buildPriceTrendReport(
    items.map((item) => ({
      productKey:
        item.productId ??
        (item.snapshotSku
          ? `sku:${item.snapshotSku}`
          : `name:${item.snapshotName}`),
      name: item.product?.name ?? item.snapshotName,
      sku: item.product?.sku ?? item.snapshotSku,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      soldAt: item.order.createdAt,
    })),
    monthKeys,
  );
}
