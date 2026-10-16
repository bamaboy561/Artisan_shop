import "server-only";

import { cache } from "react";
import type { Prisma } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  parseCuttingLaborPrice,
  calculateCuttingLaborTotal,
  type CuttingLaborPrice,
} from "@/features/cutting/labor-price";
import {
  defaultSiteCuttingPrices,
  parseSiteCuttingPrices,
} from "@/features/cutting/site-prices";

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

export async function saveCuttingPriceSnapshot(
  db: PricingDb,
  id: string,
  price: CuttingLaborPrice,
) {
  const value = { ...price };
  await db.siteSetting.upsert({
    where: { key: snapshotKey(id) },
    create: { key: snapshotKey(id), value },
    update: { value },
  });
}

export async function repriceCuttingRequest(id: string, actorId: string) {
  if (!hasDatabaseUrl()) throw new Error("База данных не подключена.");
  return getDb().$transaction(
    async (tx) => {
      const request = await tx.request.findUnique({ where: { id } });
      if (!request || request.type !== "CUTTING_SERVICE")
        throw new Error("Заявка на распил не найдена.");
      const price = await readCuttingPrice(tx);
      if (!price) throw new Error("Сначала заполните прайс работ.");
      const total = calculateCuttingLaborTotal(
        price,
        request.cuttingSheetCount,
        request.cuttingEdgeMeters,
        request.edgeOption,
      );
      if (total === null)
        throw new Error("Укажите количество листов и метраж кромления.");
      await saveCuttingPriceSnapshot(tx, id, price);
      await tx.request.update({ where: { id }, data: { quotedTotal: total } });
      await tx.operationEvent.create({
        data: {
          entityType: "request",
          entityId: id,
          eventType: "production_result",
          title: "Стоимость работ рассчитана по прайсу",
          actorId,
          description: `Было: ${request.quotedTotal ?? "не рассчитано"}; стало: ${total} сом. Распил: ${price.sheetRate} сом/лист; кромление: ${price.edgeRate} сом/м.`,
          isVisibleToClient: true,
        },
      });
      return total;
    },
    { isolationLevel: "Serializable" },
  );
}
