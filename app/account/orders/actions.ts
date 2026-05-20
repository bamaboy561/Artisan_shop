"use server";

import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getAccountUser } from "@/lib/server/account-data";

export async function repeatOrderAction(orderId: string) {
  if (!hasDatabaseUrl()) {
    return { success: false, error: "База данных не подключена." };
  }

  const user = await getAccountUser();
  if (!user) {
    return { success: false, error: "Войдите в личный кабинет." };
  }

  const db = getDb();

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true },
  });

  if (!order || order.userId !== user.id) {
    return {
      success: false,
      error: "Заказ не найден или недоступен.",
    };
  }

  const items = await db.orderItem.findMany({
    where: { orderId: order.id, productId: { not: null } },
    select: {
      quantity: true,
      product: { select: { slug: true } },
    },
  });

  const result = items
    .filter((item) => item.product?.slug)
    .map((item) => ({
      productSlug: item.product!.slug,
      quantity: item.quantity,
    }));

  if (result.length === 0) {
    return {
      success: false,
      error: "В заказе нет товаров для повтора.",
    };
  }

  return { success: true, items: result };
}