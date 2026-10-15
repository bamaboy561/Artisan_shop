import type { PrismaClient } from "@/generated/prisma";
import {
  createStockMatcher,
  stockPendingCatalogKeys,
  type StockPendingCandidate,
} from "@/features/admin/stock-import";
import { ensureStockPendingItemsTable } from "@/lib/server/stock-pending-schema";

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
  // Похожие товары сайта: если позиция на самом деле есть, её связывают.
  suggestions: Array<{ id: string; sku: string; name: string }>;
};

// Связи «позиция 1С → товар сайта», заданные вручную.
export async function getStockLinks(db: PrismaClient) {
  await ensureStockPendingItemsTable(db);
  const items = await db.stockPendingItem.findMany({
    where: { linkedProductId: { not: null } },
    select: { matchKey: true, linkedProductId: true },
  });
  return new Map(
    items.map((item) => [item.matchKey, item.linkedProductId!] as const),
  );
}

// Сохраняет позиции отчёта, которых нет на сайте. Повторная загрузка
// обновляет количество и дату, а скрытые позиции остаются скрытыми.
export async function saveStockPendingItems(
  db: PrismaClient,
  items: StockPendingCandidate[],
  sourceFile: string,
) {
  await ensureStockPendingItemsTable(db);
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
  matchedKeys: Iterable<string> = [],
) {
  await ensureStockPendingItemsTable(db);
  const catalogKeys = stockPendingCatalogKeys(products);
  for (const key of matchedKeys) catalogKeys.add(key);
  // Связанные вручную позиции хранят связь, их не удаляем.
  const items = await db.stockPendingItem.findMany({
    where: { linkedProductId: null },
    select: { id: true, matchKey: true },
  });
  const resolved = items
    .filter((item) => catalogKeys.has(item.matchKey))
    .map((item) => item.id);
  if (resolved.length)
    await db.stockPendingItem.deleteMany({ where: { id: { in: resolved } } });
}

// Убирает позицию, из которой по кнопке «Добавить» создали товар, даже если
// артикул или название при создании поменяли.
export async function resolveStockPendingItem(db: PrismaClient, id: string) {
  await ensureStockPendingItemsTable(db);
  await db.stockPendingItem.deleteMany({ where: { id } });
}

export async function getStockPendingItems(
  db: PrismaClient,
): Promise<StockPendingListItem[]> {
  await ensureStockPendingItemsTable(db);
  const [items, products] = await Promise.all([
    db.stockPendingItem.findMany({
      where: { dismissedAt: null, linkedProductId: null },
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
    db.product.findMany({ select: { id: true, sku: true, name: true } }),
  ]);
  const catalogKeys = stockPendingCatalogKeys(products);
  // Тот же поиск, что при загрузке остатков: позиция, которую теперь можно
  // сопоставить с товаром сайта, в списке не показывается.
  const matcher = createStockMatcher(products);
  return items.flatMap(({ matchKey, ...item }) => {
    // Артикул, общий для разных позиций 1С, не доказывает совпадение:
    // такие позиции ищем только по названию.
    const row = {
      sku: matchKey.includes("|name:") ? "" : (item.sku ?? ""),
      name: item.name,
    };
    if (catalogKeys.has(matchKey) || matcher.find(row).product) return [];
    const suggestions = matcher
      .suggest({ sku: item.sku ?? "", name: item.name })
      .map(({ id, sku, name }) => ({ id, sku, name }));
    return [{ ...item, suggestions }];
  });
}
