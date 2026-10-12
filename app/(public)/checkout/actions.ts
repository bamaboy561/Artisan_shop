"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  LoyaltyTransactionStatus,
  LoyaltyTransactionType,
  OrderStatus,
  ProductOrderMode,
  ProductStatus,
  PromotionTargetType,
} from "@/generated/prisma";
import { getEffectiveProductPrice } from "@/features/catalog/bundle-pricing";
import { getOptionalSession } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/commerce";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { handleOrderCreated } from "@/lib/server/commercial-integrations";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import {
  applyApprovedLoyaltyDelta,
  InsufficientLoyaltyBalanceError,
} from "@/lib/server/loyalty-ledger";
import {
  InventoryAvailabilityError,
  reserveInventoryItems,
} from "@/lib/server/inventory-reservations";
import { logOperationEvent } from "@/lib/server/operation-events";
import {
  getProductPromotionPrice,
  PROMOTION_PRICE_SELECT,
} from "@/lib/server/product-promotion-pricing";
import type { CheckoutFormState } from "@/app/(public)/checkout/types";
import {
  applyPromotion,
  estimateLoyaltyPointsForLines,
  getEffectiveDiscountPercent,
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

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitCheckoutAction(
  _prevState: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  if (!hasDatabaseUrl()) {
    return {
      message:
        "Оформление заказа станет доступно после подключения PostgreSQL и production bootstrap.",
    };
  }

  const parsed = checkoutSchema.safeParse({
    name: getFormString(formData, "name"),
    phone: getFormString(formData, "phone"),
    email: getFormString(formData, "email"),
    companyName: getFormString(formData, "companyName"),
    promoCode: getFormString(formData, "promoCode"),
    redeemPoints: getFormString(formData, "redeemPoints"),
    comment: getFormString(formData, "comment"),
    cartSnapshot: getFormString(formData, "cartSnapshot"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
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

    const quantityByProduct = new Map<string, number>();
    for (const item of parsedCartItems.data) {
      quantityByProduct.set(
        item.productSlug,
        (quantityByProduct.get(item.productSlug) ?? 0) + item.quantity,
      );
    }

    if ([...quantityByProduct.values()].some((quantity) => quantity > 999)) {
      return {
        message: "Количество одного товара в заказе не может превышать 999 шт.",
      };
    }

    cartItems = [...quantityByProduct].map(([productSlug, quantity]) => ({
      productSlug,
      quantity,
    }));
  } catch {
    return {
      message:
        "Не удалось прочитать корзину. Обновите страницу и попробуйте еще раз.",
    };
  }

  const db = getDb();
  const session = await getOptionalSession();
  const normalizedPromoCode = normalizePromoCode(parsed.data.promoCode);
  const requestedRedeemPoints = Math.max(
    0,
    Number.parseInt(parsed.data.redeemPoints || "0", 10) || 0,
  );

  const [user, promotion] = await Promise.all([
    session?.userId
      ? db.user.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            email: true,
            loyaltyTier: true,
            plateMaterialLoyaltyTier: true,
            fittingsLoyaltyTier: true,
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

  if (requestedRedeemPoints > 0 && !user) {
    return {
      message: "Чтобы списать баллы, войдите в личный кабинет.",
    };
  }

  const productSlugs = [...new Set(cartItems.map((item) => item.productSlug))];
  const products = await db.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      orderMode: ProductOrderMode.CART,
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
      stockQuantity: true,
      promotions: {
        select: {
          promotion: { select: PROMOTION_PRICE_SELECT },
        },
      },
      bundleItems: {
        select: {
          quantity: true,
          componentProduct: {
            select: {
              price: true,
            },
          },
        },
      },
      brand: {
        select: {
          name: true,
        },
      },
      category: {
        select: {
          kind: true,
          promotions: {
            select: {
              promotion: { select: PROMOTION_PRICE_SELECT },
            },
          },
        },
      },
    },
  });

  const productMap = new Map(
    products.map((product) => [product.slug, product]),
  );
  const missingProducts = cartItems.filter(
    (item) => !productMap.has(item.productSlug),
  );

  if (missingProducts.length > 0) {
    return {
      message:
        "Часть товаров изменилась в каталоге. Обновите корзину и повторите оформление.",
    };
  }

  const orderItems = cartItems.map((item) => {
    const product = productMap.get(item.productSlug);
    const unitPrice = product ? (getEffectiveProductPrice(product) ?? 0) : 0;
    const promotionPrice = product
      ? getProductPromotionPrice(
          unitPrice,
          product.promotions,
          product.category.promotions,
        )
      : null;
    const discountAmount =
      (promotionPrice?.unitDiscountAmount ?? 0) * item.quantity;
    const lineSubtotal = unitPrice * item.quantity;
    const total = Math.max(0, lineSubtotal - discountAmount);

    return {
      productId: product?.id ?? null,
      quantity: item.quantity,
      unitPrice,
      discountAmount,
      total,
      snapshotName: product?.name ?? item.productSlug,
      snapshotSku: product?.sku ?? null,
      snapshotBrand: product?.brand?.name ?? null,
      categoryKind: product?.category.kind ?? null,
      lineSubtotal,
    };
  });

  if (orderItems.length === 0) {
    return {
      message: "Корзина пуста. Добавьте товары перед оформлением заказа.",
    };
  }

  const loyaltyConfig = await getLoyaltyProgramConfig();
  const subtotal = orderItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const linePromotionDiscountTotal = orderItems.reduce(
    (sum, item) => sum + item.discountAmount,
    0,
  );
  const subtotalAfterLinePromotions = Math.max(
    0,
    subtotal - linePromotionDiscountTotal,
  );
  const personalDiscountPercent = user ? getEffectiveDiscountPercent(user) : 0;
  const personalDiscountTotal = Math.round(
    (subtotalAfterLinePromotions * personalDiscountPercent) / 100,
  );
  const subtotalAfterPersonalDiscount = Math.max(
    0,
    subtotalAfterLinePromotions - personalDiscountTotal,
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
        message: "Промокод сейчас недоступен или срок его действия уже истек.",
      };
    }

    if (
      promotion.minOrderTotal &&
      subtotalAfterLinePromotions < promotion.minOrderTotal
    ) {
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

  const orderPromotionDiscountTotal = promotion
    ? applyPromotion(subtotalAfterPersonalDiscount, promotion).discountAmount
    : 0;
  const promotionDiscountTotal =
    linePromotionDiscountTotal + orderPromotionDiscountTotal;
  const subtotalAfterPromotion = Math.max(
    0,
    subtotalAfterPersonalDiscount - orderPromotionDiscountTotal,
  );
  const loyaltyRedemptionTotal = user
    ? getRedeemableLoyaltyPoints(
        requestedRedeemPoints,
        user.loyaltyPointsBalance,
        subtotalAfterPromotion,
        loyaltyConfig,
      )
    : 0;
  const discountTotal = personalDiscountTotal + promotionDiscountTotal;
  // Online checkout is pickup-only, including submissions from older tabs.
  const deliveryTotal = 0;
  const total = Math.max(
    0,
    subtotalAfterPromotion - loyaltyRedemptionTotal + deliveryTotal,
  );
  const accrualBase = Math.max(
    0,
    subtotalAfterPromotion - loyaltyRedemptionTotal,
  );
  const accrualRatio = subtotal > 0 ? accrualBase / subtotal : 0;
  const awardedPoints = user
    ? estimateLoyaltyPointsForLines(
        orderItems.map((item) => ({
          total: item.lineSubtotal * accrualRatio,
          categoryKind: item.categoryKind,
        })),
        user,
        loyaltyConfig,
      )
    : 0;

  const commentParts = [parsed.data.comment].filter(Boolean);

  let orderNumber = buildOrderNumber();

  // Номер уникален в базе: при совпадении берём другой, а не роняем заказ.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await db.order.findUnique({
      where: { number: orderNumber },
      select: { id: true },
    });

    if (!taken) break;
    orderNumber = buildOrderNumber();
  }
  let createdOrderForSync: { id: string; number: string | null } | null = null;

  try {
    createdOrderForSync = await db.$transaction(async (tx) => {
      await reserveInventoryItems(
        tx,
        orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          name: item.snapshotName,
        })),
        { requireOnlineAvailability: true },
      );

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
          inventoryReservedAt: new Date(),
          contactName: parsed.data.name,
          contactPhone: parsed.data.phone,
          contactEmail:
            normalizeOptionalText(parsed.data.email) ?? user?.email ?? null,
          companyName: normalizeOptionalText(parsed.data.companyName),
          deliveryMethodId: null,
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
              snapshotCategoryKind: item.categoryKind,
            })),
          },
        },
        select: {
          id: true,
          number: true,
        },
      });

      if (user && (awardedPoints > 0 || loyaltyRedemptionTotal > 0)) {
        let balanceAfterRedemption = user.loyaltyPointsBalance;

        if (loyaltyRedemptionTotal > 0) {
          const redemption = await applyApprovedLoyaltyDelta(tx, {
            userId: user.id,
            orderId: order.id,
            type: LoyaltyTransactionType.REDEMPTION,
            points: -loyaltyRedemptionTotal,
            requireSufficientBalance: true,
            title: "Списание баллов",
            description: `Списание бонусов при оформлении заказа ${order.number ?? order.id}.`,
          });
          balanceAfterRedemption = redemption.balanceAfter;
        }

        if (awardedPoints > 0) {
          await tx.loyaltyTransaction.create({
            data: {
              userId: user.id,
              orderId: order.id,
              type: LoyaltyTransactionType.ORDER_ACCRUAL,
              status: LoyaltyTransactionStatus.PENDING,
              points: awardedPoints,
              balanceAfter: balanceAfterRedemption,
              title: "Баллы ожидают подтверждения",
              description: `Начисление за заказ ${order.number ?? order.id} будет добавлено после подтверждения менеджером.`,
            },
          });
        }
      }

      return order;
    });
  } catch (error) {
    if (error instanceof InventoryAvailabilityError) {
      return {
        message: error.message,
      };
    }

    if (error instanceof CheckoutActionError) {
      return {
        message: error.message,
      };
    }

    if (error instanceof InsufficientLoyaltyBalanceError) {
      return { message: error.message };
    }

    return {
      message:
        "Не удалось оформить заказ. Попробуйте еще раз или передайте заказ менеджеру.",
    };
  }

  if (createdOrderForSync) {
    await logOperationEvent({
      entityType: "order",
      entityId: createdOrderForSync.id,
      eventType: "created",
      title: `Заказ ${createdOrderForSync.number ?? orderNumber} создан`,
      description: `Онлайн-заказ с сайта на сумму ${formatPrice(total)}.`,
      toStatus: OrderStatus.NEW,
      isVisibleToClient: true,
      actorName: parsed.data.name,
    });

    await handleOrderCreated({
      id: createdOrderForSync.id,
      userId: user?.id ?? null,
      number: createdOrderForSync.number ?? orderNumber,
      status: OrderStatus.NEW,
      contactName: parsed.data.name,
      contactPhone: parsed.data.phone,
      contactEmail:
        normalizeOptionalText(parsed.data.email) ?? user?.email ?? null,
      companyName: normalizeOptionalText(parsed.data.companyName),
      comment: commentParts.length > 0 ? commentParts.join("\n") : null,
      deliveryMethod: "Самовывоз",
      total,
      subtotal,
      discountTotal,
      deliveryTotal,
      loyaltyPointsDelta: awardedPoints,
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
  revalidatePath("/");
  revalidatePath("/catalog");
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
