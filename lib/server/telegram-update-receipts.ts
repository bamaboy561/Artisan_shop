import "server-only";

import { Prisma } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export type TelegramUpdateClaim = "claimed" | "processing" | "completed";

export async function claimTelegramUpdate(
  updateId: number,
): Promise<TelegramUpdateClaim> {
  if (!hasDatabaseUrl()) {
    return "claimed";
  }

  const db = getDb();

  try {
    await db.telegramUpdateReceipt.create({
      data: { updateId: BigInt(updateId) },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.telegramUpdateReceipt.findUnique({
        where: { updateId: BigInt(updateId) },
        select: { completedAt: true, createdAt: true },
      });

      if (existing?.completedAt) {
        return "completed";
      }

      const staleBefore = new Date(Date.now() - 2 * 60 * 1000);

      if (existing && existing.createdAt < staleBefore) {
        const reclaimed = await db.telegramUpdateReceipt.updateMany({
          where: {
            updateId: BigInt(updateId),
            completedAt: null,
            createdAt: existing.createdAt,
          },
          data: { createdAt: new Date() },
        });

        return reclaimed.count > 0 ? "claimed" : "processing";
      }

      return "processing";
    }

    throw error;
  }

  if (updateId % 100 === 0) {
    const retentionStart = new Date();
    retentionStart.setDate(retentionStart.getDate() - 30);
    void db.telegramUpdateReceipt
      .deleteMany({ where: { createdAt: { lt: retentionStart } } })
      .catch((error) =>
        console.error("[telegram:update-receipts:cleanup]", error),
      );
  }

  return "claimed";
}

export async function completeTelegramUpdate(updateId: number) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await getDb().telegramUpdateReceipt.update({
    where: { updateId: BigInt(updateId) },
    data: { completedAt: new Date() },
  });
}

export async function releaseTelegramUpdate(updateId: number) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await getDb().telegramUpdateReceipt.deleteMany({
    where: { updateId: BigInt(updateId) },
  });
}
