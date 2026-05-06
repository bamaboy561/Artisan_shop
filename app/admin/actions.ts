"use server";

import {
  DiscountType,
  InventoryStatus,
  LoyaltyTier,
  LoyaltyTransactionType,
  OrderStatus,
  ProductOrderMode,
  ProductStatus,
  PromotionStatus,
  PromotionTargetType,
  RequestStatus,
} from "@/generated/prisma";
import {
  handleOrderUpdated,
  handleOrderCreated,
  handleRequestUpdated,
} from "@/lib/server/commercial-integrations";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl, getDb } from "@/lib/db";
import {
  bulkUpdateOrderInboxItems,
  createOrderFromRequest,
  getOrderInbox,
  getOrderInboxItemById,
  getOrdersForRequest,
  updateOrderInboxItem,
} from "@/lib/server/order-inbox";
import {
  bulkUpdateRequestInboxItems,
  getRequestInbox,
  getRequestDetailById,
  getRequestInboxItemById,
  updateRequestInboxItem,
} from "@/lib/server/request-inbox";
import { revalidatePath } from "next/cache";

type ManagerSnapshot = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null;

type TransitionSnapshot = {
  previousStatus?: string | null;
  previousManager?: ManagerSnapshot;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value.length > 0 ? value : null;
}

function getOptionalInt(formData: FormData, key: string) {
  const value = getString(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? null : parsed;
}

function getOptionalDate(formData: FormData, key: string) {
  const value = getString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
    .filter(Boolean);
}

function revalidateAdminCatalog() {
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/brands");
  revalidatePath("/admin/products");
}

function revalidateAdminOperations() {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/requests");
}

function revalidateAdminPromotions() {
  revalidatePath("/admin");
  revalidatePath("/admin/promotions");
}

function revalidateAdminUsers() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/account");
  revalidatePath("/account/orders");
  revalidatePath("/account/requests");
  revalidatePath("/account/favorites");
}

async function syncOrderById(
  orderId: string,
  transition?: TransitionSnapshot,
) {
  const order = await getOrderInboxItemById(orderId);

  if (!order) {
    return;
  }

  await handleOrderUpdated({
    id: order.id,
    number: order.number,
    status: order.status,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    contactEmail: order.contactEmail,
    companyName: order.companyName,
    comment: order.comment,
    total: order.total,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    deliveryTotal: order.deliveryTotal,
    deliveryMethod: order.deliveryMethod?.name ?? null,
    createdAt: order.createdAt.toISOString(),
    manager: order.manager,
    previousStatus: transition?.previousStatus,
    previousManager: transition?.previousManager,
    items: order.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      brand: item.brand,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
  });
}

async function syncRequestById(
  requestId: string,
  transition?: TransitionSnapshot,
) {
  const request = await getRequestInboxItemById(requestId);

  if (!request) {
    return;
  }

  await handleRequestUpdated({
    id: request.id,
    number: request.number,
    requestType: request.type,
    subject: request.subject,
    status: request.status,
    contactName: request.contactName,
    contactPhone: request.contactPhone,
    contactEmail: request.contactEmail,
    messengerType: request.messengerType,
    messengerHandle: request.messengerHandle,
    material: request.material,
    edgeOption: request.edgeOption,
    estimatedBudget: request.estimatedBudget,
    deliveryNeeded: request.deliveryNeeded,
    message: request.message,
    createdAt: request.createdAt.toISOString(),
    manager: request.manager,
    previousStatus: transition?.previousStatus,
    previousManager: transition?.previousManager,
    product: request.product,
  });
}

async function ensureAdminAccess() {
  await requireAdminSession("/login?next=/admin");
}

export async function createCategoryAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const name = getString(formData, "name");
  const slug = getString(formData, "slug");

  if (!name || !slug) {
    return;
  }

  await getDb().category.create({
    data: {
      name,
      slug,
      summary: getOptionalString(formData, "summary"),
      indicator: getOptionalString(formData, "indicator"),
      scenario: getOptionalString(formData, "scenario"),
      sortOrder: getOptionalInt(formData, "sortOrder") ?? 0,
    },
  });

  revalidateAdminCatalog();
}

export async function deleteCategoryAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const db = getDb();
  const linkedProducts = await db.product.count({
    where: { categoryId: id },
  });

  if (linkedProducts > 0) {
    return;
  }

  await db.$transaction([
    db.promotionCategory.deleteMany({
      where: { categoryId: id },
    }),
    db.category.delete({
      where: { id },
    }),
  ]);

  revalidateAdminCatalog();
}

export async function createBrandAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const name = getString(formData, "name");
  const slug = getString(formData, "slug");

  if (!name || !slug) {
    return;
  }

  await getDb().brand.create({
    data: {
      name,
      slug,
      country: getOptionalString(formData, "country"),
      website: getOptionalString(formData, "website"),
      description: getOptionalString(formData, "description"),
    },
  });

  revalidateAdminCatalog();
}

export async function deleteBrandAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const db = getDb();
  const linkedProducts = await db.product.count({
    where: { brandId: id },
  });

  if (linkedProducts > 0) {
    return;
  }

  await db.brand.delete({
    where: { id },
  });

  revalidateAdminCatalog();
}

export async function createProductAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const name = getString(formData, "name");
  const slug = getString(formData, "slug");
  const sku = getString(formData, "sku");
  const categoryId = getString(formData, "categoryId");

  if (!name || !slug || !sku || !categoryId) {
    return;
  }

  const status = getString(formData, "status");
  const orderMode = getString(formData, "orderMode");
  const inventoryStatus = getString(formData, "inventoryStatus");

  await getDb().product.create({
    data: {
      name,
      slug,
      sku,
      categoryId,
      brandId: getOptionalString(formData, "brandId"),
      summary: getOptionalString(formData, "summary"),
      format: getOptionalString(formData, "format"),
      price: getOptionalInt(formData, "price"),
      status:
        Object.values(ProductStatus).find((item) => item === status) ??
        ProductStatus.DRAFT,
      orderMode:
        Object.values(ProductOrderMode).find((item) => item === orderMode) ??
        ProductOrderMode.REQUEST_PRICE,
      inventoryStatus:
        Object.values(InventoryStatus).find(
          (item) => item === inventoryStatus,
        ) ?? InventoryStatus.ON_REQUEST,
      isFeatured: getString(formData, "isFeatured") === "on",
      images: getOptionalString(formData, "imageUrl")
        ? {
            create: [
              {
                url: getString(formData, "imageUrl"),
                alt: name,
                sortOrder: 10,
              },
            ],
          }
        : undefined,
    },
  });

  revalidateAdminCatalog();
}

export async function deleteProductAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const db = getDb();

  await db.$transaction([
    db.favorite.deleteMany({ where: { productId: id } }),
    db.productImage.deleteMany({ where: { productId: id } }),
    db.productAttribute.deleteMany({ where: { productId: id } }),
    db.promotionProduct.deleteMany({ where: { productId: id } }),
    db.product.delete({ where: { id } }),
  ]);

  revalidateAdminCatalog();
}

export async function updateProductAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const status = getString(formData, "status");
  const orderMode = getString(formData, "orderMode");
  const inventoryStatus = getString(formData, "inventoryStatus");

  if (!id) {
    return;
  }

  await getDb().product.update({
    where: { id },
    data: {
      status:
        Object.values(ProductStatus).find((item) => item === status) ??
        ProductStatus.DRAFT,
      orderMode:
        Object.values(ProductOrderMode).find((item) => item === orderMode) ??
        ProductOrderMode.REQUEST_PRICE,
      inventoryStatus:
        Object.values(InventoryStatus).find(
          (item) => item === inventoryStatus,
        ) ?? InventoryStatus.ON_REQUEST,
      isFeatured: getString(formData, "isFeatured") === "on",
    },
  });

  revalidateAdminCatalog();
}

export async function bulkUpdateProductsAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const productIds = Array.from(new Set(getStringList(formData, "productIds")));
  const bulkAction = getString(formData, "bulkAction");

  if (productIds.length === 0 || !bulkAction) {
    return;
  }

  const db = getDb();

  switch (bulkAction) {
    case "publish":
      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { status: ProductStatus.ACTIVE },
      });
      break;
    case "move-to-draft":
      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { status: ProductStatus.DRAFT },
      });
      break;
    case "archive":
      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { status: ProductStatus.ARCHIVED },
      });
      break;
    case "feature":
      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { isFeatured: true },
      });
      break;
    case "unfeature":
      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { isFeatured: false },
      });
      break;
    case "set-cart":
      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { orderMode: ProductOrderMode.CART },
      });
      break;
    case "set-request-price":
      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { orderMode: ProductOrderMode.REQUEST_PRICE },
      });
      break;
    case "set-service":
      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { orderMode: ProductOrderMode.SERVICE },
      });
      break;
    default:
      return;
  }

  revalidateAdminCatalog();
}

export async function updateOrderAction(formData: FormData) {
  await ensureAdminAccess();

  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (!id || !status) {
    return;
  }

  const previousOrder = await getOrderInboxItemById(id);

  await updateOrderInboxItem({
    id,
    status:
      Object.values(OrderStatus).find((item) => item === status) ??
      OrderStatus.NEW,
    managerId: getOptionalString(formData, "managerId"),
  });

  await syncOrderById(
    id,
    previousOrder
      ? {
          previousStatus: previousOrder.status,
          previousManager: previousOrder.manager,
        }
      : undefined,
  );

  revalidateAdminOperations();
}

export async function bulkUpdateOrdersAction(formData: FormData) {
  await ensureAdminAccess();

  const orderIds = Array.from(new Set(getStringList(formData, "orderIds")));
  const bulkAction = getString(formData, "bulkAction");
  const managerId = getOptionalString(formData, "managerId");

  if (orderIds.length === 0 || !bulkAction) {
    return;
  }

  const previousOrders = (await getOrderInbox()).filter((order) =>
    orderIds.includes(order.id),
  );
  const previousOrderMap = new Map(
    previousOrders.map((order) => [
      order.id,
      {
        previousStatus: order.status,
        previousManager: order.manager,
      } satisfies TransitionSnapshot,
    ]),
  );

  switch (bulkAction) {
    case "confirm":
      await bulkUpdateOrderInboxItems({
        orderIds,
        status: OrderStatus.CONFIRMED,
      });
      break;
    case "to-production":
      await bulkUpdateOrderInboxItems({
        orderIds,
        status: OrderStatus.IN_PRODUCTION,
      });
      break;
    case "ready-for-pickup":
      await bulkUpdateOrderInboxItems({
        orderIds,
        status: OrderStatus.READY_FOR_PICKUP,
      });
      break;
    case "ship":
      await bulkUpdateOrderInboxItems({
        orderIds,
        status: OrderStatus.SHIPPED,
      });
      break;
    case "complete":
      await bulkUpdateOrderInboxItems({
        orderIds,
        status: OrderStatus.COMPLETED,
      });
      break;
    case "cancel":
      await bulkUpdateOrderInboxItems({
        orderIds,
        status: OrderStatus.CANCELED,
      });
      break;
    case "assign-manager":
      if (!managerId) {
        return;
      }

      await bulkUpdateOrderInboxItems({
        orderIds,
        managerId,
      });
      break;
    case "clear-manager":
      await bulkUpdateOrderInboxItems({
        orderIds,
        clearManager: true,
      });
      break;
    default:
      return;
  }

  await Promise.all(
    orderIds.map((orderId) => syncOrderById(orderId, previousOrderMap.get(orderId))),
  );

  revalidateAdminOperations();
}

export async function createOrderFromRequestAction(formData: FormData) {
  await ensureAdminAccess();

  const requestId = getString(formData, "requestId");

  if (!requestId) {
    return;
  }

  const request = await getRequestDetailById(requestId);

  if (!request || request.status === RequestStatus.CANCELED) {
    return;
  }

  const existingOrders = await getOrdersForRequest(requestId);

  if (existingOrders.length > 0) {
    return;
  }

  const createdOrder = await createOrderFromRequest(request);

  await updateRequestInboxItem({
    id: requestId,
    status: RequestStatus.COMPLETED,
    managerId: request.managerId ?? null,
  });

  await handleOrderCreated({
    id: createdOrder.id,
    number: createdOrder.number ?? null,
    status: OrderStatus.NEW,
    contactName: request.contactName,
    contactPhone: request.contactPhone,
    contactEmail: request.contactEmail,
    companyName: null,
    comment: request.message,
    deliveryMethod: request.deliveryNeeded ? "Требует уточнения" : "Самовывоз / уточнить",
    total: request.estimatedBudget ?? 0,
    subtotal: request.estimatedBudget ?? 0,
    discountTotal: 0,
    deliveryTotal: 0,
    createdAt: new Date().toISOString(),
    manager: request.manager,
    items: [
      {
        name: request.product?.name ?? request.subject,
        sku: request.product?.sku ?? request.number ?? null,
        brand: request.material ?? null,
        quantity: 1,
        unitPrice: request.estimatedBudget ?? 0,
        total: request.estimatedBudget ?? 0,
      },
    ],
  });

  await syncRequestById(requestId, {
    previousStatus: request.status,
    previousManager: request.manager,
  });

  revalidateAdminOperations();
}

export async function updateRequestAction(formData: FormData) {
  await ensureAdminAccess();

  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (!id || !status) {
    return;
  }

  const previousRequest = await getRequestInboxItemById(id);

  await updateRequestInboxItem({
    id,
    status:
      Object.values(RequestStatus).find((item) => item === status) ??
      RequestStatus.NEW,
    managerId: getOptionalString(formData, "managerId"),
  });

  await syncRequestById(
    id,
    previousRequest
      ? {
          previousStatus: previousRequest.status,
          previousManager: previousRequest.manager,
        }
      : undefined,
  );

  revalidateAdminOperations();
}

export async function bulkUpdateRequestsAction(formData: FormData) {
  await ensureAdminAccess();

  const requestIds = Array.from(new Set(getStringList(formData, "requestIds")));
  const bulkAction = getString(formData, "bulkAction");
  const managerId = getOptionalString(formData, "managerId");

  if (requestIds.length === 0 || !bulkAction) {
    return;
  }

  const previousRequestMap = new Map(
    (await getRequestInbox())
      .filter((request) => requestIds.includes(request.id))
      .map((request) => [
        request.id,
        {
          previousStatus: request.status,
          previousManager: request.manager,
        } satisfies TransitionSnapshot,
      ]),
  );

  switch (bulkAction) {
    case "review":
      await bulkUpdateRequestInboxItems({
        requestIds,
        status: RequestStatus.IN_REVIEW,
      });
      break;
    case "quote-sent":
      await bulkUpdateRequestInboxItems({
        requestIds,
        status: RequestStatus.QUOTE_SENT,
      });
      break;
    case "waiting-client":
      await bulkUpdateRequestInboxItems({
        requestIds,
        status: RequestStatus.WAITING_FOR_CLIENT,
      });
      break;
    case "in-progress":
      await bulkUpdateRequestInboxItems({
        requestIds,
        status: RequestStatus.IN_PROGRESS,
      });
      break;
    case "complete":
      await bulkUpdateRequestInboxItems({
        requestIds,
        status: RequestStatus.COMPLETED,
      });
      break;
    case "cancel":
      await bulkUpdateRequestInboxItems({
        requestIds,
        status: RequestStatus.CANCELED,
      });
      break;
    case "assign-manager":
      if (!managerId) {
        return;
      }

      await bulkUpdateRequestInboxItems({
        requestIds,
        managerId,
      });
      break;
    case "clear-manager":
      await bulkUpdateRequestInboxItems({
        requestIds,
        clearManager: true,
      });
      break;
    default:
      return;
  }

  await Promise.all(
    requestIds.map((requestId) =>
      syncRequestById(requestId, previousRequestMap.get(requestId)),
    ),
  );

  revalidateAdminOperations();
}

export async function createPromotionAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const name = getString(formData, "name");
  const slug = getString(formData, "slug");
  const status = getString(formData, "status");
  const targetType = getString(formData, "targetType");
  const discountType = getString(formData, "discountType");
  const discountValue = getOptionalInt(formData, "discountValue");

  if (!name || !slug || !discountValue) {
    return;
  }

  const normalizedTargetType =
    Object.values(PromotionTargetType).find((item) => item === targetType) ??
    PromotionTargetType.ORDER;

  const selectedProductId = getOptionalString(formData, "productId");
  const selectedCategoryId = getOptionalString(formData, "categoryId");

  await getDb().promotion.create({
    data: {
      name,
      slug,
      description: getOptionalString(formData, "description"),
      status:
        Object.values(PromotionStatus).find((item) => item === status) ??
        PromotionStatus.DRAFT,
      targetType: normalizedTargetType,
      discountType:
        Object.values(DiscountType).find((item) => item === discountType) ??
        DiscountType.PERCENT,
      discountValue,
      promoCode: getOptionalString(formData, "promoCode")?.toUpperCase(),
      minOrderTotal: getOptionalInt(formData, "minOrderTotal"),
      usageLimit: getOptionalInt(formData, "usageLimit"),
      badgeText: getOptionalString(formData, "badgeText"),
      isHighlighted: getString(formData, "isHighlighted") === "on",
      startsAt: getOptionalDate(formData, "startsAt"),
      endsAt: getOptionalDate(formData, "endsAt"),
      products:
        normalizedTargetType === PromotionTargetType.PRODUCT &&
        selectedProductId
          ? {
              create: [{ productId: selectedProductId }],
            }
          : undefined,
      categories:
        normalizedTargetType === PromotionTargetType.CATEGORY &&
        selectedCategoryId
          ? {
              create: [{ categoryId: selectedCategoryId }],
            }
          : undefined,
    },
  });

  revalidateAdminPromotions();
}

export async function updatePromotionAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (!id) {
    return;
  }

  await getDb().promotion.update({
    where: { id },
    data: {
      status:
        Object.values(PromotionStatus).find((item) => item === status) ??
        PromotionStatus.DRAFT,
      promoCode: getOptionalString(formData, "promoCode")?.toUpperCase() ?? null,
      badgeText: getOptionalString(formData, "badgeText"),
      isHighlighted: getString(formData, "isHighlighted") === "on",
    },
  });

  revalidateAdminPromotions();
}

export async function bulkUpdatePromotionsAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const promotionIds = Array.from(
    new Set(getStringList(formData, "promotionIds")),
  );
  const bulkAction = getString(formData, "bulkAction");

  if (promotionIds.length === 0 || !bulkAction) {
    return;
  }

  const db = getDb();

  switch (bulkAction) {
    case "activate":
      await db.promotion.updateMany({
        where: { id: { in: promotionIds } },
        data: { status: PromotionStatus.ACTIVE },
      });
      break;
    case "schedule":
      await db.promotion.updateMany({
        where: { id: { in: promotionIds } },
        data: { status: PromotionStatus.SCHEDULED },
      });
      break;
    case "archive":
      await db.promotion.updateMany({
        where: { id: { in: promotionIds } },
        data: { status: PromotionStatus.ARCHIVED },
      });
      break;
    case "highlight":
      await db.promotion.updateMany({
        where: { id: { in: promotionIds } },
        data: { isHighlighted: true },
      });
      break;
    case "unhighlight":
      await db.promotion.updateMany({
        where: { id: { in: promotionIds } },
        data: { isHighlighted: false },
      });
      break;
    case "clear-code":
      await db.promotion.updateMany({
        where: { id: { in: promotionIds } },
        data: { promoCode: null },
      });
      break;
    case "delete":
      await db.$transaction([
        db.promotionProduct.deleteMany({
          where: { promotionId: { in: promotionIds } },
        }),
        db.promotionCategory.deleteMany({
          where: { promotionId: { in: promotionIds } },
        }),
        db.promotion.deleteMany({
          where: { id: { in: promotionIds } },
        }),
      ]);
      break;
    default:
      return;
  }

  revalidateAdminPromotions();
}

export async function deletePromotionAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const db = getDb();

  await db.$transaction([
    db.promotionProduct.deleteMany({ where: { promotionId: id } }),
    db.promotionCategory.deleteMany({ where: { promotionId: id } }),
    db.promotion.delete({ where: { id } }),
  ]);

  revalidateAdminPromotions();
}

export async function updateUserLoyaltyAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const loyaltyTier = getString(formData, "loyaltyTier");
  const personalDiscountPercent = Math.max(
    0,
    getOptionalInt(formData, "personalDiscountPercent") ?? 0,
  );

  if (!id) {
    return;
  }

  await getDb().user.update({
    where: { id },
    data: {
      loyaltyTier:
        Object.values(LoyaltyTier).find((item) => item === loyaltyTier) ??
        LoyaltyTier.BRONZE,
      personalDiscountPercent: Math.min(25, personalDiscountPercent),
    },
  });

  revalidateAdminUsers();
}

export async function adjustUserLoyaltyPointsAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const pointsDelta = getOptionalInt(formData, "pointsDelta");

  if (!id || pointsDelta === null || pointsDelta === 0) {
    return;
  }

  const title = getOptionalString(formData, "title") ?? "Ручная корректировка";
  const description = getOptionalString(formData, "description");
  const db = getDb();
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      loyaltyPointsBalance: true,
      loyaltyPointsLifetime: true,
    },
  });

  if (!user) {
    return;
  }

  const nextBalance = Math.max(0, user.loyaltyPointsBalance + pointsDelta);
  const appliedDelta = nextBalance - user.loyaltyPointsBalance;

  if (appliedDelta === 0) {
    return;
  }

  await db.$transaction([
    db.user.update({
      where: { id },
      data: {
        loyaltyPointsBalance: nextBalance,
        loyaltyPointsLifetime:
          user.loyaltyPointsLifetime + Math.max(0, appliedDelta),
      },
    }),
    db.loyaltyTransaction.create({
      data: {
        userId: id,
        type: LoyaltyTransactionType.MANUAL_ADJUSTMENT,
        points: appliedDelta,
        balanceAfter: nextBalance,
        title,
        description,
      },
    }),
  ]);

  revalidateAdminUsers();
}
