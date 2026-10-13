import type { PrismaClient } from "@/generated/prisma";
import {
  stockPendingCatalogKeys,
  type StockPendingCandidate,
} from "@/features/admin/stock-import";

export type StockPendingListItem = {
  id: string;
  sku: string | null;
  name: string;
  unit: string | null;
  quantity: number | null;
  note: string | null;
  sourceFile: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

// Сохраняет позиции отчёта, которых нет на сайте. Повторная загрузка
// обновляет количество и дату, а скрытые позиции остаются скрытыми.
export async function saveStockPendingItems(
  db: PrismaClient,
  items: StockPendingCandidate[],
  sourceFile: string,
) {
  const now = new Date();
  for (let offset = 0; offset < items.length; offset += 100) {
    await db.$transaction(
      items.slice(offset, offset + 100).map((item) =>
        db.stockPendingItem.upsert({
          where: { matchKey: item.matchKey },
          create: { ...item, sourceFile, firstSeenAt: now, lastSeenAt: now },
          update: {
            sku: item.sku,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            note: item.note,
            sourceFile,
            lastSeenAt: now,
          },
        }),
      ),
    );
  }
}

// Убирает из списка позиции, для которых на сайте уже завели товар.
export async function pruneStockPendingItems(
  db: PrismaClient,
  products: Array<{ sku: string; name: string }>,
) {
  const catalogKeys = stockPendingCatalogKeys(products);
  const items = await db.stockPendingItem.findMany({
    select: { id: true, matchKey: true },
  });
  const resolved = items
    .filter((item) => catalogKeys.has(item.matchKey))
    .map((item) => item.id);
  if (resolved.length)
    await db.stockPendingItem.deleteMany({ where: { id: { in: resolved } } });
}

export async function getStockPendingItems(
  db: PrismaClient,
): Promise<StockPendingListItem[]> {
  const [items, products] = await Promise.all([
    db.stockPendingItem.findMany({
      where: { dismissedAt: null },
      orderBy: [{ lastSeenAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        matchKey: true,
        sku: true,
        name: true,
        unit: true,
        quantity: true,
        note: true,
        sourceFile: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    }),
    db.product.findMany({ select: { sku: true, name: true } }),
  ]);
  const catalogKeys = stockPendingCatalogKeys(products);
  return items.filter((item) => !catalogKeys.has(item.matchKey));
}
