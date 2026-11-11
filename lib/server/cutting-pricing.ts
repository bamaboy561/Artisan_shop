import "server-only";

import { cache } from "react";
import type { Prisma } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  parseCuttingLaborPrice,
  type CuttingLaborPrice,
} from "@/features/cutting/labor-price";
import {
  defaultSiteCuttingPrices,
  parseSiteCuttingPrices,
} from "@/features/cutting/site-prices";
import {
  buildCuttingQuote,
  parseCuttingExtras,
  parseCuttingExtrasPrice,
  type CuttingExtras,
  type CuttingQuotePrice,
} from "@/features/cutting/quote";

export const cuttingPriceKey = "cutting:labor-price:v1";
const snapshotKey = (id: string) => `cutting:labor-price:request:${id}`;
type PricingDb = Pick<Prisma.TransactionClient, "siteSetting">;

export async function readCuttingPrice(db: PricingDb, requestId?: string) {
  const record = await db.siteSetting.findUnique({
    where: { key: requestId ? snapshotKey(requestId) : cuttingPriceKey },
  });
  return parseCuttingLaborPrice(record?.value);
}

export async function getCuttingPrice(requestId?: string) {
  return hasDatabaseUrl() ? readCuttingPrice(getDb(), requestId) : null;
}

// Цены сайта (калькулятор, присадка, плашка) из «Прайс работ».
export const siteCuttingPricesKey = "cutting:site-prices:v1";

export const getSiteCuttingPrices = cache(async () => {
  if (!hasDatabaseUrl()) return defaultSiteCuttingPrices;
  try {
    const record = await getDb().siteSetting.findUnique({
      where: { key: siteCuttingPricesKey },
    });
    return parseSiteCuttingPrices(record?.value);
  } catch {
    // Без базы витрина открывается с ценами по умолчанию.
    return defaultSiteCuttingPrices;
  }
});

// Цены присадки и фрезеровки сейчас: из «Прайс работ» (цены сайта).
async function readCurrentExtrasPrice(db: PricingDb) {
  const record = await db.siteSetting.findUnique({
    where: { key: siteCuttingPricesKey },
  });
  const prices = parseSiteCuttingPrices(record?.value);
  return {
    drilling: prices.drilling,
    milling: prices.milling,
    bevel: prices.bevel,
  };
}

// Полный прайс счёта: распил и кромка + присадка и фрезеровка. Для
// заявки — замороженный при расчёте; старый снимок без цен присадки
// дополняется текущими ценами.
export async function readCuttingQuotePrice(
  db: PricingDb,
  requestId?: string,
): Promise<CuttingQuotePrice | null> {
  const record = await db.siteSetting.findUnique({
    where: { key: requestId ? snapshotKey(requestId) : cuttingPriceKey },
  });
  const labor = parseCuttingLaborPrice(record?.value);
  if (!labor) return null;
  const snapshot = record?.value as Record<string, unknown> | null;
  const extras =
    requestId &&
    snapshot &&
    typeof snapshot === "object" &&
    "drilling" in snapshot
      ? parseCuttingExtrasPrice(snapshot)
      : await readCurrentExtrasPrice(db);
  return { ...labor, ...extras };
}

const extrasKey = (id: string) => `cutting:extras:request:${id}`;

export async function readCuttingExtras(db: PricingDb, requestId: string) {
  const record = await db.siteSetting.findUnique({
    where: { key: extrasKey(requestId) },
  });
  return parseCuttingExtras(record?.value);
}

export async function saveCuttingExtras(
  db: PricingDb,
  requestId: string,
  extras: CuttingExtras,
) {
  const value = { ...extras, drilling: { ...extras.drilling } };
  await db.siteSetting.upsert({
    where: { key: extrasKey(requestId) },
    create: { key: extrasKey(requestId), value },
    update: { value },
  });
}

// Счёт заявки для показа менеджеру и клиенту: по замороженным ценам.
export async function getCuttingRequestQuote(request: {
  id: string;
  cuttingSheetCount: number | null;
  cuttingEdgeMeters: number | null;
  edgeOption: string | null;
}) {
  if (!hasDatabaseUrl()) return null;
  try {
    const db = getDb();
    const [price, extras] = await Promise.all([
      readCuttingQuotePrice(db, request.id),
      readCuttingExtras(db, request.id),
    ]);
    return {
      quote: price ? buildCuttingQuote(price, request, extras) : null,
      extras,
    };
  } catch (error) {
    console.error("[cutting:quote]", error);
    return null;
  }
}

export async function saveCuttingPriceSnapshot(
  db: PricingDb,
  id: string,
  price: CuttingLaborPrice | CuttingQuotePrice,
) {
  const value =
    "drilling" in price
      ? { ...price, drilling: { ...price.drilling } }
      : { ...price };
  await db.siteSetting.upsert({
    where: { key: snapshotKey(id) },
    create: { key: snapshotKey(id), value },
    update: { value },
  });
}

// extras — присадка и фрезеровка, если менеджер их только что указал
// (или они найдены в проекте Базиса); иначе берутся сохранённые.
export async function repriceCuttingRequest(
  id: string,
  actorId: string,
  extras?: CuttingExtras | null,
) {
  if (!hasDatabaseUrl()) throw new Error("База данных не подключена.");
  return getDb().$transaction(
    async (tx) => {
      const request = await tx.request.findUnique({ where: { id } });
      if (!request || request.type !== "CUTTING_SERVICE")
        throw new Error("Заявка на распил не найдена.");
      const price = await readCuttingQuotePrice(tx);
      if (!price) throw new Error("Сначала заполните прайс работ.");
      const requestExtras = extras ?? (await readCuttingExtras(tx, id));
      const quote = buildCuttingQuote(price, request, requestExtras);
      if (quote === null)
        throw new Error("Укажите количество листов и метраж кромления.");
      const total = quote.total;
      await saveCuttingPriceSnapshot(tx, id, price);
      if (extras) await saveCuttingExtras(tx, id, extras);
      await tx.request.update({ where: { id }, data: { quotedTotal: total } });
      await tx.operationEvent.create({
        data: {
          entityType: "request",
          entityId: id,
          eventType: "production_result",
          title: "Стоимость работ рассчитана по прайсу",
          actorId,
          description: [
            `Было: ${request.quotedTotal ?? "не рассчитано"}; стало: ${total} сом.`,
            ...quote.lines.map(
              (line) =>
                `${line.label}: ${line.detail}${line.amount === null ? "" : ` = ${line.amount} сом`}`,
            ),
          ].join("; "),
          isVisibleToClient: true,
        },
      });
      return total;
    },
    { isolationLevel: "Serializable" },
  );
}
