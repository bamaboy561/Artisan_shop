import type { PrismaClient } from "@/generated/prisma";
import {
  createStockMatcher,
  stockLinkKey,
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

// Запомненные связи «позиция 1С → товар сайта»: заданные вручную
// («Это он») и запомненные после применения загрузки.
export async function getStockLinks(db: PrismaClient) {
  await ensureStockPendingItemsTable(db);
  const [pending, links] = await Promise.all([
    db.stockPendingItem.findMany({
      where: { linkedProductId: { not: null } },
      select: { sku: true, name: true, linkedProductId: true },
    }),
    db.stockLink.findMany({ select: { matchKey: true, productId: true } }),
  ]);
  return new Map([
    ...pending.map(
      (item) => [stockLinkKey(item), item.linkedProductId!] as const,
    ),
    ...links.map((link) => [link.matchKey, link.productId] as const),
  ]);
}

export type SavedStockLink = {
  matchKey: string;
  // Что было до записи, чтобы отмена вернула связь в прежнее состояние.
  previous: {
    productId: string;
    manual: boolean;
    importLogId: string | null;
  } | null;
};

// Запоминает связи; возвращает, что было раньше, чтобы загрузку можно было
// отменить вместе со связями.
export async function saveStockLinks(
  db: PrismaClient,
  links: Array<{
    matchKey: string;
    productId: string;
    sku: string | null;
    name: string;
  }>,
  options: { manual: boolean; importLogId?: string | null },
): Promise<SavedStockLink[]> {
  if (!links.length) return [];
  await ensureStockPendingItemsTable(db);
  const existing = new Map(
    (
      await db.stockLink.findMany({
        where: { matchKey: { in: links.map((link) => link.matchKey) } },
        select: {
          matchKey: true,
          productId: true,
          manual: true,
          importLogId: true,
        },
      })
    ).map((link) => [link.matchKey, link]),
  );
  // Ручную связь автоматическая не перезаписывает.
  const changed = links.filter((link) => {
    const current = existing.get(link.matchKey);
    if (!current) return true;
    if (current.productId === link.productId) return false;
    return options.manual || !current.manual;
  });
  for (let offset = 0; offset < changed.length; offset += 100) {
    await db.$transaction(
      changed.slice(offset, offset + 100).map((link) =>
        db.stockLink.upsert({
          where: { matchKey: link.matchKey },
          create: {
            ...link,
            manual: options.manual,
            importLogId: options.importLogId ?? null,
          },
          update: {
            productId: link.productId,
            sku: link.sku,
            name: link.name,
            manual: options.manual,
            importLogId: options.importLogId ?? null,
          },
        }),
      ),
    );
  }
  return changed.map((link) => {
    const previous = existing.get(link.matchKey);
    return {
      matchKey: link.matchKey,
      previous: previous
        ? {
            productId: previous.productId,
            manual: previous.manual,
            importLogId: previous.importLogId,
          }
        : null,
    };
  });
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
  const [items, products, links] = await Promise.all([
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
        linkedProductId: true,
      },
    }),
    db.product.findMany({ select: { id: true, sku: true, name: true } }),
    getStockLinks(db),
  ]);
  const catalogKeys = stockPendingCatalogKeys(products);
  // Тот же поиск, что при загрузке остатков: позиция, которую теперь можно
  // сопоставить с товаром сайта, в списке не показывается.
  const matcher = createStockMatcher(products, links);
  const productIds = new Set(products.map((product) => product.id));
  return items.flatMap(({ matchKey, linkedProductId, ...item }) => {
    // Связанная позиция скрыта, пока жив товар; если его удалили, позиция
    // снова видна и её можно связать заново.
    if (linkedProductId && productIds.has(linkedProductId)) return [];
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
