"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  LoyaltyTransactionType,
  OrderStatus,
  PromotionTargetType,
} from "@/generated/prisma";
import { catalogProducts } from "@/features/catalog/data";
import { getOptionalSession } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { handleOrderCreated } from "@/lib/server/commercial-integrations";
import {
  applyPromotion,
  estimateLoyaltyPoints,
  getEffectiveDiscountPercent,
  getLoyaltyTierForLifetimePoints,
  getRedeemableLoyaltyPoints,
  isPromotionActive,
} from "@/lib/server/pricing";

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя для заказа."),
  phone: z.string().trim().min(6, "Укажите телефон для связи."),
  email: z
    .union([
      z.string().trim().email("Укажите корректный email."),
      z.literal(""),
    ])
    .optional()
    .default(""),
  companyName: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  deliveryMethodId: z.string().trim().optional().default(""),
  promoCode: z.string().trim().max(64).optional().default(""),
  redeemPoints: z
    .string()
    .trim()
    .regex(/^\d*$/, "Количество баллов укажите числом.")
    .optional()
    .default(""),
  comment: z.string().trim().optional().default(""),
  cartSnapshot: z.string().trim().min(2, "Корзина пуста."),
});

const cartItemSchema = z.object({
  productSlug: z.string().trim().min(1),
  quantity: z.number().int().positive().max(999),
});

type CheckoutFormState = {
  message?: string;
  success?: boolean;
  redirectTo?: string;
};

class CheckoutActionError extends Error {}

function buildOrderNumber() {
  const datePart = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `A-${datePart}-${randomPart}`;
}

function normalizeOptionalText(value: string) {
  return value.length > 0 ? value : null;
}

function normalizePromoCode(value: string) {
  return value.trim().toUpperCase();
}

export async function submitCheckoutAction(
  _prevState: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  if (!hasDatabaseUrl()) {
    return {
      message:
        "Оформление заказа станет доступно после подключения PostgreSQL и запуска seed-данных.",
    };
  }

  const parsed = checkoutSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    companyName: formData.get("companyName"),
    city: formData.get("city"),
    deliveryMethodId: formData.get("deliveryMethodId"),
    promoCode: formData.get("promoCode"),
    redeemPoints: formData.get("redeemPoints"),
    comment: formData.get("comment"),
    cartSnapshot: formData.get("cartSnapshot"),
  });

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ??
        "Проверьте контактные данные и состав заказа.",
    };
  }

  let cartItems: z.infer<typeof cartItemSchema>[];

  try {
    const rawCartItems = JSON.parse(parsed.data.cartSnapshot) as unknown;
    const parsedCartItems = z.array(cartItemSchema).safeParse(rawCartItems);

    if (!parsedCartItems.success || parsedCartItems.data.length === 0) {
      return {
        message: "Корзина пуста. Добавьте товары перед оформлением заказа.",
      };
    }

    cartItems = parsedCartItems.data;
  } catch {
    return {
      message:
        "Не удалось прочитать корзину. Обновите страницу и попробуйте ещё раз.",
    };
  }

  const db = getDb();
  const session = await getOptionalSession();
  const normalizedPromoCode = normalizePromoCode(parsed.data.promoCode);
  const requestedRedeemPoints = parsed.data.redeemPoints
    ? Number.parseInt(parsed.data.redeemPoints, 10)
    : 0;

  const [deliveryMethod, user, promotion] = await Promise.all([
    parsed.data.deliveryMethodId
      ? db.deliveryMethod.findUnique({
          where: { id: parsed.data.deliveryMethodId },
          select: {
            id: true,
            name: true,
            price: true,
            isActive: true,
          },
        })
      : Promise.resolve(null),
    session?.userId
      ? db.user.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            email: true,
            loyaltyTier: true,
            loyaltyPointsBalance: true,
            loyaltyPointsLifetime: true,
            personalDiscountPercent: true,
          },
        })
      : Promise.resolve(null),
    normalizedPromoCode
      ? db.promotion.findUnique({
          where: { promoCode: normalizedPromoCode },
          select: {
            id: true,
            name: true,
            status: true,
            targetType: true,
            discountType: true,
            discountValue: true,
            promoCode: true,
            minOrderTotal: true,
            usageLimit: true,
            usageCount: true,
            startsAt: true,
            endsAt: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (
    parsed.data.deliveryMethodId &&
    (!deliveryMethod || !deliveryMethod.isActive)
  ) {
    return {
      message:
        "Выбранный способ доставки сейчас недоступен. Обновите страницу.",
    };
  }

  if (requestedRedeemPoints > 0 && !user) {
    return {
      message: "Чтобы списать баллы, войдите в личный кабинет.",
    };
  }

  const productSlugs = [...new Set(cartItems.map((item) => item.productSlug))];
  const products = await db.product.findMany({
    where: {
      slug: {
        in: productSlugs,
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      price: true,
      brand: {
        select: {
          name: true,
        },
      },
    },
  });

  const productMap = new Map(
    products.map((product) => [product.slug, product]),
  );
  const fallbackProductMap = new Map(
    catalogProducts.map((product) => [product.slug, product]),
  );
  const missingProducts = cartItems.filter(
    (item) =>
      !productMap.has(item.productSlug) &&
      !fallbackProductMap.has(item.productSlug),
  );

  if (missingProducts.length > 0) {
    return {
      message:
        "Часть товаров уже изменилась в каталоге. Обновите корзину и повторите оформление.",
    };
  }

  const missingPrices = cartItems.some((item) => {
    const product = productMap.get(item.productSlug);
    const fallbackProduct = fallbackProductMap.get(item.productSlug);

    return typeof (product?.price ?? fallbackProduct?.price) !== "number";
  });

  if (missingPrices) {
    return {
      message:
        "У одного из товаров сейчас нет цены. Проверьте корзину или свяжитесь с менеджером.",
    };
  }

  const orderItems = cartItems.map((item) => {
    const product = productMap.get(item.productSlug);
    const fallbackProduct = fallbackProductMap.get(item.productSlug);
    const unitPrice = product?.price ?? fallbackProduct?.price ?? 0;
    const lineSubtotal = unitPrice * item.quantity;

    return {
      productId: product?.id ?? null,
      quantity: item.quantity,
      unitPrice,
      discountAmount: 0,
      total: lineSubtotal,
      snapshotName: product?.name ?? fallbackProduct?.name ?? item.productSlug,
      snapshotSku: product?.sku ?? fallbackProduct?.sku ?? null,
      snapshotBrand: product?.brand?.name ?? fallbackProduct?.brand ?? null,
      lineSubtotal,
    };
  });

  if (orderItems.length === 0) {
    return {
      message: "Корзина пуста. Добавьте товары перед оформлением заказа.",
    };
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const discountPercent = user ? getEffectiveDiscountPercent(user) : 0;
  const personalDiscountTotal = Math.round((subtotal * discountPercent) / 100);
  const subtotalAfterPersonalDiscount = Math.max(
    0,
    subtotal - personalDiscountTotal,
  );

  if (normalizedPromoCode) {
    if (!promotion || promotion.targetType !== PromotionTargetType.ORDER) {
      return {
        message:
          "Промокод не найден или не подходит для онлайн-оформления заказа.",
      };
    }

    if (!isPromotionActive(promotion)) {
      return {
        message: "Промокод сейчас недоступен или срок его действия уже истёк.",
      };
    }

    if (promotion.minOrderTotal && subtotal < promotion.minOrderTotal) {
      return {
        message: `Промокод действует для заказов от ${formatPrice(promotion.minOrderTotal)}.`,
      };
    }

    if (
      promotion.usageLimit !== null &&
      promotion.usageCount >= promotion.usageLimit
    ) {
      return {
        message: "Лимит применений этого промокода уже исчерпан.",
      };
    }
  }

  const promotionDiscountTotal = promotion
    ? applyPromotion(subtotalAfterPersonalDiscount, promotion).discountAmount
    : 0;
  const subtotalAfterPromotion = Math.max(
    0,
    subtotalAfterPersonalDiscount - promotionDiscountTotal,
  );
  const loyaltyRedemptionTotal = user
    ? getRedeemableLoyaltyPoints(
        requestedRedeemPoints,
        user.loyaltyPointsBalance,
        subtotalAfterPromotion,
      )
    : 0;
  const discountTotal = personalDiscountTotal + promotionDiscountTotal;
  const deliveryTotal = deliveryMethod?.price ?? 0;
  const total = Math.max(
    0,
    subtotalAfterPromotion - loyaltyRedemptionTotal + deliveryTotal,
  );
  const awardedPoints = user
    ? estimateLoyaltyPoints(
        Math.max(0, subtotalAfterPromotion - loyaltyRedemptionTotal),
        user.loyaltyTier,
      )
    : 0;

  const commentParts = [
    parsed.data.comment,
    parsed.data.city ? `Город: ${parsed.data.city}` : "",
  ].filter(Boolean);

  const orderNumber = buildOrderNumber();
  let createdOrderForSync: { id: string; number: string | null } | null = null;

  try {
    createdOrderForSync = await db.$transaction(async (tx) => {
      if (promotion) {
        if (promotion.usageLimit !== null) {
          const updatedPromotion = await tx.promotion.updateMany({
            where: {
              id: promotion.id,
              usageCount: {
                lt: promotion.usageLimit,
              },
            },
            data: {
              usageCount: {
                increment: 1,
              },
            },
          });

          if (updatedPromotion.count === 0) {
            throw new CheckoutActionError(
              "Лимит применений этого промокода уже исчерпан.",
            );
          }
        } else {
          await tx.promotion.update({
            where: { id: promotion.id },
            data: {
              usageCount: {
                increment: 1,
              },
            },
          });
        }
      }

      const order = await tx.order.create({
        data: {
          number: orderNumber,
          userId: user?.id ?? null,
          appliedPromotionId: promotion?.id ?? null,
          appliedPromoCode: promotion?.promoCode ?? null,
          status: OrderStatus.NEW,
          contactName: parsed.data.name,
          contactPhone: parsed.data.phone,
          contactEmail:
            normalizeOptionalText(parsed.data.email) ?? user?.email ?? null,
          companyName: normalizeOptionalText(parsed.data.companyName),
          deliveryMethodId: deliveryMethod?.id ?? null,
          comment: commentParts.length > 0 ? commentParts.join("\n") : null,
          subtotal,
          discountTotal,
          promotionDiscountTotal,
          loyaltyRedemptionTotal,
          deliveryTotal,
          total,
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount,
              total: item.total,
              snapshotName: item.snapshotName,
              snapshotSku: item.snapshotSku,
              snapshotBrand: item.snapshotBrand,
            })),
          },
        },
        select: {
          id: true,
          number: true,
        },
      });

      if (user && (awardedPoints > 0 || loyaltyRedemptionTotal > 0)) {
        const balanceAfterRedemption = Math.max(
          0,
          user.loyaltyPointsBalance - loyaltyRedemptionTotal,
        );
        const nextBalance = balanceAfterRedemption + awardedPoints;
        const nextLifetime = user.loyaltyPointsLifetime + awardedPoints;

        await tx.user.update({
          where: { id: user.id },
          data: {
            loyaltyPointsBalance: nextBalance,
            loyaltyPointsLifetime: nextLifetime,
            loyaltyTier: getLoyaltyTierForLifetimePoints(nextLifetime),
          },
        });

        if (loyaltyRedemptionTotal > 0) {
          await tx.loyaltyTransaction.create({
            data: {
              userId: user.id,
              orderId: order.id,
              type: LoyaltyTransactionType.REDEMPTION,
              points: -loyaltyRedemptionTotal,
              balanceAfter: balanceAfterRedemption,
              title: "Списание баллов",
              description: `Списание бонусов при оформлении заказа ${order.number ?? order.id}.`,
            },
          });
        }

        if (awardedPoints > 0) {
          await tx.loyaltyTransaction.create({
            data: {
              userId: user.id,
              orderId: order.id,
              type: LoyaltyTransactionType.ORDER_ACCRUAL,
              points: awardedPoints,
              balanceAfter: nextBalance,
              title: "Баллы за заказ",
              description: `Начисление после оформления заказа ${order.number ?? order.id}.`,
            },
          });
        }
      }

      return order;
    });
  } catch (error) {
    if (error instanceof CheckoutActionError) {
      return {
        message: error.message,
      };
    }

    return {
      message:
        "Не удалось оформить заказ. Попробуйте ещё раз или передайте заказ менеджеру.",
    };
  }

  if (createdOrderForSync) {
    await handleOrderCreated({
      id: createdOrderForSync.id,
      number: createdOrderForSync.number ?? orderNumber,
      status: OrderStatus.NEW,
      contactName: parsed.data.name,
      contactPhone: parsed.data.phone,
      contactEmail: normalizeOptionalText(parsed.data.email) ?? user?.email ?? null,
      companyName: normalizeOptionalText(parsed.data.companyName),
      comment: commentParts.length > 0 ? commentParts.join("\n") : null,
      deliveryMethod: deliveryMethod?.name ?? null,
      total,
      subtotal,
      discountTotal,
      deliveryTotal,
      createdAt: new Date().toISOString(),
      items: orderItems.map((item) => ({
        name: item.snapshotName,
        sku: item.snapshotSku,
        brand: item.snapshotBrand,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    });
  }

  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/account");
  revalidatePath("/account/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/promotions");
  revalidatePath("/admin/users");

  const redirectTo = new URLSearchParams({
    order: orderNumber,
    points: String(awardedPoints),
    redeemed: String(loyaltyRedemptionTotal),
  });

  return {
    success: true,
    redirectTo: `/checkout/success?${redirectTo.toString()}`,
  };
}

export type { CheckoutFormState };
