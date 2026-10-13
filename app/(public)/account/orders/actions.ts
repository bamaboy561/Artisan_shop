"use server";

import { getOptionalSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getCustomerOrderWhere } from "@/lib/server/customer-order-scope";
import { getPublicProductsBySlugs } from "@/lib/server/catalog-public";
import type { ReorderResult } from "@/features/cart/reorder";

export async function prepareReorderAction(
  orderId: string,
): Promise<ReorderResult> {
  const session = await getOptionalSession();
  if (!session?.userId)
    return { error: "Войдите в аккаунт, чтобы повторить заказ." };
  if (!hasDatabaseUrl())
    return { error: "История заказов временно недоступна." };
  if (typeof orderId !== "string" || !orderId.trim() || orderId.length > 200)
    return { error: "Заказ недоступен." };
  try {
    const order = await getDb().order.findFirst({
      where: {
        AND: [
          { id: orderId },
          getCustomerOrderWhere({ id: session.userId, email: session.email }),
        ],
      },
      select: {
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            snapshotName: true,
            quantity: true,
            product: { select: { slug: true } },
          },
        },
      },
    });
    if (!order) return { error: "Заказ недоступен." };
    const items = order.items.map((item) => ({
      productSlug: item.product?.slug ?? null,
      name: item.snapshotName,
      quantity: item.quantity,
    }));
    const slugs = [
      ...new Set(
        items.flatMap((item) => (item.productSlug ? [item.productSlug] : [])),
      ),
    ];
    const products = slugs.length ? await getPublicProductsBySlugs(slugs) : [];
    return {
      data: {
        items,
        products: products.map(
          ({
            slug,
            name,
            sku,
            image,
            price,
            stockQuantity,
            inStock,
            purchaseMode,
          }) => ({
            slug,
            name,
            sku,
            image,
            price,
            stockQuantity,
            inStock,
            purchaseMode,
          }),
        ),
      },
    };
  } catch {
    return { error: "Не удалось проверить цены и остатки. Повторите попытку." };
  }
}
