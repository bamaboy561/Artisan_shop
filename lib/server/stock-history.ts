import type { InventoryStatus, PrismaClient } from "@/generated/prisma";
import type { SavedStockLink } from "@/lib/server/stock-pending";
import { ensureStockPendingItemsTable } from "@/lib/server/stock-pending-schema";

type ChangedFields = {
  price?: number | null;
  compareAtPrice?: number | null;
  stockQuantity?: number | null;
  inventoryStatus?: InventoryStatus;
};

export type StockImportChange = {
  productId: string;
  name: string;
  before: ChangedFields;
  after: ChangedFields;
};

export type StockImportHistoryItem = {
  id: string;
  fileName: string;
  createdAt: Date;
  undoneAt: Date | null;
  changedCount: number;
  linkCount: number;
};

// Записывает применённую загрузку: что было у каждого товара до и после.
export async function recordStockImport(
  db: PrismaClient,
  log: {
    fileName: string;
    userId: string | null;
    mode: string;
    changes: StockImportChange[];
  },
) {
  await ensureStockPendingItemsTable(db);
  return db.stockImportLog.create({
    data: { ...log, links: [] },
    select: { id: true },
  });
}

export async function attachStockImportLinks(
  db: PrismaClient,
  id: string,
  links: SavedStockLink[],
) {
  if (!links.length) return;
  await db.stockImportLog.update({ where: { id }, data: { links } });
}

export async function getStockImportHistory(
  db: PrismaClient,
  limit = 10,
): Promise<StockImportHistoryItem[]> {
  await ensureStockPendingItemsTable(db);
  const logs = await db.stockImportLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      undoneAt: true,
      changes: true,
      links: true,
    },
  });
  return logs.map(({ changes, links, ...log }) => ({
    ...log,
    changedCount: Array.isArray(changes) ? changes.length : 0,
    linkCount: Array.isArray(links) ? links.length : 0,
  }));
}

// Возвращает товарам значения до загрузки. Товар, который после неё уже
// поменяли (заказ, ручная правка, новая загрузка), не трогаем.
export async function undoStockImport(db: PrismaClient, id: string) {
  await ensureStockPendingItemsTable(db);
  const log = await db.stockImportLog.findUnique({ where: { id } });
  if (!log || log.undoneAt) return null;
  const newer = await db.stockImportLog.count({
    where: { createdAt: { gt: log.createdAt }, undoneAt: null },
  });
  // Отменяем по порядку, начиная с последней загрузки.
  if (newer) return { restored: 0, skipped: 0, blocked: true };
  const changes = (Array.isArray(log.changes) ? log.changes : []) as
    | StockImportChange[]
    | [];
  const links = (Array.isArray(log.links) ? log.links : []) as
    | SavedStockLink[]
    | [];
  let restored = 0;
  let skipped = 0;
  for (let offset = 0; offset < changes.length; offset += 100) {
    const batch = changes.slice(offset, offset + 100);
    const results = await db.$transaction(
      batch.map((change) =>
        db.product.updateMany({
          where: { id: change.productId, ...change.after },
          data: change.before,
        }),
      ),
    );
    for (const result of results) {
      if (result.count) restored += 1;
      else skipped += 1;
    }
  }
  for (const link of links) {
    if (link.previousProductId)
      await db.stockLink.updateMany({
        where: { matchKey: link.matchKey },
        data: { productId: link.previousProductId },
      });
    else
      await db.stockLink.deleteMany({
        where: { matchKey: link.matchKey, importLogId: id },
      });
  }
  await db.stockImportLog.update({
    where: { id },
    data: { undoneAt: new Date() },
  });
  return { restored, skipped, blocked: false };
}
