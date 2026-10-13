"use server";

import { setStaffAccountAccessAction } from "@/app/admin/staff/actions";

import { safeProductionReturn } from "@/features/production/queue";
import {
  MAX_SALE_AMOUNT,
  parseSalesItemInputs,
} from "@/features/admin/sales-invoice-model";

import {
  BannerPlacement,
  CategoryKind,
  CuttingStage,
  DiscountType,
  InventoryStatus,
  LoyaltyTier,
  LoyaltyTransactionStatus,
  LoyaltyTransactionType,
  OrderStatus,
  PageStatus,
  ProductOrderMode,
  ProductStatus,
  ProductionStation,
  PromotionStatus,
  PromotionTargetType,
  RequestStatus,
  RequestType,
  RoleCode,
  type Prisma,
} from "@/generated/prisma";
import {
  parseProductImportFile,
  slugifyImportValue,
} from "@/features/admin/product-import";
import {
  BUNDLE_MARKER_ATTRIBUTE_NAME,
  BUNDLE_MARKER_ATTRIBUTE_VALUE,
  isBundleAttributeName,
} from "@/features/catalog/bundles";
import { getEffectiveProductPrice } from "@/features/catalog/bundle-pricing";
import { normalizeBrandSlug } from "@/features/catalog/data";
import {
  handleCuttingRequestCreated,
  handleOrderUpdated,
  handleOrderCreated,
  handleRequestUpdated,
  sendTelegramTestNotification,
  type TelegramThreadKey,
} from "@/lib/server/commercial-integrations";
import {
  getManagerDisplayName,
  orderStatusLabels,
  requestStatusLabels,
} from "@/features/admin/operations-filters";
import { cuttingStageLabels } from "@/features/cutting/progress";
import { getProductionTransition } from "@/features/production/workflow";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  canAccessGeneralAdmin,
  canAccessProduction,
  canAccessRequestType,
  canDeleteOrders,
  canDeleteRequests,
  canManageProduction,
  canManageStaff,
  getAdminHomePath,
  isCuttingManager,
  isProductionOperator,
  roleDefinitions,
} from "@/lib/auth/roles";
import {
  canManageLoyalty,
  setLoyaltyManagerAccess,
} from "@/lib/server/loyalty-permissions";
import { saveProductionPlan } from "@/lib/server/production-planning";
import {
  buildTechnicalClientEmail,
  isTechnicalClientEmail,
  normalizeClientPhone,
} from "@/features/admin/client-identity";
import { hasDatabaseUrl, getDb } from "@/lib/db";
import { ensureBrandLogoColumn } from "@/lib/server/brand-schema";
import { sendClientDirectMessage } from "@/lib/server/client-notifications";
import { logOperationEvent } from "@/lib/server/operation-events";
import {
  adjustInventoryReservation,
  InventoryAvailabilityError,
  reserveInventoryItems,
  syncOrderInventoryReservation,
} from "@/lib/server/inventory-reservations";
import { saveLatestInventoryValuation } from "@/lib/server/inventory-valuation";
import {
  applyApprovedLoyaltyDelta,
  InsufficientLoyaltyBalanceError,
} from "@/lib/server/loyalty-ledger";
import {
  rollbackManualLoyaltyTransaction,
  type RollbackLoyaltyResult,
} from "@/lib/server/loyalty-audit";
import { ensureLoyaltyAuditSchema } from "@/lib/server/loyalty-audit-schema";
import type { OrderLoyaltyCancellationResult } from "@/lib/server/order-loyalty-cancellation";
import { ensureProductBundleItemsTable } from "@/lib/server/product-bundle-schema";
import {
  applyPromotion,
  clampPersonalDiscountPercent,
  estimateLoyaltyPointsForLines,
  getEffectiveDiscountPercent,
  getHighestLoyaltyTier,
  getRedeemableLoyaltyPoints,
} from "@/lib/server/pricing";
import {
  getProductPromotionPrice,
  PROMOTION_PRICE_SELECT,
} from "@/lib/server/product-promotion-pricing";
import {
  getLoyaltyProgramConfig,
  saveLoyaltyProgramConfig,
} from "@/lib/server/loyalty-settings";
import { runMonthlyLoyaltyReview } from "@/lib/server/loyalty-monthly-review";
import { sendPushPromotionBroadcast } from "@/lib/server/push-notifications";
import {
  configureTelegramWebhook,
  sendTelegramDirectMessage,
  sendTelegramPromotionBroadcast,
} from "@/lib/server/telegram-bot";
import {
  bulkUpdateOrderInboxItems,
  createOrderFromRequest,
  getOrderInbox,
  getOrderInboxItemById,
  getOrdersForRequest,
  updateOrderInboxItem,
} from "@/lib/server/order-inbox";
import {
  addOrderManagerNote,
  updateOrderFulfillment,
} from "@/lib/server/order-production";
import {
  bulkUpdateRequestInboxItems,
  createCuttingRequest,
  deleteDemoRequestInboxItem,
  getRequestInbox,
  getRequestDetailById,
  getRequestInboxItemById,
  isAllowedRequestFile,
  updateRequestCuttingDetails,
  updateRequestInboxItem,
} from "@/lib/server/request-inbox";
import {
  addRequestManagerNote,
  addRequestResultFiles,
  updateRequestCuttingProgress,
  updateRequestProductionResult,
} from "@/lib/server/request-production";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ManagerSnapshot = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null;

type TransitionSnapshot = {
  previousStatus?: string | null;
  previousManager?: ManagerSnapshot;
  previousCuttingStage?: CuttingStage | null;
  previousCuttingPickupCell?: string | null;
  cuttingStageNote?: string | null;
  cuttingStageNoteInternal?: boolean;
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

function getOptionalUrl(formData: FormData, key: string) {
  const value = getOptionalString(formData, key);

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getOptionalInt(formData: FormData, key: string) {
  const value = getString(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? null : parsed;
}

function getOptionalFloat(formData: FormData, key: string) {
  const value = getString(formData, key).replace(",", ".");

  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function getOptionalDate(formData: FormData, key: string) {
  const value = getString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

// Дата окончания включительно: акция и баннер действуют до конца этого дня
// по времени Бишкека, а не обрываются в его начале.
function getOptionalEndDate(formData: FormData, key: string) {
  const value = getString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T23:59:59.999+06:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
    .filter(Boolean);
}

const orderReceiptPrefix = "Кассовый чек:";

function getOrderReceiptNumberFromComment(comment: string | null) {
  const line = (comment ?? "")
    .split(/\r?\n/)
    .find((item) =>
      item
        .trim()
        .toLocaleLowerCase("ru-RU")
        .startsWith(orderReceiptPrefix.toLocaleLowerCase("ru-RU")),
    );

  return line ? line.trim().slice(orderReceiptPrefix.length).trim() : null;
}

function removeOrderReceiptLine(comment: string | null) {
  return (comment ?? "")
    .split(/\r?\n/)
    .filter(
      (line) =>
        !line
          .trim()
          .toLocaleLowerCase("ru-RU")
          .startsWith(orderReceiptPrefix.toLocaleLowerCase("ru-RU")),
    )
    .join("\n")
    .trim();
}

function buildOrderCommentWithReceipt(
  comment: string | null,
  receiptNumber: string | null,
) {
  const body = removeOrderReceiptLine(comment);
  const lines = [
    receiptNumber ? `${orderReceiptPrefix} ${receiptNumber}` : "",
    body,
  ].filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : null;
}

function getOptionalUrlList(formData: FormData, key: string, limit = 4) {
  return getStringList(formData, key)
    .flatMap((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:"
          ? [url.toString()]
          : [];
      } catch {
        return [];
      }
    })
    .slice(0, limit);
}

function getOptionalJsonUrlList(formData: FormData, key: string, limit = 4) {
  const urls = getOptionalUrlList(formData, key, limit);
  return urls.length > 0 ? JSON.stringify(urls) : null;
}

const categoryDefaults: Record<
  CategoryKind,
  { indicator: string; scenario: string }
> = {
  [CategoryKind.PLATE]: {
    indicator: "Плитные материалы",
    scenario: "Запрос цены, образцы и расчет распила",
  },
  [CategoryKind.FITTINGS]: {
    indicator: "Фурнитура",
    scenario: "Покупка онлайн или запрос наличия",
  },
  [CategoryKind.OTHER]: {
    indicator: "Каталог",
    scenario: "Консультация менеджера",
  },
};

function safeSlugBase(value: string, fallback: string) {
  return slugifyImportValue(value) || fallback;
}

function generatedSkuBase(value: string) {
  return (
    safeSlugBase(value, "artisan")
      .replace(/-/g, "")
      .toUpperCase()
      .slice(0, 18) || "ARTISAN"
  );
}

async function getUniqueCategorySlug(
  db: ReturnType<typeof getDb>,
  value: string,
  currentId?: string,
) {
  const base = safeSlugBase(value, "category");
  let candidate = base;
  let index = 2;

  while (true) {
    const existing = await db.category.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === currentId) {
      return candidate;
    }

    candidate = `${base}-${index}`;
    index += 1;
  }
}

async function getUniqueProductSlug(
  db: ReturnType<typeof getDb>,
  value: string,
  currentId?: string,
) {
  const base = safeSlugBase(value, "product");
  let candidate = base;
  let index = 2;

  while (true) {
    const existing = await db.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === currentId) {
      return candidate;
    }

    candidate = `${base}-${index}`;
    index += 1;
  }
}

async function getUniqueProductSku(
  db: ReturnType<typeof getDb>,
  value: string,
  currentId?: string,
  preserveValue = false,
) {
  const base = preserveValue
    ? value.trim() || "ARTISAN"
    : generatedSkuBase(value);
  let candidate = base;
  let index = 2;

  while (true) {
    const existing = await db.product.findUnique({
      where: { sku: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === currentId) {
      return candidate;
    }

    candidate = `${base}-${index}`;
    index += 1;
  }
}

async function getNextCategorySortOrder(db: ReturnType<typeof getDb>) {
  const lastCategory = await db.category.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return (lastCategory?.sortOrder ?? 0) + 10;
}

function parseProductAttributes(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const separatorIndex = line.search(/[:=]/);

      if (separatorIndex <= 0) {
        return [];
      }

      const name = line.slice(0, separatorIndex).trim();
      const attributeValue = line.slice(separatorIndex + 1).trim();

      if (!name || !attributeValue) {
        return [];
      }

      return [
        {
          name,
          value: attributeValue,
          sortOrder: (index + 1) * 10,
        },
      ];
    });
}

function getProductAttributesFromForm(
  formData: FormData,
  hasBundleItems = false,
) {
  const baseAttributes = parseProductAttributes(
    getString(formData, "attributes"),
  ).filter((attribute) => !isBundleAttributeName(attribute.name));
  const isBundleProduct =
    getString(formData, "isBundleProduct") === "on" || hasBundleItems;
  const attributes = [...baseAttributes];

  if (isBundleProduct) {
    attributes.push({
      name: BUNDLE_MARKER_ATTRIBUTE_NAME,
      value: BUNDLE_MARKER_ATTRIBUTE_VALUE,
      sortOrder: 0,
    });
  }

  return attributes.map((attribute, index) => ({
    ...attribute,
    sortOrder: (index + 1) * 10,
  }));
}

function getBundleItemsFromForm(formData: FormData, currentProductId?: string) {
  const productIds = formData
    .getAll("bundleProductId")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  const quantities = formData.getAll("bundleQuantity");
  const seen = new Set<string>();

  return productIds.flatMap((componentProductId, index) => {
    if (
      seen.has(componentProductId) ||
      (currentProductId && componentProductId === currentProductId)
    ) {
      return [];
    }

    seen.add(componentProductId);
    const rawQuantity = quantities[index];
    const parsedQuantity =
      typeof rawQuantity === "string"
        ? Number.parseInt(rawQuantity, 10)
        : Number.NaN;
    const quantity = Number.isFinite(parsedQuantity)
      ? Math.max(1, Math.min(999, parsedQuantity))
      : 1;

    return [
      {
        componentProductId,
        quantity,
        sortOrder: (index + 1) * 10,
      },
    ];
  });
}

function getFileList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter(
      (value): value is File =>
        typeof value !== "string" &&
        typeof value.name === "string" &&
        value.size > 0,
    );
}

const PRODUCT_IMAGE_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const PRODUCT_IMAGE_LEGACY_SLOT_COUNT = 4;

function sanitizeUploadSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function isAllowedProductImage(file: File) {
  return PRODUCT_IMAGE_TYPES.has(file.type);
}

async function uploadProductImageFile(file: File, productSlug: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !isAllowedProductImage(file)) {
    return null;
  }

  const { put } = await import("@vercel/blob");
  const safeSlug = sanitizeUploadSegment(productSlug) || "product";
  const safeFileName = sanitizeUploadSegment(file.name) || "image";
  const pathname = `products/${safeSlug}/${Date.now()}-${safeFileName}`;
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return blob.url;
}

async function resolveProductImageUrls(
  formData: FormData,
  productSlug: string,
) {
  const urls: string[] = [];

  const uploadedImages = [
    ...getFileList(formData, "imageFiles"),
    ...Array.from({ length: PRODUCT_IMAGE_LEGACY_SLOT_COUNT }).flatMap(
      (_, index) => getFileList(formData, `imageFile${index}`),
    ),
  ];

  for (const uploadedImage of uploadedImages) {
    const blobUrl = await uploadProductImageFile(uploadedImage, productSlug);

    if (blobUrl) {
      urls.push(blobUrl);
    }
  }

  const imageUrlValues = [
    ...formData.getAll("imageUrl"),
    ...Array.from({ length: PRODUCT_IMAGE_LEGACY_SLOT_COUNT }).map((_, index) =>
      formData.get(`imageUrl${index}`),
    ),
  ];

  for (const value of imageUrlValues) {
    if (typeof value !== "string") {
      continue;
    }

    const imageUrl = value.trim();

    if (imageUrl) {
      urls.push(imageUrl);
    }
  }

  return [...new Set(urls)];
}

const PRODUCT_IMPORT_MAX_FILE_SIZE = 100 * 1024 * 1024;

function getValidImportImageUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    return value;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function normalizeImportLookup(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImportSkuKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/,0+$/, "")
    .replace(/\.0+$/, "");
}

function inferCalculatorSheetPresetFromFormat(format: string | null) {
  const match = (format ?? "").match(/(\d{3,4})\s*(?:x|х|×|\*)\s*(\d{3,4})/iu);

  if (!match) {
    return null;
  }

  return `${match[1]}x${match[2]}`;
}

function makeUniqueImportSlug(baseValue: string, usedSlugs: Set<string>) {
  const fallback = "item";
  const base = slugifyImportValue(baseValue) || fallback;
  let candidate = base;
  let index = 2;

  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  usedSlugs.add(candidate);
  return candidate;
}

function inferImportCategoryKind(name: string) {
  const normalized = normalizeImportLookup(name);

  if (
    normalized.includes("фурнитур") ||
    normalized.includes("петл") ||
    normalized.includes("направля")
  ) {
    return CategoryKind.FITTINGS;
  }

  if (
    normalized.includes("лдсп") ||
    normalized.includes("мдф") ||
    normalized.includes("панел") ||
    normalized.includes("столеш") ||
    normalized.includes("кром") ||
    normalized.includes("hpl")
  ) {
    return CategoryKind.PLATE;
  }

  return CategoryKind.OTHER;
}

function getProductImportRedirect(params: {
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: number;
  warnings?: number;
  mapped?: number;
  message?: string;
}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(
        `import${key[0].toUpperCase()}${key.slice(1)}`,
        String(value),
      );
    }
  });

  return `/admin/products?${searchParams.toString()}`;
}

function addImportNote(notes: string[], note: string) {
  if (notes.length < 5) {
    notes.push(note);
    return 0;
  }

  return 1;
}

function getImportMessageWithNotes(notes: string[], hiddenCount: number) {
  if (notes.length === 0) {
    return undefined;
  }

  return [
    notes.join(" "),
    hiddenCount > 0 ? `Еще ${hiddenCount} строк с замечаниями.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function revalidateAdminCatalog() {
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/brands");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/brands");
  revalidatePath("/catalog");
}

function revalidateAdminOperations() {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/cutting");
  revalidatePath("/admin/production");
  revalidatePath("/account/orders");
  revalidatePath("/account/requests");
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

function revalidateAdminPromotions() {
  revalidatePath("/admin");
  revalidatePath("/admin/promotions");
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

function revalidateAdminContent() {
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/brands");
  revalidatePath("/services");
  revalidatePath("/contacts");
}

function revalidateAdminUsers() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/loyalty");
  revalidatePath("/account");
  revalidatePath("/account/orders");
  revalidatePath("/account/requests");
  revalidatePath("/account/favorites");
}

function revalidateCalculatorConfig() {
  revalidatePath("/admin/calculator");
  revalidatePath("/calculator");
}

function getRequiredInt(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function buildAdminOrderNumber(prefix = "A") {
  const datePart = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `${prefix}-${datePart}-${randomPart}`;
}

async function syncOrderById(orderId: string, transition?: TransitionSnapshot) {
  const order = await getOrderInboxItemById(orderId);

  if (!order) {
    return;
  }

  await handleOrderUpdated({
    id: order.id,
    userId: order.userId ?? null,
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
    userId: request.userId ?? null,
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
    cuttingSheetCount: request.cuttingSheetCount,
    edgeOption: request.edgeOption,
    estimatedBudget: request.estimatedBudget,
    deliveryNeeded: request.deliveryNeeded,
    message: request.message,
    createdAt: request.createdAt.toISOString(),
    manager: request.manager,
    previousStatus: transition?.previousStatus,
    previousManager: transition?.previousManager,
    cuttingStage: request.cuttingStage,
    cuttingPickupCell: request.cuttingPickupCell,
    previousCuttingStage: transition?.previousCuttingStage,
    previousCuttingPickupCell: transition?.previousCuttingPickupCell,
    cuttingStageNote: transition?.cuttingStageNote,
    cuttingStageNoteInternal: transition?.cuttingStageNoteInternal,
    product: request.product,
  });
}

async function ensureAdminAccess() {
  const session = await requireAdminSession("/login?next=/admin");

  if (!canAccessGeneralAdmin(session.roleCode)) {
    redirect(getAdminHomePath(session.roleCode));
  }

  return session;
}

// Правила бонусов, баллы, уровни, личные скидки и удаление клиентов:
// администратор или менеджер, которому администратор выдал это право.
async function ensureLoyaltyManageAccess() {
  const session = await ensureAdminAccess();

  if (!(await canManageLoyalty(session))) {
    redirect("/admin/users?loyaltyDenied=1");
  }

  return session;
}

async function ensureCuttingAdminAccess() {
  return requireAdminSession("/login?next=/admin/cutting");
}

async function ensureRequestAdminAccess(requestId: string) {
  const session = await ensureCuttingAdminAccess();

  if (canAccessGeneralAdmin(session.roleCode)) {
    return session;
  }

  const request = await getRequestInboxItemById(requestId);

  if (!request || !canAccessRequestType(session.roleCode, request.type)) {
    redirect(getAdminHomePath(session.roleCode));
  }

  return session;
}

async function ensureProductionAdminAccess(requestId?: string) {
  const session = await requireAdminSession(
    "/login?next=/admin/production",
    "/admin/production",
  );

  if (!canAccessProduction(session.roleCode)) {
    redirect(getAdminHomePath(session.roleCode));
  }

  if (requestId) {
    const request = await getRequestInboxItemById(requestId);

    if (!request || request.type !== RequestType.CUTTING_SERVICE) {
      redirect("/admin/production?notice=request-missing");
    }
  }

  return session;
}

async function ensureStaffAdminAccess() {
  const session = await requireAdminSession("/login?next=/admin/staff");

  if (!canManageStaff(session.roleCode)) {
    redirect(getAdminHomePath(session.roleCode));
  }

  return session;
}

const orderStatusesWithApprovedLoyalty = new Set<OrderStatus>([
  OrderStatus.CONFIRMED,
  OrderStatus.PAID,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.SHIPPED,
  OrderStatus.COMPLETED,
]);

function shouldApproveOrderLoyalty(status: OrderStatus) {
  return orderStatusesWithApprovedLoyalty.has(status);
}

async function reverseOrderLoyaltyIfCanceled(params: {
  orderId: string;
  previousStatus?: OrderStatus | null;
  nextStatus: OrderStatus;
  actor?: Awaited<ReturnType<typeof ensureAdminAccess>> | null;
  result?: OrderLoyaltyCancellationResult | null;
}) {
  if (!hasDatabaseUrl()) {
    return false;
  }

  if (
    params.nextStatus !== OrderStatus.CANCELED ||
    params.previousStatus === OrderStatus.CANCELED
  ) {
    return false;
  }

  const db = getDb();
  const now = new Date();

  const result =
    params.result ??
    (await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.orderId },
        select: {
          userId: true,
          number: true,
          loyaltyTransactions: {
            where: {
              status: {
                in: [
                  LoyaltyTransactionStatus.APPROVED,
                  LoyaltyTransactionStatus.PENDING,
                ],
              },
            },
            select: {
              id: true,
              status: true,
              points: true,
            },
          },
        },
      });

      if (!order || order.loyaltyTransactions.length === 0) {
        return null;
      }

      const approvedTransactions = order.loyaltyTransactions.filter(
        (transaction) =>
          transaction.status === LoyaltyTransactionStatus.APPROVED,
      );
      const balanceDelta = approvedTransactions.reduce(
        (sum, transaction) => sum + transaction.points,
        0,
      );
      const lifetimeDelta = approvedTransactions.reduce(
        (sum, transaction) =>
          transaction.points > 0 ? sum + transaction.points : sum,
        0,
      );

      if (order.userId && approvedTransactions.length > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPointsBalance: { increment: -balanceDelta },
            loyaltyPointsLifetime: { increment: -lifetimeDelta },
          },
        });
      }

      await tx.loyaltyTransaction.updateMany({
        where: {
          orderId: params.orderId,
          status: {
            in: [
              LoyaltyTransactionStatus.APPROVED,
              LoyaltyTransactionStatus.PENDING,
            ],
          },
        },
        data: {
          status: LoyaltyTransactionStatus.CANCELED,
          canceledAt: now,
          canceledById: params.actor?.userId ?? null,
        },
      });

      return {
        number: order.number,
        balanceDelta,
        lifetimeDelta,
        transactionsCount: order.loyaltyTransactions.length,
      };
    }));

  if (!result) {
    return false;
  }

  await logOperationEvent({
    entityType: "order",
    entityId: params.orderId,
    eventType: "system",
    title: "Бонусы по отмененному заказу пересчитаны",
    description: [
      `Заказ ${result.number ?? params.orderId} отменен.`,
      result.balanceDelta !== 0
        ? `Баланс клиента изменен на ${-result.balanceDelta} баллов.`
        : "",
      result.lifetimeDelta > 0
        ? `Накопленные баллы уменьшены на ${result.lifetimeDelta}.`
        : "",
      `Операций отменено: ${result.transactionsCount}.`,
    ]
      .filter(Boolean)
      .join(" "),
    isVisibleToClient: true,
    actor: params.actor ?? null,
  });

  revalidateAdminUsers();
  return true;
}

async function reconcileOrderLoyaltyAccrual(params: {
  orderId: string;
  actor?: Awaited<ReturnType<typeof ensureAdminAccess>> | null;
}) {
  if (!hasDatabaseUrl()) {
    return false;
  }

  const db = getDb();
  const loyaltyConfig = await getLoyaltyProgramConfig();
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const lockedOrder = await tx.order.updateMany({
      where: { id: params.orderId },
      data: { updatedAt: now },
    });

    if (lockedOrder.count === 0) {
      return null;
    }

    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        deliveryTotal: true,
        userId: true,
        user: {
          select: {
            loyaltyTier: true,
            plateMaterialLoyaltyTier: true,
            fittingsLoyaltyTier: true,
            loyaltyPointsBalance: true,
            loyaltyPointsLifetime: true,
          },
        },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            snapshotCategoryKind: true,
            product: {
              select: {
                category: {
                  select: {
                    kind: true,
                  },
                },
              },
            },
          },
        },
        loyaltyTransactions: {
          where: {
            type: {
              in: [
                LoyaltyTransactionType.ORDER_ACCRUAL,
                LoyaltyTransactionType.REDEMPTION,
              ],
            },
            status: {
              in: [
                LoyaltyTransactionStatus.APPROVED,
                LoyaltyTransactionStatus.PENDING,
                LoyaltyTransactionStatus.CANCELED,
              ],
            },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            type: true,
            status: true,
            points: true,
            approvedAt: true,
            approvedById: true,
          },
        },
      },
    });

    if (
      !order ||
      !order.userId ||
      !order.user ||
      order.status === OrderStatus.CANCELED
    ) {
      return null;
    }

    const rawSubtotal = order.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const accrualBase = Math.max(0, order.total - order.deliveryTotal);
    const accrualRatio =
      rawSubtotal > 0 ? Math.min(1, accrualBase / rawSubtotal) : 0;
    const nextPoints = estimateLoyaltyPointsForLines(
      order.items.map((item) => ({
        total: item.unitPrice * item.quantity * accrualRatio,
        categoryKind:
          item.snapshotCategoryKind ?? item.product?.category?.kind ?? null,
      })),
      order.user,
      loyaltyConfig,
    );
    const activeTransactions = order.loyaltyTransactions.filter(
      (transaction) =>
        transaction.type === LoyaltyTransactionType.ORDER_ACCRUAL &&
        transaction.status !== LoyaltyTransactionStatus.CANCELED,
    );
    const canceledAccrualTransactions = order.loyaltyTransactions.filter(
      (transaction) =>
        transaction.type === LoyaltyTransactionType.ORDER_ACCRUAL &&
        transaction.status === LoyaltyTransactionStatus.CANCELED,
    );
    const canceledRedemptionTransactions = order.loyaltyTransactions.filter(
      (transaction) =>
        transaction.type === LoyaltyTransactionType.REDEMPTION &&
        transaction.status === LoyaltyTransactionStatus.CANCELED,
    );
    const activeTransactionIds = activeTransactions.map(
      (transaction) => transaction.id,
    );
    const primaryTransaction =
      activeTransactions[0] ?? canceledAccrualTransactions[0] ?? null;
    const previousPoints = activeTransactions.reduce(
      (sum, transaction) => sum + transaction.points,
      0,
    );
    const previousApprovedPoints = activeTransactions.reduce(
      (sum, transaction) =>
        transaction.status === LoyaltyTransactionStatus.APPROVED
          ? sum + transaction.points
          : sum,
      0,
    );
    const targetStatus =
      shouldApproveOrderLoyalty(order.status) || previousApprovedPoints > 0
        ? LoyaltyTransactionStatus.APPROVED
        : LoyaltyTransactionStatus.PENDING;

    if (
      activeTransactions.length === 0 &&
      nextPoints <= 0 &&
      canceledRedemptionTransactions.length === 0
    ) {
      return null;
    }

    const targetApprovesPoints =
      targetStatus === LoyaltyTransactionStatus.APPROVED;
    const accrualBalanceDelta = targetApprovesPoints
      ? nextPoints - previousApprovedPoints
      : -previousApprovedPoints;
    const redemptionRestoreDelta = canceledRedemptionTransactions.reduce(
      (sum, transaction) => sum + transaction.points,
      0,
    );
    const totalBalanceDelta = accrualBalanceDelta + redemptionRestoreDelta;
    let nextBalance = order.user.loyaltyPointsBalance;

    if (totalBalanceDelta !== 0 || accrualBalanceDelta !== 0) {
      const updatedUser = await tx.user.update({
        where: { id: order.userId },
        data: {
          loyaltyPointsBalance: { increment: totalBalanceDelta },
          loyaltyPointsLifetime: { increment: accrualBalanceDelta },
        },
        select: { loyaltyPointsBalance: true },
      });
      nextBalance = updatedUser.loyaltyPointsBalance;
    }

    if (canceledRedemptionTransactions.length > 0) {
      await tx.loyaltyTransaction.updateMany({
        where: {
          id: { in: canceledRedemptionTransactions.map((item) => item.id) },
        },
        data: {
          status: LoyaltyTransactionStatus.APPROVED,
          balanceAfter:
            order.user.loyaltyPointsBalance + redemptionRestoreDelta,
          approvedAt: now,
          approvedById: params.actor?.userId ?? null,
          canceledAt: null,
          canceledById: null,
        },
      });
    }

    if (nextPoints <= 0) {
      await tx.loyaltyTransaction.updateMany({
        where: { id: { in: activeTransactionIds } },
        data: {
          status: LoyaltyTransactionStatus.CANCELED,
          canceledAt: now,
          canceledById: params.actor?.userId ?? null,
        },
      });

      return {
        userId: order.userId,
        orderNumber: order.number,
        changed: true,
        previousPoints,
        nextPoints,
        targetStatus: LoyaltyTransactionStatus.CANCELED,
        balanceDelta: accrualBalanceDelta,
        nextBalance,
      };
    }

    const balanceAfter = nextBalance;
    const transactionTitle = targetApprovesPoints
      ? "Баллы за заказ"
      : "Баллы ожидают подтверждения";
    const transactionDescription = targetApprovesPoints
      ? `Начисление за заказ ${order.number ?? order.id} подтверждено.`
      : `Начисление за заказ ${order.number ?? order.id} будет добавлено после подтверждения менеджером.`;

    if (primaryTransaction) {
      await tx.loyaltyTransaction.update({
        where: { id: primaryTransaction.id },
        data: {
          status: targetStatus,
          points: nextPoints,
          balanceAfter,
          title: transactionTitle,
          description: transactionDescription,
          approvedAt: targetApprovesPoints
            ? (primaryTransaction.approvedAt ?? now)
            : null,
          approvedById: targetApprovesPoints
            ? (primaryTransaction.approvedById ?? params.actor?.userId ?? null)
            : null,
          canceledAt: null,
          canceledById: null,
        },
      });

      const duplicateTransactionIds = activeTransactionIds.slice(1);

      if (duplicateTransactionIds.length > 0) {
        await tx.loyaltyTransaction.updateMany({
          where: { id: { in: duplicateTransactionIds } },
          data: {
            status: LoyaltyTransactionStatus.CANCELED,
            canceledAt: now,
            canceledById: params.actor?.userId ?? null,
          },
        });
      }
    } else {
      await tx.loyaltyTransaction.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          type: LoyaltyTransactionType.ORDER_ACCRUAL,
          status: targetStatus,
          points: nextPoints,
          balanceAfter,
          title: transactionTitle,
          description: transactionDescription,
          approvedAt: targetApprovesPoints ? now : null,
          approvedById: targetApprovesPoints
            ? (params.actor?.userId ?? null)
            : null,
        },
      });
    }

    const statusChanged = activeTransactions.some(
      (transaction) => transaction.status !== targetStatus,
    );
    const changed =
      previousPoints !== nextPoints ||
      statusChanged ||
      activeTransactions.length !== 1;

    return {
      userId: order.userId,
      orderNumber: order.number,
      changed,
      previousPoints,
      nextPoints,
      targetStatus,
      balanceDelta: accrualBalanceDelta,
      nextBalance,
    };
  });

  if (!result?.changed) {
    return false;
  }

  await logOperationEvent({
    entityType: "order",
    entityId: params.orderId,
    eventType: "system",
    title: "Бонусы заказа пересчитаны",
    description: [
      `Заказ ${result.orderNumber ?? params.orderId}.`,
      `Начисление: ${result.previousPoints} → ${result.nextPoints} баллов.`,
      result.targetStatus === LoyaltyTransactionStatus.APPROVED
        ? "Баллы зачислены в баланс клиента."
        : result.targetStatus === LoyaltyTransactionStatus.PENDING
          ? "Баллы ожидают подтверждения заказа."
          : "Начисление отменено.",
    ].join(" "),
    isVisibleToClient: true,
    actor: params.actor ?? null,
  });

  if (
    result.targetStatus === LoyaltyTransactionStatus.APPROVED &&
    result.balanceDelta > 0
  ) {
    try {
      await sendClientDirectMessage(result.userId, {
        title: "Бонусы начислены",
        category: "loyalty",
        lines: [
          `Заказ: ${result.orderNumber ?? params.orderId}`,
          `Начислено: +${result.balanceDelta} баллов`,
          `Баланс: ${result.nextBalance} баллов`,
        ],
        actions: [{ text: "Открыть бонусы", url: "/account" }],
      });
    } catch (error) {
      console.error("[telegram:loyalty:order-reconcile]", error);
    }
  }

  revalidateAdminUsers();
  return true;
}

export async function sendTelegramTestAction(formData: FormData) {
  await ensureAdminAccess();

  const threadKeyCandidate = getString(formData, "threadKey");
  const threadKey: TelegramThreadKey =
    threadKeyCandidate === "orders" || threadKeyCandidate === "cutting"
      ? threadKeyCandidate
      : "requests";
  const result = await sendTelegramTestNotification(threadKey);
  const searchParams = new URLSearchParams({
    telegramTest: result.ok ? "ok" : "error",
    telegramMessage: result.message,
    telegramThread: threadKey,
  });

  revalidatePath("/admin/launch");
  redirect(`/admin/launch?${searchParams.toString()}`);
}

export async function configureTelegramWebhookAction() {
  await ensureAdminAccess();

  let searchParams: URLSearchParams;

  try {
    const result = await configureTelegramWebhook();
    searchParams = new URLSearchParams({
      telegramWebhook: "ok",
      telegramMessage: result.hasSecret
        ? "Webhook подключен с секретной проверкой."
        : "Webhook подключен без TELEGRAM_WEBHOOK_SECRET.",
      telegramWebhookUrl: result.webhookUrl,
    });
  } catch (error) {
    searchParams = new URLSearchParams({
      telegramWebhook: "error",
      telegramMessage:
        error instanceof Error
          ? error.message
          : "Telegram вернул неизвестную ошибку.",
    });
  }

  revalidatePath("/admin/launch");
  redirect(`/admin/launch?${searchParams.toString()}`);
}

function getOptionalManagerLabel(manager: ManagerSnapshot) {
  if (!manager) {
    return "Без менеджера";
  }

  return getManagerDisplayName({
    firstName: manager.firstName ?? null,
    lastName: manager.lastName ?? null,
    email: manager.email ?? "Без email",
  });
}

async function logRequestTransition(params: {
  requestId: string;
  previous: {
    status: RequestStatus;
    manager: ManagerSnapshot;
  } | null;
  current: {
    status: RequestStatus;
    manager: ManagerSnapshot;
  } | null;
  actor: Awaited<ReturnType<typeof ensureAdminAccess>>;
}) {
  if (!params.current) {
    return;
  }

  if (params.previous?.status !== params.current.status) {
    await logOperationEvent({
      entityType: "request",
      entityId: params.requestId,
      eventType: "status",
      title: `Статус заявки: ${requestStatusLabels[params.current.status]}`,
      description: params.previous
        ? `${requestStatusLabels[params.previous.status]} → ${requestStatusLabels[params.current.status]}`
        : null,
      fromStatus: params.previous?.status ?? null,
      toStatus: params.current.status,
      isVisibleToClient: true,
      actor: params.actor,
    });
  }

  if (
    getOptionalManagerLabel(params.previous?.manager ?? null) !==
    getOptionalManagerLabel(params.current.manager)
  ) {
    await logOperationEvent({
      entityType: "request",
      entityId: params.requestId,
      eventType: "manager",
      title: `Менеджер: ${getOptionalManagerLabel(params.current.manager)}`,
      description: params.previous
        ? `${getOptionalManagerLabel(params.previous.manager)} → ${getOptionalManagerLabel(params.current.manager)}`
        : null,
      actor: params.actor,
    });
  }
}

async function logOrderTransition(params: {
  orderId: string;
  previous: {
    status: OrderStatus;
    manager: ManagerSnapshot;
  } | null;
  current: {
    status: OrderStatus;
    manager: ManagerSnapshot;
  } | null;
  actor: Awaited<ReturnType<typeof ensureAdminAccess>>;
}) {
  if (!params.current) {
    return;
  }

  if (params.previous?.status !== params.current.status) {
    await logOperationEvent({
      entityType: "order",
      entityId: params.orderId,
      eventType: "status",
      title: `Статус заказа: ${orderStatusLabels[params.current.status]}`,
      description: params.previous
        ? `${orderStatusLabels[params.previous.status]} → ${orderStatusLabels[params.current.status]}`
        : null,
      fromStatus: params.previous?.status ?? null,
      toStatus: params.current.status,
      isVisibleToClient: true,
      actor: params.actor,
    });
  }

  if (
    getOptionalManagerLabel(params.previous?.manager ?? null) !==
    getOptionalManagerLabel(params.current.manager)
  ) {
    await logOperationEvent({
      entityType: "order",
      entityId: params.orderId,
      eventType: "manager",
      title: `Менеджер: ${getOptionalManagerLabel(params.current.manager)}`,
      description: params.previous
        ? `${getOptionalManagerLabel(params.previous.manager)} → ${getOptionalManagerLabel(params.current.manager)}`
        : null,
      actor: params.actor,
    });
  }
}

export async function createCategoryAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const name = getString(formData, "name");

  if (!name) {
    return;
  }

  const kindRaw = getString(formData, "kind");
  const kind =
    Object.values(CategoryKind).find((item) => item === kindRaw) ??
    CategoryKind.OTHER;
  const db = getDb();
  const slug = await getUniqueCategorySlug(
    db,
    getString(formData, "slug") || name,
  );
  const defaults = categoryDefaults[kind];

  await db.category.create({
    data: {
      name,
      slug,
      kind,
      summary: getOptionalString(formData, "summary"),
      indicator: getOptionalString(formData, "indicator") ?? defaults.indicator,
      scenario: getOptionalString(formData, "scenario") ?? defaults.scenario,
      sortOrder:
        getOptionalInt(formData, "sortOrder") ??
        (await getNextCategorySortOrder(db)),
    },
  });

  revalidateAdminCatalog();
}

export async function updateCategoryKindAction(formData: FormData) {
  if (!hasDatabaseUrl()) return;
  await ensureAdminAccess();

  const id = getString(formData, "id");
  const kindRaw = getString(formData, "kind");
  if (!id) return;

  const kind = Object.values(CategoryKind).find((item) => item === kindRaw);
  if (!kind) return;

  await getDb().category.update({
    where: { id },
    data: { kind },
  });

  revalidateAdminCatalog();
}

export async function updateCategoryAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const name = getString(formData, "name");

  if (!id || !name) {
    return;
  }

  const kindRaw = getString(formData, "kind");
  const kind =
    Object.values(CategoryKind).find((item) => item === kindRaw) ??
    CategoryKind.OTHER;

  const db = getDb();
  const previousCategory = await db.category.findUnique({
    where: { id },
    select: { slug: true },
  });
  const slug = await getUniqueCategorySlug(
    db,
    getString(formData, "slug") || name,
    id,
  );
  const defaults = categoryDefaults[kind];

  await db.category.update({
    where: { id },
    data: {
      name,
      slug,
      kind,
      summary: getOptionalString(formData, "summary"),
      description: getOptionalString(formData, "description"),
      indicator: getOptionalString(formData, "indicator") ?? defaults.indicator,
      scenario: getOptionalString(formData, "scenario") ?? defaults.scenario,
      coverImage: getOptionalString(formData, "coverImage"),
      spotlight: getOptionalString(formData, "spotlight"),
      seoTitle: getOptionalString(formData, "seoTitle"),
      seoDescription: getOptionalString(formData, "seoDescription"),
      sortOrder: getOptionalInt(formData, "sortOrder") ?? 0,
      isFeatured: getString(formData, "isFeatured") === "on",
    },
  });

  revalidatePath(`/admin/categories/${id}`);
  revalidatePath(`/catalog/${slug}`);
  if (previousCategory?.slug && previousCategory.slug !== slug) {
    revalidatePath(`/catalog/${previousCategory.slug}`);
  }
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
  const slug = normalizeBrandSlug(getString(formData, "slug"));

  if (!name || !slug) {
    return;
  }

  const db = getDb();
  await ensureBrandLogoColumn(db);

  await db.brand.create({
    data: {
      name,
      slug,
      country: getOptionalString(formData, "country"),
      website: getOptionalUrl(formData, "website"),
      logoUrl: getOptionalUrl(formData, "logoUrl"),
      homeBannerImageUrls: getOptionalJsonUrlList(
        formData,
        "homeBannerImageUrl",
      ),
      description: getOptionalString(formData, "description"),
    },
  });

  revalidatePath(`/brands/${slug}`);
  revalidateAdminCatalog();
}

export async function updateBrandAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const slug = normalizeBrandSlug(getString(formData, "slug"));

  if (!id || !name || !slug) {
    return;
  }

  const db = getDb();
  await ensureBrandLogoColumn(db);
  const previousBrand = await db.brand.findUnique({
    where: { id },
    select: { slug: true },
  });

  await db.brand.update({
    where: { id },
    data: {
      name,
      slug,
      country: getOptionalString(formData, "country"),
      website: getOptionalUrl(formData, "website"),
      logoUrl: getOptionalUrl(formData, "logoUrl"),
      homeBannerImageUrls: getOptionalJsonUrlList(
        formData,
        "homeBannerImageUrl",
      ),
      description: getOptionalString(formData, "description"),
    },
  });

  revalidatePath(`/admin/brands/${id}`);
  revalidatePath(`/brands/${slug}`);
  if (previousBrand?.slug && previousBrand.slug !== slug) {
    revalidatePath(`/brands/${previousBrand.slug}`);
  }
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
  const categoryId = getString(formData, "categoryId");

  if (!name || !categoryId) {
    return;
  }

  const status = getString(formData, "status");
  const orderMode = getString(formData, "orderMode");
  const inventoryStatus = getString(formData, "inventoryStatus");
  const bundleItems = getBundleItemsFromForm(formData);
  const attributes = getProductAttributesFromForm(
    formData,
    bundleItems.length > 0,
  );
  const brandId = getOptionalString(formData, "brandId");
  const db = getDb();
  await ensureProductBundleItemsTable(db);
  const [category, brand] = await Promise.all([
    db.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    }),
    brandId
      ? db.brand.findUnique({ where: { id: brandId }, select: { name: true } })
      : null,
  ]);

  if (!category) {
    return;
  }

  // Такой же товар (название, категория и бренд совпадают) уже есть:
  // открываем его карточку вместо создания дубля.
  const duplicate = await db.product.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      categoryId,
      brandId: brandId ?? null,
    },
    select: { id: true },
  });

  if (duplicate) {
    redirect(`/admin/products/${duplicate.id}?notice=duplicate`);
  }

  const identity = [brand?.name, category.name, name].filter(Boolean).join(" ");
  const slug = await getUniqueProductSlug(
    db,
    getString(formData, "slug") || identity || name,
  );
  const requestedSku = getString(formData, "sku");
  const sku = await getUniqueProductSku(
    db,
    requestedSku || identity || name,
    undefined,
    Boolean(requestedSku),
  );
  const imageUrls = await resolveProductImageUrls(formData, slug);

  const createdProduct = await db.product.create({
    data: {
      name,
      slug,
      sku,
      categoryId,
      brandId,
      summary: getOptionalString(formData, "summary"),
      description: getOptionalString(formData, "description"),
      format: getOptionalString(formData, "format"),
      thicknessMm: getOptionalInt(formData, "thicknessMm"),
      edgeThicknessMm: getOptionalFloat(formData, "edgeThicknessMm"),
      edgeWidthMm: getOptionalFloat(formData, "edgeWidthMm"),
      calculatorMaterialId: getOptionalString(formData, "calculatorMaterialId"),
      calculatorSheetPresetId: getOptionalString(
        formData,
        "calculatorSheetPresetId",
      ),
      price: getOptionalInt(formData, "price"),
      compareAtPrice: getOptionalInt(formData, "compareAtPrice"),
      stockQuantity: getOptionalInt(formData, "stockQuantity"),
      seoTitle: getOptionalString(formData, "seoTitle"),
      seoDescription: getOptionalString(formData, "seoDescription"),
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
      images:
        imageUrls.length > 0
          ? {
              create: imageUrls.map((imageUrl, index) => ({
                url: imageUrl,
                alt: name,
                sortOrder: (index + 1) * 10,
              })),
            }
          : undefined,
      attributes:
        attributes.length > 0
          ? {
              create: attributes,
            }
          : undefined,
      bundleItems:
        bundleItems.length > 0
          ? {
              create: bundleItems.map((item) => ({
                componentProduct: {
                  connect: { id: item.componentProductId },
                },
                quantity: item.quantity,
                sortOrder: item.sortOrder,
              })),
            }
          : undefined,
    },
  });

  revalidateAdminCatalog();

  // Открываем карточку нового товара: видно, что он создан, а повторное
  // нажатие в старой форме не создаст дубль.
  redirect(`/admin/products/${createdProduct.id}?notice=created`);
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
  await ensureProductBundleItemsTable(db);

  await db.$transaction([
    db.favorite.deleteMany({ where: { productId: id } }),
    db.productImage.deleteMany({ where: { productId: id } }),
    db.productAttribute.deleteMany({ where: { productId: id } }),
    db.productBundleItem.deleteMany({
      where: {
        OR: [{ bundleProductId: id }, { componentProductId: id }],
      },
    }),
    db.promotionProduct.deleteMany({ where: { productId: id } }),
    db.product.delete({ where: { id } }),
  ]);

  revalidateAdminCatalog();

  // Из карточки товара возвращаем в список: самой карточки больше нет.
  if (getString(formData, "redirectTo") === "list") {
    redirect("/admin/products");
  }
}

// Копия товара: тот же набор полей, фото, характеристик и состава
// комплекта. Создаётся черновиком с новым названием, артикулом и адресом,
// остаток не переносится.
export async function duplicateProductAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const db = getDb();
  await ensureProductBundleItemsTable(db);
  const source = await db.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      attributes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      bundleItems: { orderBy: [{ sortOrder: "asc" }] },
    },
  });

  if (!source) {
    return;
  }

  const name = `${source.name} (копия)`;
  const slug = await getUniqueProductSlug(db, `${source.slug}-kopiya`);
  const sku = await getUniqueProductSku(db, `${source.sku}-copy`);
  const copy = await db.product.create({
    data: {
      name,
      slug,
      sku,
      summary: source.summary,
      description: source.description,
      categoryId: source.categoryId,
      brandId: source.brandId,
      status: ProductStatus.DRAFT,
      orderMode: source.orderMode,
      inventoryStatus: source.inventoryStatus,
      price: source.price,
      compareAtPrice: source.compareAtPrice,
      stockQuantity: null,
      format: source.format,
      thicknessMm: source.thicknessMm,
      edgeThicknessMm: source.edgeThicknessMm,
      edgeWidthMm: source.edgeWidthMm,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      calculatorMaterialId: source.calculatorMaterialId,
      calculatorSheetPresetId: source.calculatorSheetPresetId,
      images: {
        create: source.images.map((image) => ({
          url: image.url,
          alt: name,
          sortOrder: image.sortOrder,
        })),
      },
      attributes: {
        create: source.attributes.map((attribute) => ({
          name: attribute.name,
          value: attribute.value,
          sortOrder: attribute.sortOrder,
        })),
      },
      bundleItems: {
        create: source.bundleItems.map((item) => ({
          componentProductId: item.componentProductId,
          quantity: item.quantity,
          sortOrder: item.sortOrder,
        })),
      },
    },
    select: { id: true },
  });

  revalidateAdminCatalog();
  redirect(`/admin/products/${copy.id}?notice=copied`);
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
      calculatorMaterialId: getOptionalString(formData, "calculatorMaterialId"),
      calculatorSheetPresetId: getOptionalString(
        formData,
        "calculatorSheetPresetId",
      ),
      isFeatured: getString(formData, "isFeatured") === "on",
    },
  });

  revalidateAdminCatalog();
}

export async function updateProductDetailsAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const categoryId = getString(formData, "categoryId");

  if (!id || !name || !categoryId) {
    return;
  }

  const status = getString(formData, "status");
  const orderMode = getString(formData, "orderMode");
  const inventoryStatus = getString(formData, "inventoryStatus");
  const bundleItems = getBundleItemsFromForm(formData, id);
  const attributes = getProductAttributesFromForm(
    formData,
    bundleItems.length > 0,
  );
  const brandId = getOptionalString(formData, "brandId");

  const db = getDb();
  await ensureProductBundleItemsTable(db);
  const [previousProduct, category, brand] = await Promise.all([
    db.product.findUnique({
      where: { id },
      select: { slug: true, sku: true },
    }),
    db.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    }),
    brandId
      ? db.brand.findUnique({ where: { id: brandId }, select: { name: true } })
      : null,
  ]);

  if (!previousProduct || !category) {
    return;
  }

  const identity = [brand?.name, category.name, name].filter(Boolean).join(" ");
  const slug = await getUniqueProductSlug(
    db,
    getString(formData, "slug") || identity || name,
    id,
  );
  const requestedSku = getString(formData, "sku");
  const sku = await getUniqueProductSku(
    db,
    requestedSku || identity || name,
    id,
    Boolean(requestedSku),
  );
  const imageUrls = await resolveProductImageUrls(formData, slug);

  // Блоки «Плитный материал» и «Размеры кромки» показываются не для всех
  // категорий. Поле, которого не было в форме, не трогаем, а не обнуляем.
  const ifSubmitted = <T>(field: string, read: () => T) =>
    formData.has(field) ? read() : undefined;

  // Остаток мог уменьшиться заказом, пока карточка была открыта. Если
  // менеджер его не менял, не пишем ничего; если менял, применяем разницу.
  const submittedStock = getOptionalInt(formData, "stockQuantity");
  const initialStockRaw = formData.get("stockQuantityInitial");
  const initialStock =
    typeof initialStockRaw === "string" && initialStockRaw.trim() !== ""
      ? Number.parseInt(initialStockRaw, 10)
      : null;
  const stockQuantityUpdate =
    typeof initialStockRaw !== "string"
      ? submittedStock
      : submittedStock === initialStock
        ? undefined
        : submittedStock === null || initialStock === null
          ? submittedStock
          : { increment: submittedStock - initialStock };

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name,
        slug,
        sku,
        categoryId,
        brandId,
        summary: getOptionalString(formData, "summary"),
        description: getOptionalString(formData, "description"),
        format: ifSubmitted("format", () =>
          getOptionalString(formData, "format"),
        ),
        thicknessMm: ifSubmitted("thicknessMm", () =>
          getOptionalInt(formData, "thicknessMm"),
        ),
        edgeThicknessMm: ifSubmitted("edgeThicknessMm", () =>
          getOptionalFloat(formData, "edgeThicknessMm"),
        ),
        edgeWidthMm: ifSubmitted("edgeWidthMm", () =>
          getOptionalFloat(formData, "edgeWidthMm"),
        ),
        calculatorMaterialId: ifSubmitted("calculatorMaterialId", () =>
          getOptionalString(formData, "calculatorMaterialId"),
        ),
        calculatorSheetPresetId: ifSubmitted("calculatorSheetPresetId", () =>
          getOptionalString(formData, "calculatorSheetPresetId"),
        ),
        price: getOptionalInt(formData, "price"),
        compareAtPrice: getOptionalInt(formData, "compareAtPrice"),
        stockQuantity: stockQuantityUpdate,
        seoTitle: getOptionalString(formData, "seoTitle"),
        seoDescription: getOptionalString(formData, "seoDescription"),
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

    await tx.productImage.deleteMany({ where: { productId: id } });
    if (imageUrls.length > 0) {
      await tx.productImage.createMany({
        data: imageUrls.map((imageUrl, index) => ({
          productId: id,
          url: imageUrl,
          alt: name,
          sortOrder: (index + 1) * 10,
        })),
      });
    }

    await tx.productAttribute.deleteMany({ where: { productId: id } });
    if (attributes.length > 0) {
      await tx.productAttribute.createMany({
        data: attributes.map((attribute) => ({
          ...attribute,
          productId: id,
        })),
      });
    }

    await tx.productBundleItem.deleteMany({
      where: { bundleProductId: id },
    });

    if (bundleItems.length > 0) {
      await tx.productBundleItem.createMany({
        data: bundleItems.map((item) => ({
          bundleProductId: id,
          componentProductId: item.componentProductId,
          quantity: item.quantity,
          sortOrder: item.sortOrder,
        })),
      });
    }
  });

  revalidateAdminCatalog();
  revalidatePath(`/admin/products/${id}`);
  if (previousProduct?.slug && previousProduct.slug !== slug) {
    revalidatePath(`/product/${previousProduct.slug}`);
  }
  revalidatePath(`/product/${slug}`);
  redirect(`/admin/products/${id}?notice=saved`);
}

export async function importProductsFromExcelAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const file = getFileList(formData, "productsFile")[0];

  if (!file) {
    redirect(
      getProductImportRedirect({
        message: "Файл не выбран",
        errors: 1,
      }),
    );
  }

  if (file.size > PRODUCT_IMPORT_MAX_FILE_SIZE) {
    redirect(
      getProductImportRedirect({
        message: "Файл больше 100 МБ",
        errors: 1,
      }),
    );
  }

  let parsed: Awaited<ReturnType<typeof parseProductImportFile>>;

  try {
    parsed = await parseProductImportFile(file);
  } catch {
    redirect(
      getProductImportRedirect({
        message: "Не удалось прочитать файл",
        errors: 1,
      }),
    );
  }

  if (parsed.rows.length === 0) {
    redirect(
      getProductImportRedirect({
        message: "В файле не найдено строк товаров",
        warnings: parsed.warnings.length,
      }),
    );
  }

  const defaultOrderMode =
    Object.values(ProductOrderMode).find(
      (item) => item === getString(formData, "defaultOrderMode"),
    ) ?? ProductOrderMode.REQUEST_PRICE;
  const defaultInventoryStatus =
    Object.values(InventoryStatus).find(
      (item) => item === getString(formData, "defaultInventoryStatus"),
    ) ?? InventoryStatus.ON_REQUEST;
  const defaultCategoryId = getOptionalString(formData, "defaultCategoryId");
  const defaultBrandId = getOptionalString(formData, "defaultBrandId");
  const defaultCalculatorMaterialId = getOptionalString(
    formData,
    "defaultCalculatorMaterialId",
  );
  const defaultCalculatorSheetPresetId = getOptionalString(
    formData,
    "defaultCalculatorSheetPresetId",
  );
  const updateExisting = getString(formData, "updateExisting") === "on";
  const createMissingRelations =
    getString(formData, "createMissingRelations") === "on";
  const importAttributes = getString(formData, "importAttributes") === "on";
  const moveUpdatedToDraft = getString(formData, "moveUpdatedToDraft") === "on";

  const db = getDb();
  await ensureBrandLogoColumn(db);

  const [categories, brands, existingProducts] = await Promise.all([
    db.category.findMany({
      select: { id: true, name: true, slug: true },
    }),
    db.brand.findMany({
      select: { id: true, name: true, slug: true },
    }),
    db.product.findMany({
      select: { id: true, sku: true, slug: true, name: true },
    }),
  ]);

  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const brandById = new Map(brands.map((item) => [item.id, item]));
  const categoryByLookup = new Map(
    categories.flatMap((item) => [
      [normalizeImportLookup(item.name), item],
      [normalizeImportLookup(item.slug), item],
    ]),
  );
  const brandByLookup = new Map(
    brands.flatMap((item) => [
      [normalizeImportLookup(item.name), item],
      [normalizeImportLookup(item.slug), item],
    ]),
  );
  const productBySku = new Map(
    existingProducts.map((item) => [normalizeImportSkuKey(item.sku), item]),
  );
  const productsByName = new Map<string, typeof existingProducts>();
  existingProducts.forEach((item) => {
    const key = normalizeImportLookup(item.name);
    const items = productsByName.get(key) ?? [];
    items.push(item);
    productsByName.set(key, items);
  });
  const productByUniqueName = new Map(
    [...productsByName.entries()]
      .filter(([, items]) => items.length === 1)
      .map(([key, items]) => [key, items[0]]),
  );
  const usedProductSlugs = new Set(existingProducts.map((item) => item.slug));
  const usedCategorySlugs = new Set(categories.map((item) => item.slug));
  const usedBrandSlugs = new Set(brands.map((item) => item.slug));
  let fallbackImportCategoryId =
    categoryByLookup.get(normalizeImportLookup("Импорт"))?.id ??
    categoryByLookup.get("import")?.id ??
    null;

  async function ensureFallbackImportCategory() {
    if (fallbackImportCategoryId) {
      return fallbackImportCategoryId;
    }

    const category = await db.category.create({
      data: {
        name: "Импорт",
        slug: makeUniqueImportSlug("Импорт", usedCategorySlugs),
        kind: CategoryKind.OTHER,
        sortOrder: 1000,
      },
      select: { id: true, name: true, slug: true },
    });

    categoryById.set(category.id, category);
    categoryByLookup.set(normalizeImportLookup(category.name), category);
    categoryByLookup.set(normalizeImportLookup(category.slug), category);
    fallbackImportCategoryId = category.id;
    return category.id;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let generatedSkus = 0;
  let fallbackCategories = 0;
  let hiddenImportNotes = 0;
  const importNotes: string[] = [];

  if (parsed.inventoryValuation) {
    try {
      const valuation = await saveLatestInventoryValuation({
        amount: parsed.inventoryValuation.amount,
        sourceFile: parsed.inventoryValuation.fileName,
        sourceSheet: parsed.inventoryValuation.sheetName,
        reportTitle: parsed.inventoryValuation.reportTitle,
      });

      importNotes.unshift(
        `Сумма склада обновлена: ${new Intl.NumberFormat("ru-RU", {
          style: "currency",
          currency: "KGS",
          maximumFractionDigits: 2,
        }).format(valuation.amount)}.`,
      );
    } catch (error) {
      errors += 1;
      hiddenImportNotes += addImportNote(
        importNotes,
        "Не удалось сохранить итоговую сумму склада из файла.",
      );

      console.error("[inventory-valuation-import]", {
        fileName: parsed.fileName,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  for (const row of parsed.rows) {
    try {
      const rowSku = row.sku.trim();
      const skuKey = normalizeImportSkuKey(rowSku);
      const existingProduct =
        (skuKey ? productBySku.get(skuKey) : undefined) ??
        (!skuKey && row.name
          ? productByUniqueName.get(normalizeImportLookup(row.name))
          : undefined);
      const productName = row.name || existingProduct?.name || "";

      // Без артикула товар ищем по названию. Если с таким названием уже
      // несколько товаров, непонятно, какой обновлять: не создаём ещё один.
      if (
        !skuKey &&
        !existingProduct &&
        row.name &&
        (productsByName.get(normalizeImportLookup(row.name))?.length ?? 0) > 1
      ) {
        skipped += 1;
        hiddenImportNotes += addImportNote(
          importNotes,
          `Строка ${row.rowNumber}: «${row.name}» без артикула, а товаров с таким названием несколько. Укажите артикул.`,
        );
        continue;
      }

      if (!productName) {
        skipped += 1;
        hiddenImportNotes += addImportNote(
          importNotes,
          `Строка ${row.rowNumber}: нет названия товара.`,
        );
        continue;
      }

      if (existingProduct && !updateExisting) {
        skipped += 1;
        hiddenImportNotes += addImportNote(
          importNotes,
          `Строка ${row.rowNumber}: товар уже есть, обновление выключено.`,
        );
        continue;
      }

      let productSku = rowSku || existingProduct?.sku || "";
      if (!productSku) {
        productSku = await getUniqueProductSku(
          db,
          `${row.categoryName ?? ""} ${row.brandName ?? ""} ${productName}`,
        );
        generatedSkus += 1;
      }

      let categoryId =
        defaultCategoryId && categoryById.has(defaultCategoryId)
          ? defaultCategoryId
          : null;

      if (row.categoryName) {
        const categoryName = row.categoryName
          .split(/[\\/]/)
          .map((part) => part.trim())
          .filter(Boolean)
          .at(-1);
        const normalizedCategory = categoryName
          ? normalizeImportLookup(categoryName)
          : "";
        const existingCategory = categoryByLookup.get(normalizedCategory);

        if (existingCategory) {
          categoryId = existingCategory.id;
        } else if (categoryName && createMissingRelations) {
          const category = await db.category.create({
            data: {
              name: categoryName,
              slug: makeUniqueImportSlug(categoryName, usedCategorySlugs),
              kind: inferImportCategoryKind(categoryName),
              sortOrder: 1000,
            },
            select: { id: true, name: true, slug: true },
          });
          categoryById.set(category.id, category);
          categoryByLookup.set(normalizeImportLookup(category.name), category);
          categoryByLookup.set(normalizeImportLookup(category.slug), category);
          categoryId = category.id;
        }
      }

      if (!existingProduct && !categoryId) {
        categoryId = await ensureFallbackImportCategory();
        fallbackCategories += 1;
      }

      let brandId =
        defaultBrandId && brandById.has(defaultBrandId) ? defaultBrandId : null;

      if (row.brandName) {
        const normalizedBrand = normalizeImportLookup(row.brandName);
        const existingBrand = brandByLookup.get(normalizedBrand);

        if (existingBrand) {
          brandId = existingBrand.id;
        } else if (createMissingRelations) {
          const brand = await db.brand.create({
            data: {
              name: row.brandName,
              slug: makeUniqueImportSlug(row.brandName, usedBrandSlugs),
            },
            select: { id: true, name: true, slug: true },
          });
          brandById.set(brand.id, brand);
          brandByLookup.set(normalizeImportLookup(brand.name), brand);
          brandByLookup.set(normalizeImportLookup(brand.slug), brand);
          brandId = brand.id;
        }
      }

      const imageUrl = getValidImportImageUrl(row.imageUrl);
      const rowCalculatorSheetPresetId =
        defaultCalculatorSheetPresetId ??
        inferCalculatorSheetPresetFromFormat(row.format);
      const attributeCreates = row.attributes.map((attribute, index) => ({
        name: attribute.name,
        value: attribute.value,
        sortOrder: (index + 1) * 10,
      }));

      if (existingProduct) {
        // У существующего товара «Сценарий заказа» и «Наличие» меняем,
        // только если они указаны в файле. Иначе оставляем как есть.
        const updateData: Prisma.ProductUpdateInput = {
          ...(row.orderMode ? { orderMode: row.orderMode } : {}),
          ...(row.inventoryStatus
            ? { inventoryStatus: row.inventoryStatus }
            : {}),
        };

        if (row.name) {
          updateData.name = row.name;
        }

        if (moveUpdatedToDraft) {
          updateData.status = ProductStatus.DRAFT;
        } else if (row.status) {
          updateData.status = row.status;
        }

        if (row.slug) {
          usedProductSlugs.delete(existingProduct.slug);
          updateData.slug = makeUniqueImportSlug(row.slug, usedProductSlugs);
        }
        if (categoryId) updateData.category = { connect: { id: categoryId } };
        if (brandId) updateData.brand = { connect: { id: brandId } };
        if (row.price !== null) updateData.price = row.price;
        if (row.compareAtPrice !== null) {
          updateData.compareAtPrice = row.compareAtPrice;
        }
        if (row.stockQuantity !== null) {
          updateData.stockQuantity = Math.floor(row.stockQuantity);
        }
        if (row.format) updateData.format = row.format;
        if (row.thicknessMm !== null) updateData.thicknessMm = row.thicknessMm;
        if (row.edgeThicknessMm !== null) {
          updateData.edgeThicknessMm = row.edgeThicknessMm;
        }
        if (row.edgeWidthMm !== null) {
          updateData.edgeWidthMm = row.edgeWidthMm;
        }
        if (row.summary) updateData.summary = row.summary;
        if (row.description) updateData.description = row.description;
        if (defaultCalculatorMaterialId) {
          updateData.calculatorMaterialId = defaultCalculatorMaterialId;
        }
        if (rowCalculatorSheetPresetId) {
          updateData.calculatorSheetPresetId = rowCalculatorSheetPresetId;
        }
        if (importAttributes && attributeCreates.length > 0) {
          updateData.attributes = {
            deleteMany: {},
            create: attributeCreates,
          };
        }

        await db.product.update({
          where: { id: existingProduct.id },
          data: updateData,
        });
        if (imageUrl) {
          const [sameImage, lastImage] = await Promise.all([
            db.productImage.findFirst({
              where: { productId: existingProduct.id, url: imageUrl },
              select: { id: true },
            }),
            db.productImage.findFirst({
              where: { productId: existingProduct.id },
              orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
              select: { sortOrder: true },
            }),
          ]);

          if (!sameImage) {
            await db.productImage.create({
              data: {
                productId: existingProduct.id,
                url: imageUrl,
                alt: row.name || existingProduct.name,
                sortOrder: (lastImage?.sortOrder ?? 0) + 10,
              },
            });
          }
        }
        updated += 1;
        continue;
      }

      const productSlug = makeUniqueImportSlug(
        row.slug ?? `${row.brandName ?? ""} ${productName} ${productSku}`,
        usedProductSlugs,
      );
      const createData: Prisma.ProductCreateInput = {
        name: productName,
        slug: productSlug,
        sku: productSku,
        category: { connect: { id: categoryId as string } },
        brand: brandId ? { connect: { id: brandId } } : undefined,
        price: row.price,
        compareAtPrice: row.compareAtPrice,
        stockQuantity:
          row.stockQuantity === null ? null : Math.floor(row.stockQuantity),
        format: row.format,
        thicknessMm: row.thicknessMm,
        edgeThicknessMm: row.edgeThicknessMm,
        edgeWidthMm: row.edgeWidthMm,
        summary: row.summary,
        description: row.description,
        status: row.status ?? ProductStatus.DRAFT,
        orderMode: row.orderMode ?? defaultOrderMode,
        inventoryStatus: row.inventoryStatus ?? defaultInventoryStatus,
        calculatorMaterialId: defaultCalculatorMaterialId,
        calculatorSheetPresetId: rowCalculatorSheetPresetId,
        images: imageUrl
          ? {
              create: [{ url: imageUrl, alt: row.name, sortOrder: 10 }],
            }
          : undefined,
        attributes:
          importAttributes && attributeCreates.length > 0
            ? { create: attributeCreates }
            : undefined,
      };

      const product = await db.product.create({
        data: createData,
        select: { id: true, sku: true, slug: true },
      });
      const createdProduct = { ...product, name: productName };
      const createdNameKey = normalizeImportLookup(productName);

      productBySku.set(normalizeImportSkuKey(product.sku), createdProduct);
      // Повтор того же названия без артикула ниже в файле обновит этот
      // товар, а не создаст второй такой же.
      productsByName.set(createdNameKey, [
        ...(productsByName.get(createdNameKey) ?? []),
        createdProduct,
      ]);
      if (productsByName.get(createdNameKey)?.length === 1) {
        productByUniqueName.set(createdNameKey, createdProduct);
      } else {
        productByUniqueName.delete(createdNameKey);
      }
      created += 1;
    } catch (error) {
      errors += 1;
      hiddenImportNotes += addImportNote(
        importNotes,
        `Строка ${row.rowNumber}: ошибка сохранения.`,
      );

      console.error("[product-import]", {
        row: row.rowNumber,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  if (generatedSkus > 0) {
    addImportNote(
      importNotes,
      `Для строк без артикула создано SKU: ${generatedSkus}.`,
    );
  }

  if (fallbackCategories > 0) {
    addImportNote(
      importNotes,
      `Без категории перенесено в раздел "Импорт": ${fallbackCategories}.`,
    );
  }

  revalidateAdminCatalog();
  redirect(
    getProductImportRedirect({
      created,
      updated,
      skipped,
      errors,
      warnings: parsed.warnings.length,
      mapped: parsed.mappedColumns.length,
      message: getImportMessageWithNotes(importNotes, hiddenImportNotes),
    }),
  );
}

export async function updateProductStockFromExcelAction() {
  await ensureAdminAccess();
  redirect("/admin/products#stock-import");
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
    case "price-percent": {
      // Изменение цены на процент: +10 дороже на 10%, -5 дешевле на 5%.
      const percent = getOptionalFloat(formData, "pricePercent");

      if (!percent || percent < -90 || percent > 300) {
        return;
      }

      const priced = await db.product.findMany({
        where: { id: { in: productIds }, price: { not: null } },
        select: { id: true, price: true },
      });

      await db.$transaction(
        priced.map((product) =>
          db.product.update({
            where: { id: product.id },
            data: {
              price: Math.max(
                0,
                Math.round(((product.price ?? 0) * (100 + percent)) / 100),
              ),
            },
          }),
        ),
      );
      break;
    }
    case "set-category": {
      const categoryId = getString(formData, "bulkCategoryId");
      const category = categoryId
        ? await db.category.findUnique({
            where: { id: categoryId },
            select: { id: true },
          })
        : null;

      if (!category) {
        return;
      }

      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { categoryId: category.id },
      });
      break;
    }
    case "set-brand": {
      const brandId = getString(formData, "bulkBrandId");
      const brand = brandId
        ? await db.brand.findUnique({
            where: { id: brandId },
            select: { id: true },
          })
        : null;

      if (!brand) {
        return;
      }

      await db.product.updateMany({
        where: { id: { in: productIds } },
        data: { brandId: brand.id },
      });
      break;
    }
    default:
      return;
  }

  revalidateAdminCatalog();
}

export async function updateOrderAction(formData: FormData) {
  const actor = await ensureAdminAccess();

  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (!id || !status) {
    return;
  }

  const nextStatus =
    Object.values(OrderStatus).find((item) => item === status) ??
    OrderStatus.NEW;

  await applyOrderStatusChange({
    id,
    nextStatus,
    actor,
    managerId: formData.has("managerId")
      ? getOptionalString(formData, "managerId")
      : undefined,
  });

  revalidateAdminOperations();
}

// Смена статуса заказа со всем, что за ней следует: резерв, бонусы, история,
// уведомления. Используется и кнопками менеджера, и автоматическими
// переходами (оплата по чеку, выдача распила).
async function applyOrderStatusChange(input: {
  id: string;
  nextStatus: OrderStatus;
  actor: Awaited<ReturnType<typeof ensureCuttingAdminAccess>>;
  managerId?: string | null;
}) {
  const { id, nextStatus, actor } = input;
  const previousOrder = await getOrderInboxItemById(id);

  const statusUpdate = await updateOrderInboxItem({
    id,
    status: nextStatus,
    managerId: input.managerId,
    actorId: actor.userId,
  });

  const currentOrder = await getOrderInboxItemById(id);
  await reverseOrderLoyaltyIfCanceled({
    orderId: id,
    previousStatus: previousOrder?.status ?? null,
    nextStatus: currentOrder?.status ?? nextStatus,
    actor,
    result: statusUpdate?.loyaltyCancellation ?? null,
  });
  await reconcileOrderLoyaltyAccrual({
    orderId: id,
    actor,
  });

  await logOrderTransition({
    orderId: id,
    previous: previousOrder
      ? {
          status: previousOrder.status,
          manager: previousOrder.manager,
        }
      : null,
    current: currentOrder
      ? {
          status: currentOrder.status,
          manager: currentOrder.manager,
        }
      : null,
    actor,
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
}

const unpaidOrderStatuses = new Set<OrderStatus>([
  OrderStatus.NEW,
  OrderStatus.RESERVED,
  OrderStatus.CONFIRMED,
]);

export async function updateOrderDetailsAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const actor = await ensureAdminAccess();
  const orderId = getString(formData, "orderId");
  const contactName = getString(formData, "contactName");
  const contactPhone = getString(formData, "contactPhone");

  if (!orderId || !contactName || !contactPhone) {
    return;
  }

  const previousOrder = await getOrderInboxItemById(orderId);
  const nextOrderComment = buildOrderCommentWithReceipt(
    formData.has("comment")
      ? getString(formData, "comment")
      : removeOrderReceiptLine(previousOrder?.comment ?? null),
    formData.has("receiptNumber")
      ? getOptionalString(formData, "receiptNumber")
      : getOrderReceiptNumberFromComment(previousOrder?.comment ?? null),
  );

  await getDb().order.update({
    where: { id: orderId },
    data: {
      contactName,
      contactPhone,
      contactEmail: getOptionalString(formData, "contactEmail"),
      companyName: getOptionalString(formData, "companyName"),
      comment: nextOrderComment,
    },
  });

  await logOperationEvent({
    entityType: "order",
    entityId: orderId,
    eventType: "system",
    title: "Данные заказа обновлены",
    description:
      "Менеджер изменил контактные данные клиента, компанию или комментарий к заказу.",
    actor,
  });

  // Клиент платит на кассе полностью. Как только менеджер вписал номер
  // кассового чека или накладной 1С, неоплаченный заказ сам становится
  // «Оплачен».
  const receiptAdded =
    !getOrderReceiptNumberFromComment(previousOrder?.comment ?? null) &&
    Boolean(getOrderReceiptNumberFromComment(nextOrderComment));

  if (
    receiptAdded &&
    previousOrder &&
    unpaidOrderStatuses.has(previousOrder.status)
  ) {
    await applyOrderStatusChange({
      id: orderId,
      nextStatus: OrderStatus.PAID,
      actor,
    });
  } else {
    await syncOrderById(
      orderId,
      previousOrder
        ? {
            previousStatus: previousOrder.status,
            previousManager: previousOrder.manager,
          }
        : undefined,
    );
  }

  revalidateAdminOperations();
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function updateOrderItemsAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const actor = await ensureAdminAccess();
  const orderId = getString(formData, "orderId");

  if (!orderId) {
    return;
  }

  const itemIds = getStringList(formData, "itemId");
  const removeItemIds = new Set(getStringList(formData, "removeItemId"));
  const names = formData
    .getAll("itemName")
    .map((value) => (typeof value === "string" ? value : ""));
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");
  const newProductId = getOptionalString(formData, "newProductId");
  const newItemName = getOptionalString(formData, "newItemName");
  const newItemQuantity = Math.max(
    1,
    Math.min(9999, getOptionalInt(formData, "newItemQuantity") ?? 1),
  );
  const newItemUnitPrice = getOptionalInt(formData, "newItemUnitPrice");

  if (itemIds.length === 0 && !newProductId && !newItemName) {
    return;
  }

  const previousOrder = await getOrderInboxItemById(orderId);
  const db = getDb();
  const loyaltyConfig = await getLoyaltyProgramConfig();

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    const [order, currentItems, newProduct] = await Promise.all([
      tx.order.findUnique({
        where: { id: orderId },
        select: {
          subtotal: true,
          discountTotal: true,
          promotionDiscountTotal: true,
          loyaltyRedemptionTotal: true,
          deliveryTotal: true,
          inventoryReservedAt: true,
          userId: true,
          status: true,
          appliedPromotion: {
            select: {
              id: true,
              name: true,
              status: true,
              targetType: true,
              discountType: true,
              discountValue: true,
              minOrderTotal: true,
              startsAt: true,
              endsAt: true,
            },
          },
        },
      }),
      tx.orderItem.findMany({
        where: { orderId },
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          snapshotName: true,
          discountAmount: true,
        },
      }),
      newProductId
        ? tx.product.findFirst({
            where: {
              id: newProductId,
              status: { not: ProductStatus.ARCHIVED },
            },
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
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
              brand: { select: { name: true } },
              category: { select: { kind: true } },
            },
          })
        : Promise.resolve(null),
    ]);

    if (!order) {
      return;
    }

    const currentItemMap = new Map(currentItems.map((item) => [item.id, item]));
    const nextItems = itemIds.flatMap((itemId, index) => {
      if (removeItemIds.has(itemId)) {
        return [];
      }

      const currentItem = currentItemMap.get(itemId);
      const name = names[index]?.trim();
      const rawQuantity = quantities[index];
      const rawUnitPrice = unitPrices[index];
      const quantity =
        typeof rawQuantity === "string"
          ? Math.max(1, Math.min(9999, Number.parseInt(rawQuantity, 10) || 1))
          : 1;
      const unitPrice =
        typeof rawUnitPrice === "string"
          ? Math.max(0, Number.parseInt(rawUnitPrice, 10) || 0)
          : 0;

      if (!currentItem || !name) {
        return [];
      }

      const discountAmount = Math.min(
        currentItem.discountAmount,
        unitPrice * quantity,
      );

      return [
        {
          id: itemId,
          productId: currentItem.productId,
          name,
          quantity,
          unitPrice,
          discountAmount,
          total: Math.max(0, unitPrice * quantity - discountAmount),
        },
      ];
    });

    if (removeItemIds.size > 0) {
      await tx.orderItem.deleteMany({
        where: {
          orderId,
          id: { in: [...removeItemIds] },
        },
      });
    }

    await Promise.all(
      nextItems.map((item) =>
        tx.orderItem.update({
          where: { id: item.id },
          data: {
            snapshotName: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            total: item.total,
          },
        }),
      ),
    );

    const newProductPrice = newProduct
      ? (getEffectiveProductPrice(newProduct) ?? 0)
      : null;
    const newSnapshotName = newItemName ?? newProduct?.name ?? null;

    if (order.inventoryReservedAt) {
      const submittedItemIds = new Set(itemIds);
      const untouchedItems = currentItems.filter(
        (item) => !submittedItemIds.has(item.id) && !removeItemIds.has(item.id),
      );

      await adjustInventoryReservation(
        tx,
        currentItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          name: item.snapshotName,
        })),
        [
          ...untouchedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            name: item.snapshotName,
          })),
          ...nextItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            name: item.name,
          })),
          ...(newProduct && newSnapshotName
            ? [
                {
                  productId: newProduct.id,
                  quantity: newItemQuantity,
                  name: newSnapshotName,
                },
              ]
            : []),
        ],
      );
    }

    if (newSnapshotName && (newProduct || newItemName)) {
      const unitPrice = Math.max(0, newItemUnitPrice ?? newProductPrice ?? 0);

      await tx.orderItem.create({
        data: {
          orderId,
          productId: newProduct?.id ?? null,
          quantity: newItemQuantity,
          unitPrice,
          discountAmount: 0,
          total: unitPrice * newItemQuantity,
          snapshotName: newSnapshotName,
          snapshotSku: newProduct?.sku ?? null,
          snapshotBrand: newProduct?.brand?.name ?? null,
          snapshotCategoryKind: newProduct?.category.kind ?? null,
        },
      });
    }

    const finalItems = await tx.orderItem.findMany({
      where: { orderId },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        discountAmount: true,
        total: true,
        product: {
          select: {
            promotions: {
              select: { promotion: { select: PROMOTION_PRICE_SELECT } },
            },
            category: {
              select: {
                promotions: {
                  select: { promotion: { select: PROMOTION_PRICE_SELECT } },
                },
              },
            },
          },
        },
      },
    });
    const repricedItems = finalItems.map((item) => {
      const lineSubtotal = item.unitPrice * item.quantity;
      const previousItem = currentItemMap.get(item.id);
      const previousLineSubtotal = previousItem
        ? previousItem.unitPrice * previousItem.quantity
        : 0;
      const promotionPrice = item.product
        ? getProductPromotionPrice(
            item.unitPrice,
            item.product.promotions,
            item.product.category.promotions,
          )
        : null;
      // Скидку строки, которая уже была в заказе, сохраняем в той же доле:
      // правка количества не должна стирать личную скидку или цену из
      // накладной. Акцию заново считаем только для новой строки.
      const discountAmount = previousItem
        ? previousLineSubtotal > 0
          ? Math.min(
              lineSubtotal,
              Math.round(
                (previousItem.discountAmount / previousLineSubtotal) *
                  lineSubtotal,
              ),
            )
          : 0
        : item.product
          ? (promotionPrice?.unitDiscountAmount ?? 0) * item.quantity
          : Math.min(item.discountAmount, lineSubtotal);

      return {
        ...item,
        lineSubtotal,
        discountAmount,
        total: Math.max(0, lineSubtotal - discountAmount),
      };
    });

    await Promise.all(
      repricedItems
        .filter(
          (item) =>
            item.discountAmount !==
              finalItems.find((current) => current.id === item.id)
                ?.discountAmount ||
            item.total !==
              finalItems.find((current) => current.id === item.id)?.total,
        )
        .map((item) =>
          tx.orderItem.update({
            where: { id: item.id },
            data: {
              discountAmount: item.discountAmount,
              total: item.total,
            },
          }),
        ),
    );
    const subtotal = finalItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const linePromotionDiscountTotal = repricedItems.reduce(
      (sum, item) => sum + item.discountAmount,
      0,
    );
    const subtotalAfterLinePromotions = Math.max(
      0,
      subtotal - linePromotionDiscountTotal,
    );
    const orderPromotionDiscountTotal =
      order.appliedPromotion?.targetType === PromotionTargetType.ORDER &&
      (!order.appliedPromotion.minOrderTotal ||
        subtotalAfterLinePromotions >= order.appliedPromotion.minOrderTotal)
        ? applyPromotion(subtotalAfterLinePromotions, order.appliedPromotion)
            .discountAmount
        : 0;
    const promotionDiscountTotal =
      linePromotionDiscountTotal + orderPromotionDiscountTotal;
    // Личная скидка заказа с сайта хранится на уровне заказа, а не строк.
    // Сохраняем её в той же доле от суммы после скидок строк.
    const previousLineDiscountTotal = currentItems.reduce(
      (sum, item) => sum + item.discountAmount,
      0,
    );
    const previousPersonalDiscount = Math.max(
      0,
      order.discountTotal -
        Math.max(order.promotionDiscountTotal, previousLineDiscountTotal),
    );
    const previousPersonalBase = order.subtotal - previousLineDiscountTotal;
    const personalDiscountTotal =
      previousPersonalDiscount > 0 && previousPersonalBase > 0
        ? Math.min(
            Math.max(0, subtotal - promotionDiscountTotal),
            Math.round(
              (previousPersonalDiscount / previousPersonalBase) *
                subtotalAfterLinePromotions,
            ),
          )
        : 0;
    const subtotalAfterPromotion = Math.max(
      0,
      subtotal - promotionDiscountTotal - personalDiscountTotal,
    );
    const loyaltyRedemptionTotal = Math.min(
      order.loyaltyRedemptionTotal,
      Math.floor(
        (subtotalAfterPromotion * loyaltyConfig.maxRedeemPercent) / 100,
      ),
    );
    const redemptionRefund =
      order.loyaltyRedemptionTotal - loyaltyRedemptionTotal;

    if (order.userId && redemptionRefund > 0) {
      const redemptionTransactions = await tx.loyaltyTransaction.findMany({
        where: {
          orderId,
          type: LoyaltyTransactionType.REDEMPTION,
          status: {
            in: [
              LoyaltyTransactionStatus.APPROVED,
              LoyaltyTransactionStatus.CANCELED,
            ],
          },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true },
      });
      const primaryRedemption = redemptionTransactions[0] ?? null;

      if (
        primaryRedemption?.status === LoyaltyTransactionStatus.APPROVED &&
        order.status !== OrderStatus.CANCELED
      ) {
        const updatedUser = await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPointsBalance: { increment: redemptionRefund },
          },
          select: { loyaltyPointsBalance: true },
        });

        if (loyaltyRedemptionTotal > 0) {
          await tx.loyaltyTransaction.update({
            where: { id: primaryRedemption.id },
            data: {
              points: -loyaltyRedemptionTotal,
              balanceAfter: updatedUser.loyaltyPointsBalance,
            },
          });
        } else {
          await tx.loyaltyTransaction.update({
            where: { id: primaryRedemption.id },
            data: {
              status: LoyaltyTransactionStatus.CANCELED,
              points: 0,
              balanceAfter: updatedUser.loyaltyPointsBalance,
              canceledAt: new Date(),
              canceledById: actor.userId,
            },
          });
        }
      } else if (primaryRedemption) {
        await tx.loyaltyTransaction.update({
          where: { id: primaryRedemption.id },
          data: { points: -loyaltyRedemptionTotal },
        });
      }

      const duplicateRedemptionIds = redemptionTransactions
        .slice(1)
        .map((transaction) => transaction.id);
      if (duplicateRedemptionIds.length > 0) {
        await tx.loyaltyTransaction.updateMany({
          where: { id: { in: duplicateRedemptionIds } },
          data: {
            status: LoyaltyTransactionStatus.CANCELED,
            canceledAt: new Date(),
            canceledById: actor.userId,
          },
        });
      }
    }

    const total = Math.max(
      0,
      subtotal -
        promotionDiscountTotal -
        personalDiscountTotal -
        loyaltyRedemptionTotal +
        order.deliveryTotal,
    );

    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        discountTotal: promotionDiscountTotal + personalDiscountTotal,
        promotionDiscountTotal,
        loyaltyRedemptionTotal,
        total,
      },
    });
  });

  await reconcileOrderLoyaltyAccrual({
    orderId,
    actor,
  });

  await logOperationEvent({
    entityType: "order",
    entityId: orderId,
    eventType: "system",
    title: "Обновлен состав заказа",
    description:
      "Менеджер изменил позиции, количество, цену или состав заказа.",
    actor,
  });

  await syncOrderById(
    orderId,
    previousOrder
      ? {
          previousStatus: previousOrder.status,
          previousManager: previousOrder.manager,
        }
      : undefined,
  );

  revalidateAdminOperations();
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function deleteOrderAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const actor = await ensureAdminAccess();

  if (!canDeleteOrders(actor.roleCode)) {
    return;
  }

  const orderId = getString(formData, "orderId");
  const confirmation = getString(formData, "confirmDeleteOrder");

  if (!orderId || confirmation !== "DELETE") {
    return;
  }

  const db = getDb();

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        managerNotes: true,
        loyaltyTransactions: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      return;
    }

    const approvedLoyaltyTransactions = order.loyaltyTransactions.filter(
      (transaction) => transaction.status === LoyaltyTransactionStatus.APPROVED,
    );

    if (order.userId && approvedLoyaltyTransactions.length > 0) {
      const balanceDelta = approvedLoyaltyTransactions.reduce(
        (sum, transaction) => sum + transaction.points,
        0,
      );
      const lifetimeDelta = approvedLoyaltyTransactions.reduce(
        (sum, transaction) =>
          transaction.points > 0 ? sum + transaction.points : sum,
        0,
      );
      await tx.user.update({
        where: { id: order.userId },
        data: {
          loyaltyPointsBalance: { increment: -balanceDelta },
          loyaltyPointsLifetime: { increment: -lifetimeDelta },
        },
      });
    }

    const operationEvents = await tx.operationEvent.findMany({
      where: { entityType: "order", entityId: orderId },
      orderBy: { createdAt: "asc" },
    });
    const snapshot = JSON.parse(
      JSON.stringify({ order, operationEvents }),
    ) as Prisma.InputJsonValue;

    await tx.deletedOrderAudit.create({
      data: {
        orderId: order.id,
        orderNumber: order.number,
        deletedById: actor.userId,
        deletedByEmail: actor.email,
        snapshot,
      },
    });

    await syncOrderInventoryReservation(tx, orderId, false);
    await tx.loyaltyTransaction.deleteMany({ where: { orderId } });
    await tx.operationEvent.deleteMany({
      where: { entityType: "order", entityId: orderId },
    });
    await tx.order.delete({ where: { id: orderId } });
  });

  revalidateAdminOperations();
  revalidateAdminUsers();
  redirect("/admin/orders");
}

export async function addOrderManagerNoteAction(formData: FormData) {
  const actor = await ensureAdminAccess();

  const orderId = getString(formData, "orderId");
  const body = getString(formData, "body");
  const isVisibleToClient = getString(formData, "isVisibleToClient") === "on";

  if (!orderId || !body) {
    return;
  }

  await addOrderManagerNote({
    orderId,
    body,
    isVisibleToClient,
    actor,
  });

  await logOperationEvent({
    entityType: "order",
    entityId: orderId,
    eventType: isVisibleToClient ? "client_note" : "manager_note",
    title: isVisibleToClient
      ? "Добавлен комментарий для клиента"
      : "Добавлена внутренняя заметка",
    description: isVisibleToClient ? body : null,
    isVisibleToClient,
    actor,
  });

  revalidateAdminOperations();
}

export async function updateOrderFulfillmentAction(formData: FormData) {
  const actor = await ensureAdminAccess();

  const orderId = getString(formData, "orderId");
  const status = getString(formData, "status");

  if (!orderId) {
    return;
  }

  const previousOrder = await getOrderInboxItemById(orderId);
  const nextStatus =
    Object.values(OrderStatus).find((item) => item === status) ?? null;

  const fulfillmentUpdate = await updateOrderFulfillment({
    orderId,
    productionDueAt: getOptionalDate(formData, "productionDueAt"),
    fulfillmentComment: getOptionalString(formData, "fulfillmentComment"),
    status: nextStatus,
    actorId: actor.userId,
  });

  const currentOrder = await getOrderInboxItemById(orderId);
  if (currentOrder?.status) {
    await reverseOrderLoyaltyIfCanceled({
      orderId,
      previousStatus: previousOrder?.status ?? null,
      nextStatus: currentOrder.status,
      actor,
      result: fulfillmentUpdate?.loyaltyCancellation ?? null,
    });
    await reconcileOrderLoyaltyAccrual({
      orderId,
      actor,
    });
  }

  await Promise.all([
    logOperationEvent({
      entityType: "order",
      entityId: orderId,
      eventType: "fulfillment",
      title: "Обновлены параметры выдачи",
      description:
        getOptionalString(formData, "fulfillmentComment") ??
        "Плановая дата, комментарий выдачи или статус заказа обновлены.",
      fromStatus: previousOrder?.status ?? null,
      toStatus: currentOrder?.status ?? nextStatus,
      isVisibleToClient: true,
      actor,
    }),
    logOrderTransition({
      orderId,
      previous: previousOrder
        ? {
            status: previousOrder.status,
            manager: previousOrder.manager,
          }
        : null,
      current: currentOrder
        ? {
            status: currentOrder.status,
            manager: currentOrder.manager,
          }
        : null,
      actor,
    }),
  ]);

  await syncOrderById(
    orderId,
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
  const actor = await ensureAdminAccess();

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
  let loyaltyCancellations = new Map<string, OrderLoyaltyCancellationResult>();

  switch (bulkAction) {
    case "reserve":
      await bulkUpdateOrderInboxItems({
        orderIds,
        status: OrderStatus.RESERVED,
      });
      break;
    case "confirm":
      await bulkUpdateOrderInboxItems({
        orderIds,
        status: OrderStatus.CONFIRMED,
      });
      break;
    case "mark-paid":
      await bulkUpdateOrderInboxItems({
        orderIds,
        status: OrderStatus.PAID,
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
      loyaltyCancellations =
        (await bulkUpdateOrderInboxItems({
          orderIds,
          status: OrderStatus.CANCELED,
          actorId: actor.userId,
        })) ?? loyaltyCancellations;
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
    orderIds.map(async (orderId) => {
      const currentOrder = await getOrderInboxItemById(orderId);
      const previous = previousOrderMap.get(orderId);

      if (currentOrder?.status) {
        await reverseOrderLoyaltyIfCanceled({
          orderId,
          previousStatus: previous?.previousStatus as OrderStatus | undefined,
          nextStatus: currentOrder.status,
          actor,
          result: loyaltyCancellations.get(orderId) ?? null,
        });
        await reconcileOrderLoyaltyAccrual({
          orderId,
          actor,
        });
      }

      await logOrderTransition({
        orderId,
        previous: previous
          ? {
              status: previous.previousStatus as OrderStatus,
              manager: previous.previousManager ?? null,
            }
          : null,
        current: currentOrder
          ? {
              status: currentOrder.status,
              manager: currentOrder.manager,
            }
          : null,
        actor,
      });

      await syncOrderById(orderId, previous);
    }),
  );

  revalidateAdminOperations();
}

export async function createOrderFromRequestAction(formData: FormData) {
  const actor = await ensureAdminAccess();

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
  const convertedTotal =
    request.type === RequestType.CUTTING_SERVICE
      ? (request.quotedTotal ?? request.estimatedBudget ?? 0)
      : (request.estimatedBudget ?? 0);

  // Распил оплачивается через заказ, но делается по заявке: она остаётся в
  // производстве и закрывается кнопкой «Выдано». Остальные заявки после
  // создания заказа закрываются, как раньше.
  const staysInProduction = request.type === RequestType.CUTTING_SERVICE;
  const nextRequestStatus = staysInProduction
    ? request.status
    : RequestStatus.COMPLETED;

  if (!staysInProduction) {
    await updateRequestInboxItem({
      id: requestId,
      status: RequestStatus.COMPLETED,
      managerId: request.managerId ?? null,
    });
  }

  await Promise.all([
    logOperationEvent({
      entityType: "request",
      entityId: requestId,
      eventType: "converted",
      title: `Создан заказ ${createdOrder.number ?? createdOrder.id}`,
      description: staysInProduction
        ? "Создан заказ на оплату. Распил продолжается по этой заявке."
        : "Заявка переведена в заказ для дальнейшей работы.",
      fromStatus: request.status,
      toStatus: nextRequestStatus,
      isVisibleToClient: true,
      actor,
    }),
    logOperationEvent({
      entityType: "order",
      entityId: createdOrder.id,
      eventType: "created",
      title: `Заказ создан из заявки ${request.number ?? request.id}`,
      description:
        "Контакты, материал, комментарии и файлы перенесены из заявки.",
      toStatus: OrderStatus.NEW,
      isVisibleToClient: true,
      actor,
    }),
  ]);

  await handleOrderCreated({
    id: createdOrder.id,
    userId: request.userId ?? null,
    number: createdOrder.number ?? null,
    status: OrderStatus.NEW,
    contactName: request.contactName,
    contactPhone: request.contactPhone,
    contactEmail: request.contactEmail,
    companyName: null,
    comment: request.message,
    deliveryMethod: request.deliveryNeeded
      ? "Требует уточнения"
      : "Самовывоз / уточнить",
    total: convertedTotal,
    subtotal: convertedTotal,
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
        unitPrice: convertedTotal,
        total: convertedTotal,
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
  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (!id || !status) {
    return;
  }

  const actor = await ensureRequestAdminAccess(id);

  const previousRequest = await getRequestInboxItemById(id);

  await updateRequestInboxItem({
    id,
    status:
      Object.values(RequestStatus).find((item) => item === status) ??
      RequestStatus.NEW,
    managerId: getOptionalString(formData, "managerId"),
  });

  const currentRequest = await getRequestInboxItemById(id);

  await logRequestTransition({
    requestId: id,
    previous: previousRequest
      ? {
          status: previousRequest.status,
          manager: previousRequest.manager,
        }
      : null,
    current: currentRequest
      ? {
          status: currentRequest.status,
          manager: currentRequest.manager,
        }
      : null,
    actor,
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

export async function deleteRequestAction(formData: FormData) {
  const actor = await ensureAdminAccess();

  if (!canDeleteRequests(actor.roleCode)) {
    return;
  }

  const requestId = getString(formData, "requestId");
  const confirmation = getString(formData, "confirmDeleteRequest");
  const requestedReturnTo = getString(formData, "returnTo");
  const allowedReturnPaths = new Set([
    "/admin/requests",
    "/admin/cutting",
    "/admin/production",
  ]);
  const returnTo = allowedReturnPaths.has(requestedReturnTo)
    ? requestedReturnTo
    : "/admin/requests";

  if (!requestId || confirmation !== "DELETE") {
    return;
  }

  if (!hasDatabaseUrl()) {
    await deleteDemoRequestInboxItem(requestId);
    revalidateAdminOperations();
    redirect(returnTo);
  }

  const db = getDb();

  await db.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: {
        files: true,
        managerNotes: true,
        linkedOrders: {
          select: {
            id: true,
            number: true,
            status: true,
          },
        },
      },
    });

    if (!request) {
      return;
    }

    const operationEvents = await tx.operationEvent.findMany({
      where: { entityType: "request", entityId: requestId },
      orderBy: { createdAt: "asc" },
    });
    const snapshot = JSON.parse(
      JSON.stringify({ request, operationEvents }),
    ) as Prisma.InputJsonValue;

    await tx.deletedRequestAudit.create({
      data: {
        requestId: request.id,
        requestNumber: request.number,
        deletedById: actor.userId,
        deletedByEmail: actor.email,
        snapshot,
      },
    });

    await tx.operationEvent.deleteMany({
      where: { entityType: "request", entityId: requestId },
    });
    await tx.request.delete({ where: { id: requestId } });
  });

  revalidateAdminOperations();
  redirect(returnTo);
}

export async function addRequestManagerNoteAction(formData: FormData) {
  const requestId = getString(formData, "requestId");
  const body = getString(formData, "body");
  const isVisibleToClient = getString(formData, "isVisibleToClient") === "on";

  if (!requestId || !body) {
    return;
  }

  const actor = await ensureRequestAdminAccess(requestId);

  await addRequestManagerNote({
    requestId,
    body,
    isVisibleToClient,
    actor,
  });

  await logOperationEvent({
    entityType: "request",
    entityId: requestId,
    eventType: isVisibleToClient ? "client_note" : "manager_note",
    title: isVisibleToClient
      ? "Добавлен комментарий для клиента"
      : "Добавлена внутренняя заметка",
    description: isVisibleToClient ? body : null,
    isVisibleToClient,
    actor,
  });

  revalidateAdminOperations();
}

export async function updateRequestProductionResultAction(formData: FormData) {
  const requestId = getString(formData, "requestId");
  const status = getString(formData, "status");

  if (!requestId) {
    return;
  }

  const actor = await ensureRequestAdminAccess(requestId);

  const previousRequest = await getRequestInboxItemById(requestId);
  const nextStatus =
    Object.values(RequestStatus).find((item) => item === status) ?? null;

  await updateRequestProductionResult({
    requestId,
    quotedTotal: getOptionalInt(formData, "quotedTotal"),
    productionComment: getOptionalString(formData, "productionComment"),
    status: nextStatus,
  });

  const currentRequest = await getRequestInboxItemById(requestId);

  await Promise.all([
    logOperationEvent({
      entityType: "request",
      entityId: requestId,
      eventType: "production_result",
      title: "Обновлен результат распила",
      description:
        getOptionalString(formData, "productionComment") ??
        "Итоговая сумма или производственный комментарий обновлены.",
      fromStatus: previousRequest?.status ?? null,
      toStatus: currentRequest?.status ?? nextStatus,
      isVisibleToClient: true,
      actor,
    }),
    logRequestTransition({
      requestId,
      previous: previousRequest
        ? {
            status: previousRequest.status,
            manager: previousRequest.manager,
          }
        : null,
      current: currentRequest
        ? {
            status: currentRequest.status,
            manager: currentRequest.manager,
          }
        : null,
      actor,
    }),
  ]);

  await syncRequestById(
    requestId,
    previousRequest
      ? {
          previousStatus: previousRequest.status,
          previousManager: previousRequest.manager,
        }
      : undefined,
  );

  revalidateAdminOperations();
}

export type AdminCuttingRequestFormState = {
  message?: string;
};

function formatAdminCuttingDeadline(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export async function createAdminCuttingRequestAction(
  _previousState: AdminCuttingRequestFormState,
  formData: FormData,
): Promise<AdminCuttingRequestFormState> {
  const actor = await ensureCuttingAdminAccess();

  if (
    !canAccessGeneralAdmin(actor.roleCode) &&
    !isCuttingManager(actor.roleCode)
  ) {
    redirect(getAdminHomePath(actor.roleCode));
  }

  const customerId = getOptionalString(formData, "customerId");
  const material = getString(formData, "material");
  const cuttingSheetCount = getOptionalInt(formData, "cuttingSheetCount");
  const cuttingEdgeMeters = getOptionalFloat(formData, "cuttingEdgeMeters");
  const edgeOption = getOptionalString(formData, "edgeOption")?.slice(0, 240);
  const deadlineValue = getOptionalString(formData, "deadline");
  const deadline = formatAdminCuttingDeadline(deadlineValue);
  const comment = getOptionalString(formData, "comment");
  const files = getFileList(formData, "files");

  if (material.length < 2) {
    return { message: "Укажите материал для распила." };
  }

  if (
    cuttingSheetCount !== null &&
    (cuttingSheetCount < 1 || cuttingSheetCount > 10000)
  ) {
    return { message: "Количество листов должно быть от 1 до 10 000." };
  }

  if (
    cuttingEdgeMeters !== null &&
    (cuttingEdgeMeters < 0 || cuttingEdgeMeters > 100000)
  ) {
    return { message: "Метраж кромки должен быть от 0,1 до 100 000 м." };
  }

  if (deadlineValue && !deadline) {
    return { message: "Проверьте дату готовности." };
  }

  const unsupportedFile = files.find(
    (file) => !isAllowedRequestFile(file.name),
  );

  if (unsupportedFile) {
    return {
      message: `Формат файла ${unsupportedFile.name} не поддерживается.`,
    };
  }

  let linkedCustomer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    companyName: string | null;
  } | null = null;

  if (customerId) {
    if (!hasDatabaseUrl()) {
      return { message: "Поиск клиентов недоступен без базы данных." };
    }

    linkedCustomer = await getDb().user.findFirst({
      where: {
        id: customerId,
        isActive: true,
        role: {
          code: {
            in: [RoleCode.CUSTOMER, RoleCode.DEALER],
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
      },
    });

    if (!linkedCustomer) {
      return { message: "Выбранный клиент не найден или отключен." };
    }
  }

  const customerDisplayName = linkedCustomer
    ? [linkedCustomer.firstName, linkedCustomer.lastName]
        .filter(Boolean)
        .join(" ") ||
      linkedCustomer.companyName ||
      linkedCustomer.email
    : "";
  const contactName = getString(formData, "contactName") || customerDisplayName;
  const contactPhone =
    getString(formData, "contactPhone") || linkedCustomer?.phone || "";
  const contactEmail =
    getOptionalString(formData, "contactEmail") ??
    linkedCustomer?.email ??
    null;

  if (contactName.length < 2) {
    return { message: "Укажите имя клиента." };
  }

  if (contactPhone.replace(/\D/g, "").length < 5) {
    return { message: "Укажите телефон клиента." };
  }

  if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) {
    return { message: "Проверьте email клиента." };
  }

  const requestMessage = [
    "Создано менеджером в админке.",
    deadline ? `Плановая готовность: ${deadline}.` : "",
    files.length > 0
      ? `Исходных файлов: ${files.length}.`
      : "Исходные файлы не приложены. Их можно добавить позже.",
    comment ? "" : null,
    comment ? "Комментарий:" : null,
    comment,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  const actorName =
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;

  let createdRequest: Awaited<ReturnType<typeof createCuttingRequest>>;

  try {
    createdRequest = await createCuttingRequest(
      {
        subject: `Распил: ${material}`,
        message: requestMessage,
        contactName,
        contactPhone,
        contactEmail,
        material,
        cuttingSheetCount,
        cuttingEdgeMeters,
        edgeOption,
        estimatedBudget: null,
        userId: linkedCustomer?.id ?? null,
        uploadedFiles: files,
      },
      {
        skipDuplicateCheck: true,
        status: RequestStatus.IN_PROGRESS,
        cuttingStage: CuttingStage.ACCEPTED,
        managerId: actor.userId,
        filesVisibleToClient: Boolean(linkedCustomer),
        uploadedByUserId: actor.userId,
        uploadedByName: actorName,
      },
    );

    // Срок из формы сразу попадает в план производства, а не только в текст.
    if (deadlineValue && deadline) {
      await saveProductionPlan({
        requestId: createdRequest.id,
        dueDate: deadlineValue,
        expectedVersion: 0,
        actor,
      }).catch((error) => console.error("[cutting:deadline]", error));
    }

    await Promise.all([
      logOperationEvent({
        entityType: "request",
        entityId: createdRequest.id,
        eventType: "created",
        title: `Распил ${createdRequest.number ?? createdRequest.id} создан`,
        description:
          files.length > 0
            ? `Менеджер прикрепил исходных файлов: ${files.length}.`
            : "Распил создан без исходных файлов.",
        toStatus: RequestStatus.IN_PROGRESS,
        isVisibleToClient: Boolean(linkedCustomer),
        actor,
      }),
      handleCuttingRequestCreated({
        id: createdRequest.id,
        userId: linkedCustomer?.id ?? null,
        number: createdRequest.number,
        requestType: RequestType.CUTTING_SERVICE,
        subject: `Распил: ${material}`,
        status: RequestStatus.IN_PROGRESS,
        contactName,
        contactPhone,
        contactEmail,
        material,
        cuttingSheetCount,
        cuttingEdgeMeters,
        edgeOption,
        estimatedBudget: null,
        deliveryNeeded: false,
        message: requestMessage,
        createdAt: new Date().toISOString(),
        manager: {
          firstName: actor.firstName,
          lastName: actor.lastName,
          email: actor.email,
        },
        cuttingStage: CuttingStage.ACCEPTED,
      }),
    ]);
  } catch (error) {
    console.error("Admin cutting request was not created", error);
    return {
      message:
        "Не удалось создать распил. Проверьте данные и попробуйте еще раз.",
    };
  }

  revalidateAdminOperations();
  revalidatePath(`/admin/requests/${createdRequest.id}`);
  redirect(`/admin/requests/${createdRequest.id}`);
}

export async function updateRequestCuttingDetailsAction(formData: FormData) {
  const requestId = getString(formData, "requestId");

  if (!requestId) {
    return;
  }

  const actor = await ensureRequestAdminAccess(requestId);
  const request = await getRequestInboxItemById(requestId);

  if (!request || request.type !== RequestType.CUTTING_SERVICE) {
    return;
  }

  const material = getString(formData, "material").slice(0, 500);
  const cuttingSheetCount = getOptionalInt(formData, "cuttingSheetCount");
  const cuttingEdgeMeters = getOptionalFloat(formData, "cuttingEdgeMeters");
  const edgeOption =
    getOptionalString(formData, "edgeOption")?.slice(0, 240) ?? null;

  if (
    material.length < 2 ||
    (cuttingSheetCount !== null &&
      (cuttingSheetCount < 1 || cuttingSheetCount > 10000)) ||
    (cuttingEdgeMeters !== null &&
      (cuttingEdgeMeters < 0 || cuttingEdgeMeters > 100000))
  ) {
    return;
  }

  await updateRequestCuttingDetails({
    id: requestId,
    material,
    cuttingSheetCount,
    cuttingEdgeMeters,
    edgeOption,
  });

  await logOperationEvent({
    entityType: "request",
    entityId: requestId,
    eventType: "production_result",
    title: "Материалы распила обновлены",
    description: [
      `Материал: ${material}.`,
      cuttingSheetCount !== null
        ? `Листов: ${cuttingSheetCount}.`
        : "Количество листов не указано.",
      cuttingEdgeMeters !== null
        ? `Кромка: ${cuttingEdgeMeters.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м.`
        : "Метраж кромки не указан.",
      edgeOption ? `Кромка: ${edgeOption}.` : "Кромка не указана.",
    ].join(" "),
    isVisibleToClient: true,
    actor,
  });

  await syncRequestById(requestId);

  revalidateAdminOperations();
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}/route-sheet`);
}

// Этап, который менеджер видел на экране при отправке формы. Если оператор
// за это время продвинул заказ, сохранение не должно молча вернуть его назад.
function getExpectedStageFromForm(formData: FormData) {
  if (!formData.has("expectedStage")) {
    return {};
  }

  const value = getString(formData, "expectedStage");

  return {
    expectedStage:
      Object.values(CuttingStage).find((item) => item === value) ?? null,
  };
}

type CuttingProgressMutationInput = {
  requestId: string;
  stage: CuttingStage;
  pickupCell?: string | null;
  note?: string | null;
  // Комментарий оператора станции: виден сотрудникам, клиенту не уходит.
  internalNote?: boolean;
  expectedStage?: CuttingStage | null;
  actor: Awaited<ReturnType<typeof ensureCuttingAdminAccess>>;
};

async function applyRequestCuttingProgress(
  input: CuttingProgressMutationInput,
) {
  const previousRequest = await getRequestInboxItemById(input.requestId);

  if (
    !previousRequest ||
    previousRequest.type !== RequestType.CUTTING_SERVICE
  ) {
    return "missing" as const;
  }

  const updateInput = {
    requestId: input.requestId,
    stage: input.stage,
    pickupCell: input.pickupCell,
    ...(Object.prototype.hasOwnProperty.call(input, "expectedStage")
      ? { expectedStage: input.expectedStage }
      : {}),
  };
  const updated = await updateRequestCuttingProgress(updateInput);

  if (!updated) {
    return "conflict" as const;
  }

  const currentRequest = await getRequestInboxItemById(input.requestId);

  if (!currentRequest) {
    return "missing" as const;
  }

  const stageChanged =
    previousRequest.cuttingStage !== currentRequest.cuttingStage;
  const pickupCellChanged =
    previousRequest.cuttingPickupCell !== currentRequest.cuttingPickupCell;
  const statusChanged = previousRequest.status !== currentRequest.status;
  const progressDescription = [
    currentRequest.cuttingStage === CuttingStage.READY_FOR_PICKUP
      ? currentRequest.cuttingPickupCell
        ? `Ячейка выдачи: № ${currentRequest.cuttingPickupCell}.`
        : "Ячейка выдачи пока не указана."
      : null,
    input.internalNote ? null : input.note,
  ]
    .filter(Boolean)
    .join(" ");

  await Promise.all([
    stageChanged || pickupCellChanged || input.note
      ? logOperationEvent({
          entityType: "request",
          entityId: input.requestId,
          eventType: "cutting_stage",
          title: `Распил: ${cuttingStageLabels[currentRequest.cuttingStage ?? input.stage]}`,
          description: progressDescription || null,
          fromStatus: previousRequest.cuttingStage,
          toStatus: currentRequest.cuttingStage,
          isVisibleToClient: true,
          actor: input.actor,
        })
      : Promise.resolve(),
    input.internalNote && input.note
      ? logOperationEvent({
          entityType: "request",
          entityId: input.requestId,
          eventType: "cutting_stage",
          title: "Комментарий станции",
          description: input.note,
          isVisibleToClient: false,
          actor: input.actor,
        })
      : Promise.resolve(),
    statusChanged
      ? logRequestTransition({
          requestId: input.requestId,
          previous: {
            status: previousRequest.status,
            manager: previousRequest.manager,
          },
          current: {
            status: currentRequest.status,
            manager: currentRequest.manager,
          },
          actor: input.actor,
        })
      : Promise.resolve(),
  ]);

  if (stageChanged || pickupCellChanged || statusChanged) {
    await syncRequestById(input.requestId, {
      previousStatus: previousRequest.status,
      previousManager: previousRequest.manager,
      previousCuttingStage: previousRequest.cuttingStage,
      previousCuttingPickupCell: previousRequest.cuttingPickupCell,
      cuttingStageNote: input.note,
      cuttingStageNoteInternal: input.internalNote,
    });
  }

  revalidateAdminOperations();
  revalidatePath(`/admin/requests/${input.requestId}`);
  revalidatePath(`/admin/production/${input.requestId}`);

  return "updated" as const;
}

export async function updateRequestCuttingProgressAction(formData: FormData) {
  const requestId = getString(formData, "requestId");
  const stageValue = getString(formData, "cuttingStage");
  const stage =
    Object.values(CuttingStage).find((item) => item === stageValue) ?? null;

  if (!requestId || !stage) {
    return;
  }

  const actor = await ensureRequestAdminAccess(requestId);

  await applyRequestCuttingProgress({
    requestId,
    stage,
    pickupCell: getOptionalString(formData, "cuttingPickupCell"),
    note: getOptionalString(formData, "cuttingStageNote"),
    ...getExpectedStageFromForm(formData),
    actor,
  });
}

function productionActionReturn(
  formData: FormData,
  requestId: string,
  notice: string,
) {
  const params = new URLSearchParams({
    notice,
    returnTo: safeProductionReturn(getString(formData, "returnTo")),
  });
  return `/admin/production/${encodeURIComponent(requestId)}?${params}`;
}

export async function advanceProductionStageAction(formData: FormData) {
  const requestId = getString(formData, "requestId");

  if (!requestId) {
    redirect("/admin/production?notice=request-missing");
  }

  const actor = await ensureProductionAdminAccess(requestId);

  if (!isProductionOperator(actor.roleCode) || !actor.productionStation) {
    redirect(productionActionReturn(formData, requestId, "action-forbidden"));
  }

  const request = await getRequestInboxItemById(requestId);
  const transition = request
    ? getProductionTransition(actor.productionStation, request.cuttingStage)
    : null;

  if (!request || !transition) {
    redirect(productionActionReturn(formData, requestId, "stage-conflict"));
  }

  // Оператор берёт в работу только то, что менеджер запустил в производство.
  if (!request.cuttingStage && request.status !== RequestStatus.IN_PROGRESS) {
    redirect(productionActionReturn(formData, requestId, "not-launched"));
  }

  const pickupCell = getOptionalString(formData, "cuttingPickupCell");

  if (transition.requiresPickupCell && !pickupCell) {
    redirect(
      productionActionReturn(formData, requestId, "pickup-cell-required"),
    );
  }

  const result = await applyRequestCuttingProgress({
    requestId,
    stage: transition.to,
    pickupCell,
    note: getOptionalString(formData, "cuttingStageNote"),
    internalNote: true,
    expectedStage: request.cuttingStage,
    actor,
  });

  redirect(
    productionActionReturn(
      formData,
      requestId,
      result === "updated" ? "stage-updated" : "stage-conflict",
    ),
  );
}

export async function setProductionStageAction(formData: FormData) {
  const requestId = getString(formData, "requestId");
  const stageValue = getString(formData, "cuttingStage");
  const stage = Object.values(CuttingStage).find((item) => item === stageValue);

  if (!requestId || !stage) {
    redirect("/admin/production?notice=request-missing");
  }

  const actor = await ensureProductionAdminAccess(requestId);

  if (!canManageProduction(actor.roleCode)) {
    redirect(productionActionReturn(formData, requestId, "action-forbidden"));
  }

  const result = await applyRequestCuttingProgress({
    requestId,
    stage,
    pickupCell: getOptionalString(formData, "cuttingPickupCell"),
    note: getOptionalString(formData, "cuttingStageNote"),
    ...getExpectedStageFromForm(formData),
    actor,
  });

  if (result === "conflict") {
    redirect(productionActionReturn(formData, requestId, "stage-conflict"));
  }

  redirect(
    productionActionReturn(
      formData,
      requestId,
      result === "updated" ? "stage-updated" : "request-missing",
    ),
  );
}

// «Выдано»: готовый заказ отдан клиенту, заявка закрывается.
export async function markCuttingRequestIssuedAction(formData: FormData) {
  const requestId = getString(formData, "requestId");

  if (!requestId) {
    redirect("/admin/production?notice=request-missing");
  }

  const actor = await ensureProductionAdminAccess(requestId);

  if (!canManageProduction(actor.roleCode)) {
    redirect(productionActionReturn(formData, requestId, "action-forbidden"));
  }

  const previousRequest = await getRequestInboxItemById(requestId);

  if (
    !previousRequest ||
    previousRequest.cuttingStage !== CuttingStage.READY_FOR_PICKUP ||
    previousRequest.status === RequestStatus.COMPLETED ||
    previousRequest.status === RequestStatus.CANCELED
  ) {
    redirect(productionActionReturn(formData, requestId, "action-forbidden"));
  }

  await updateRequestInboxItem({
    id: requestId,
    status: RequestStatus.COMPLETED,
    managerId: previousRequest.managerId,
  });

  await logOperationEvent({
    entityType: "request",
    entityId: requestId,
    eventType: "status",
    title: "Заказ выдан клиенту",
    description: previousRequest.cuttingPickupCell
      ? `Выдан из ячейки ${previousRequest.cuttingPickupCell}.`
      : "Готовый заказ передан клиенту.",
    fromStatus: previousRequest.status,
    toStatus: RequestStatus.COMPLETED,
    isVisibleToClient: true,
    actor,
  });

  await syncRequestById(requestId, {
    previousStatus: previousRequest.status,
    previousManager: previousRequest.manager,
  });

  // Распил оплачивается через заказ: после выдачи оплаченный заказ
  // закрывается сам. Неоплаченный остаётся открытым.
  const linkedOrders = await getOrdersForRequest(requestId);

  for (const order of linkedOrders) {
    if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.IN_PRODUCTION ||
      order.status === OrderStatus.READY_FOR_PICKUP ||
      order.status === OrderStatus.SHIPPED
    ) {
      await applyOrderStatusChange({
        id: order.id,
        nextStatus: OrderStatus.COMPLETED,
        actor,
      });
    }
  }

  revalidateAdminOperations();
  redirect(productionActionReturn(formData, requestId, "issued"));
}

export async function uploadRequestResultFilesAction(formData: FormData) {
  const requestId = getString(formData, "requestId");
  const files = getFileList(formData, "files");

  if (!requestId || files.length === 0) {
    return;
  }

  const actor = await ensureRequestAdminAccess(requestId);

  const savedFilesCount = await addRequestResultFiles({
    requestId,
    files,
    note: getOptionalString(formData, "note"),
    isVisibleToClient: getString(formData, "isVisibleToClient") === "on",
    actor,
  });

  if (savedFilesCount > 0) {
    const isVisibleToClient = getString(formData, "isVisibleToClient") === "on";

    await logOperationEvent({
      entityType: "request",
      entityId: requestId,
      eventType: "result_files",
      title: `Добавлены файлы результата: ${savedFilesCount}`,
      description:
        getOptionalString(formData, "note") ??
        "К заявке прикреплены файлы карты раскроя, ведомости или экспорта Giblab.",
      isVisibleToClient,
      actor,
    });
  }

  revalidateAdminOperations();
}

export async function bulkUpdateRequestsAction(formData: FormData) {
  const actor = await ensureAdminAccess();

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
    requestIds.map(async (requestId) => {
      const currentRequest = await getRequestInboxItemById(requestId);
      const previous = previousRequestMap.get(requestId);

      await logRequestTransition({
        requestId,
        previous: previous
          ? {
              status: previous.previousStatus as RequestStatus,
              manager: previous.previousManager ?? null,
            }
          : null,
        current: currentRequest
          ? {
              status: currentRequest.status,
              manager: currentRequest.manager,
            }
          : null,
        actor,
      });

      await syncRequestById(requestId, previous);
    }),
  );

  revalidateAdminOperations();
}

export async function createSalesFloorOrderAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const actor = await ensureAdminAccess();
  const customerId = getString(formData, "customerId");
  const productIds = formData
    .getAll("productId")
    .map((value) => (typeof value === "string" ? value.trim() : ""));
  const quantities = formData.getAll("quantity");
  const invoicePrices = formData.getAll("itemUnitPrice");
  const invoiceReference = getOptionalString(
    formData,
    "invoiceReference",
  )?.slice(0, 500);
  const receiptNumber = getOptionalString(formData, "receiptNumber");
  const managerComment = getOptionalString(formData, "comment");
  const accrueLoyalty = getString(formData, "accrueLoyalty") === "on";
  const requestedRedeemPoints = getOptionalInt(formData, "redeemPoints") ?? 0;

  if (!customerId || productIds.length === 0) {
    redirect("/admin/sales-floor?error=empty");
  }

  let requestedItems: ReturnType<typeof parseSalesItemInputs>;
  try {
    requestedItems = parseSalesItemInputs(
      productIds,
      quantities,
      invoicePrices,
    );
  } catch {
    redirect("/admin/sales-floor?error=invoice-values");
  }

  if (requestedItems.length === 0) {
    redirect("/admin/sales-floor?error=empty");
  }

  const db = getDb();

  // Повторная отправка той же формы открывает уже созданную продажу.
  const submissionId = getString(formData, "submissionId");
  const submissionKey = /^[A-Za-z0-9-]{16,64}$/.test(submissionId)
    ? `sales-floor:submission:${submissionId}`
    : null;

  if (submissionKey) {
    const saved = await db.siteSetting.findUnique({
      where: { key: submissionKey },
    });

    if (saved) {
      const savedOrderId =
        saved.value && typeof saved.value === "object"
          ? (saved.value as { orderId?: unknown }).orderId
          : null;

      redirect(
        typeof savedOrderId === "string"
          ? `/admin/orders/${savedOrderId}`
          : "/admin/orders",
      );
    }
  }

  await ensureProductBundleItemsTable(db);
  const uniqueProductIds = [
    ...new Set(requestedItems.map((item) => item.productId)),
  ];
  const [customer, products] = await Promise.all([
    db.user.findFirst({
      where: {
        id: customerId,
        isActive: true,
        role: {
          code: {
            in: [RoleCode.CUSTOMER, RoleCode.DEALER],
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        loyaltyTier: true,
        plateMaterialLoyaltyTier: true,
        fittingsLoyaltyTier: true,
        loyaltyPointsBalance: true,
        loyaltyPointsLifetime: true,
        personalDiscountPercent: true,
      },
    }),
    db.product.findMany({
      where: {
        id: { in: uniqueProductIds },
        status: ProductStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        promotions: {
          select: { promotion: { select: PROMOTION_PRICE_SELECT } },
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
        brand: { select: { name: true } },
        category: {
          select: {
            kind: true,
            promotions: {
              select: { promotion: { select: PROMOTION_PRICE_SELECT } },
            },
          },
        },
      },
    }),
  ]);

  if (!customer || products.length === 0) {
    redirect("/admin/sales-floor?error=not-found");
  }

  const loyaltyConfig = await getLoyaltyProgramConfig();
  const productMap = new Map(products.map((product) => [product.id, product]));
  const discountPercent = getEffectiveDiscountPercent(customer);
  const orderItems = requestedItems.flatMap((requestedItem) => {
    const product = productMap.get(requestedItem.productId);
    const unitPrice =
      requestedItem.invoicePrice ??
      (product ? (getEffectiveProductPrice(product) ?? 0) : null);

    if (!product || typeof unitPrice !== "number") {
      return [];
    }

    const lineSubtotal = unitPrice * requestedItem.quantity;
    const promotionPrice = getProductPromotionPrice(
      unitPrice,
      product.promotions,
      product.category.promotions,
    );
    // Invoice prices are the agreed final unit prices, not catalog prices to discount again.
    const promotionDiscountAmount =
      requestedItem.invoicePrice !== null
        ? 0
        : promotionPrice.unitDiscountAmount * requestedItem.quantity;
    const personalDiscountAmount =
      requestedItem.invoicePrice !== null
        ? 0
        : Math.round(
            ((lineSubtotal - promotionDiscountAmount) * discountPercent) / 100,
          );
    const discountAmount = promotionDiscountAmount + personalDiscountAmount;
    const total = Math.max(0, lineSubtotal - discountAmount);

    return [
      {
        productId: product.id,
        quantity: requestedItem.quantity,
        unitPrice,
        discountAmount,
        total,
        snapshotName: product.name,
        snapshotSku: product.sku,
        snapshotBrand: product.brand?.name ?? null,
        categoryKind: product.category.kind,
      },
    ];
  });

  if (orderItems.length !== requestedItems.length) {
    redirect("/admin/sales-floor?error=not-found");
  }

  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  if (!Number.isSafeInteger(subtotal) || subtotal > MAX_SALE_AMOUNT)
    redirect("/admin/sales-floor?error=invoice-values");
  const discountTotal = orderItems.reduce(
    (sum, item) => sum + item.discountAmount,
    0,
  );
  const subtotalAfterDiscount = Math.max(0, subtotal - discountTotal);
  const loyaltyRedemptionTotal = getRedeemableLoyaltyPoints(
    requestedRedeemPoints,
    customer.loyaltyPointsBalance,
    subtotalAfterDiscount,
    loyaltyConfig,
  );
  const total = Math.max(0, subtotalAfterDiscount - loyaltyRedemptionTotal);
  const accrualRatio =
    subtotalAfterDiscount > 0
      ? (subtotalAfterDiscount - loyaltyRedemptionTotal) / subtotalAfterDiscount
      : 0;
  const awardedPoints = accrueLoyalty
    ? estimateLoyaltyPointsForLines(
        orderItems.map((item) => ({
          total: item.total * accrualRatio,
          categoryKind: item.categoryKind,
        })),
        customer,
        loyaltyConfig,
      )
    : 0;
  const customerName =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.companyName ||
    customer.email;
  const commentParts = [
    "Продажа в зале",
    invoiceReference ? `Накладная: ${invoiceReference}` : "",
    receiptNumber ? `Кассовый чек: ${receiptNumber}` : "",
    loyaltyRedemptionTotal > 0
      ? `Списано бонусов: ${loyaltyRedemptionTotal}`
      : "",
    awardedPoints > 0 ? `Начислено бонусов: ${awardedPoints}` : "",
    managerComment,
  ].filter(Boolean);
  let orderNumber = buildAdminOrderNumber("H");

  // Номер уникален в базе: при совпадении берём другой.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await db.order.findUnique({
      where: { number: orderNumber },
      select: { id: true },
    });

    if (!taken) break;
    orderNumber = buildAdminOrderNumber("H");
  }

  const soldAt = new Date();

  let createdOrder: {
    id: string;
    number: string | null;
    createdAt: Date;
  };

  try {
    createdOrder = await db.$transaction(async (tx) => {
      await reserveInventoryItems(
        tx,
        orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          name: item.snapshotName,
        })),
      );

      const order = await tx.order.create({
        data: {
          number: orderNumber,
          userId: customer.id,
          managerId: actor.userId,
          // Продажа в зале сразу оплачена и выдана.
          status: OrderStatus.COMPLETED,
          readyAt: soldAt,
          completedAt: soldAt,
          inventoryReservedAt: soldAt,
          contactName: customerName,
          contactPhone: customer.phone ?? "",
          contactEmail: isTechnicalClientEmail(customer.email)
            ? null
            : customer.email,
          companyName: customer.companyName,
          comment: commentParts.join("\n"),
          subtotal,
          discountTotal,
          loyaltyRedemptionTotal,
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
          createdAt: true,
        },
      });

      if (submissionKey) {
        await tx.siteSetting.create({
          data: { key: submissionKey, value: { orderId: order.id } },
        });
      }

      if (awardedPoints > 0 || loyaltyRedemptionTotal > 0) {
        if (loyaltyRedemptionTotal > 0) {
          await applyApprovedLoyaltyDelta(tx, {
            userId: customer.id,
            orderId: order.id,
            type: LoyaltyTransactionType.REDEMPTION,
            approvedById: actor.userId,
            points: -loyaltyRedemptionTotal,
            requireSufficientBalance: true,
            title: "Списание баллов",
            description: `Списание бонусов по продаже ${order.number ?? order.id}.`,
          });
        }

        if (awardedPoints > 0) {
          await applyApprovedLoyaltyDelta(tx, {
            userId: customer.id,
            orderId: order.id,
            type: LoyaltyTransactionType.ORDER_ACCRUAL,
            approvedById: actor.userId,
            points: awardedPoints,
            title: "Бонусы за покупку в зале",
            description: `Начисление по продаже ${order.number ?? order.id}.`,
          });
        }
      }

      return order;
    });
  } catch (error) {
    if (error instanceof InventoryAvailabilityError) {
      redirect(
        `/admin/sales-floor?${new URLSearchParams({
          error: "stock",
          detail: error.message,
        })}`,
      );
    }

    if (error instanceof InsufficientLoyaltyBalanceError) {
      redirect("/admin/sales-floor?error=loyalty");
    }

    // Та же продажа сохранилась параллельным запросом.
    if (
      submissionKey &&
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      redirect("/admin/orders");
    }

    throw error;
  }

  await logOperationEvent({
    entityType: "order",
    entityId: createdOrder.id,
    eventType: "status",
    title: "Продажа в зале: оплачено и выдано",
    description: "Менеджер собрал продажу на планшете и привязал ее к клиенту.",
    toStatus: OrderStatus.COMPLETED,
    isVisibleToClient: true,
    actor,
  });

  await handleOrderCreated({
    id: createdOrder.id,
    userId: customer.id,
    number: createdOrder.number,
    status: OrderStatus.COMPLETED,
    contactName: customerName,
    contactPhone: customer.phone ?? "",
    contactEmail: isTechnicalClientEmail(customer.email)
      ? null
      : customer.email,
    companyName: customer.companyName,
    comment: commentParts.join("\n"),
    total,
    subtotal,
    discountTotal,
    deliveryTotal: 0,
    loyaltyPointsDelta: awardedPoints,
    createdAt: createdOrder.createdAt.toISOString(),
    manager: {
      firstName: actor.firstName,
      lastName: actor.lastName,
      email: actor.email,
    },
    items: orderItems.map((item) => ({
      name: item.snapshotName,
      sku: item.snapshotSku,
      brand: item.snapshotBrand,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
  });

  revalidateAdminOperations();
  revalidateAdminUsers();
  redirect(`/admin/orders/${createdOrder.id}`);
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

  // Скидка больше 100% сделала бы цену отрицательной.
  if (discountType === DiscountType.PERCENT && discountValue > 100) {
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
      endsAt: getOptionalEndDate(formData, "endsAt"),
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
  const mode = getString(formData, "mode");

  if (!id) {
    return;
  }

  const normalizedStatus =
    Object.values(PromotionStatus).find((item) => item === status) ??
    PromotionStatus.DRAFT;

  if (mode !== "full") {
    await getDb().promotion.update({
      where: { id },
      data: {
        status: normalizedStatus,
        promoCode:
          getOptionalString(formData, "promoCode")?.toUpperCase() ?? null,
        badgeText: getOptionalString(formData, "badgeText"),
        isHighlighted: getString(formData, "isHighlighted") === "on",
      },
    });

    revalidateAdminPromotions();
    return;
  }

  const name = getString(formData, "name");
  const slug = getString(formData, "slug");
  const targetType = getString(formData, "targetType");
  const discountType = getString(formData, "discountType");
  const discountValue = getOptionalInt(formData, "discountValue");

  if (!name || !slug || !discountValue) {
    return;
  }

  // Скидка больше 100% сделала бы цену отрицательной.
  if (discountType === DiscountType.PERCENT && discountValue > 100) {
    return;
  }

  const normalizedTargetType =
    Object.values(PromotionTargetType).find((item) => item === targetType) ??
    PromotionTargetType.ORDER;
  const selectedProductId = getOptionalString(formData, "productId");
  const selectedCategoryId = getOptionalString(formData, "categoryId");
  const db = getDb();

  await db.$transaction(async (tx) => {
    await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
    await tx.promotionCategory.deleteMany({ where: { promotionId: id } });

    await tx.promotion.update({
      where: { id },
      data: {
        name,
        slug,
        description: getOptionalString(formData, "description"),
        status: normalizedStatus,
        targetType: normalizedTargetType,
        discountType:
          Object.values(DiscountType).find((item) => item === discountType) ??
          DiscountType.PERCENT,
        discountValue,
        promoCode:
          getOptionalString(formData, "promoCode")?.toUpperCase() ?? null,
        minOrderTotal: getOptionalInt(formData, "minOrderTotal"),
        usageLimit: getOptionalInt(formData, "usageLimit"),
        badgeText: getOptionalString(formData, "badgeText"),
        isHighlighted: getString(formData, "isHighlighted") === "on",
        startsAt: getOptionalDate(formData, "startsAt"),
        endsAt: getOptionalEndDate(formData, "endsAt"),
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
  });

  revalidateAdminPromotions();
  revalidatePath(`/admin/promotions/${id}`);
}

export async function sendPromotionTelegramBroadcastAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const searchParams = new URLSearchParams();

  if (!id) {
    searchParams.set("telegramPromo", "error");
    searchParams.set("telegramMessage", "Акция не выбрана.");
  } else {
    try {
      const [telegramDelivery, pushDelivery] = await Promise.allSettled([
        sendTelegramPromotionBroadcast(id),
        sendPushPromotionBroadcast(id),
      ]);
      const telegramResult =
        telegramDelivery.status === "fulfilled"
          ? telegramDelivery.value
          : {
              ok: false,
              sent: 0,
              failed: 1,
              skipped: 0,
              message:
                telegramDelivery.reason instanceof Error
                  ? telegramDelivery.reason.message
                  : "Telegram вернул неизвестную ошибку.",
            };
      const pushResult =
        pushDelivery.status === "fulfilled"
          ? pushDelivery.value
          : {
              ok: false,
              sent: 0,
              failed: 1,
              skipped: 0,
              message:
                pushDelivery.reason instanceof Error
                  ? pushDelivery.reason.message
                  : "Android push вернул неизвестную ошибку.",
            };
      const totalSent = telegramResult.sent + pushResult.sent;
      const totalFailed = telegramResult.failed + pushResult.failed;

      searchParams.set(
        "telegramPromo",
        totalFailed === 0 ? "ok" : totalSent > 0 ? "partial" : "error",
      );
      searchParams.set(
        "telegramMessage",
        `Telegram: ${telegramResult.message} Android: ${pushResult.message}`,
      );
      searchParams.set("telegramSent", String(totalSent));
      searchParams.set("telegramFailed", String(totalFailed));
    } catch (error) {
      searchParams.set("telegramPromo", "error");
      searchParams.set(
        "telegramMessage",
        error instanceof Error
          ? error.message
          : "Telegram вернул неизвестную ошибку.",
      );
    }
  }

  revalidateAdminPromotions();
  redirect(`/admin/promotions?${searchParams.toString()}`);
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

export async function createSitePageAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const title = getString(formData, "title");
  const slug = getString(formData, "slug") || slugifyImportValue(title);

  if (!title || !slug) {
    return;
  }

  const status = getString(formData, "status");

  await getDb().sitePage.create({
    data: {
      title,
      slug,
      excerpt: getOptionalString(formData, "excerpt"),
      body: getOptionalString(formData, "body"),
      status:
        Object.values(PageStatus).find((item) => item === status) ??
        PageStatus.DRAFT,
      seoTitle: getOptionalString(formData, "seoTitle"),
      seoDescription: getOptionalString(formData, "seoDescription"),
    },
  });

  revalidateAdminContent();
}

export async function updateSitePageAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const title = getString(formData, "title");
  const slug = getString(formData, "slug") || slugifyImportValue(title);
  const status = getString(formData, "status");

  if (!id || !title || !slug) {
    return;
  }

  await getDb().sitePage.update({
    where: { id },
    data: {
      title,
      slug,
      excerpt: getOptionalString(formData, "excerpt"),
      body: getOptionalString(formData, "body"),
      status:
        Object.values(PageStatus).find((item) => item === status) ??
        PageStatus.DRAFT,
      seoTitle: getOptionalString(formData, "seoTitle"),
      seoDescription: getOptionalString(formData, "seoDescription"),
    },
  });

  revalidateAdminContent();
}

export async function deleteSitePageAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await getDb().sitePage.delete({ where: { id } });

  revalidateAdminContent();
}

export async function createBannerAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const title = getString(formData, "title");
  const key = getString(formData, "key") || slugifyImportValue(title);
  const placement = getString(formData, "placement");

  if (!title || !key) {
    return;
  }

  await getDb().banner.create({
    data: {
      key,
      title,
      placement:
        Object.values(BannerPlacement).find((item) => item === placement) ??
        BannerPlacement.HOME_SECONDARY,
      subtitle: getOptionalString(formData, "subtitle"),
      ctaLabel: getOptionalString(formData, "ctaLabel"),
      ctaHref: getOptionalString(formData, "ctaHref"),
      imageUrl: getOptionalUrl(formData, "imageUrl"),
      isActive: getString(formData, "isActive") === "on",
      sortOrder: getOptionalInt(formData, "sortOrder") ?? 100,
      startsAt: getOptionalDate(formData, "startsAt"),
      endsAt: getOptionalEndDate(formData, "endsAt"),
    },
  });

  revalidateAdminContent();
}

export async function updateBannerAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const title = getString(formData, "title");
  const key = getString(formData, "key") || slugifyImportValue(title);
  const placement = getString(formData, "placement");

  if (!id || !title || !key) {
    return;
  }

  await getDb().banner.update({
    where: { id },
    data: {
      key,
      title,
      placement:
        Object.values(BannerPlacement).find((item) => item === placement) ??
        BannerPlacement.HOME_SECONDARY,
      subtitle: getOptionalString(formData, "subtitle"),
      ctaLabel: getOptionalString(formData, "ctaLabel"),
      ctaHref: getOptionalString(formData, "ctaHref"),
      imageUrl: getOptionalUrl(formData, "imageUrl"),
      isActive: getString(formData, "isActive") === "on",
      sortOrder: getOptionalInt(formData, "sortOrder") ?? 100,
      startsAt: getOptionalDate(formData, "startsAt"),
      endsAt: getOptionalEndDate(formData, "endsAt"),
    },
  });

  revalidateAdminContent();
}

export async function deleteBannerAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await getDb().banner.delete({ where: { id } });

  revalidateAdminContent();
}

// Менеджер заводит клиента у прилавка по имени и телефону. Если клиент с
// таким номером уже есть, новый не создаётся, открывается существующий.
export async function createClientByManagerAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const fromSalesFloor = getString(formData, "returnTo") === "sales-floor";
  const back = (params: Record<string, string>) =>
    `${fromSalesFloor ? "/admin/sales-floor" : "/admin/users"}?${new URLSearchParams(params)}`;
  const firstName = getString(formData, "firstName").slice(0, 80);
  const lastName = getOptionalString(formData, "lastName")?.slice(0, 80);
  const companyName = getOptionalString(formData, "companyName")?.slice(0, 120);
  const phone = normalizeClientPhone(getString(formData, "phone"));

  if (!firstName || !phone) {
    redirect(back({ clientNotice: "invalid" }));
  }

  const db = getDb();
  const clients = await db.user.findMany({
    where: {
      phone: { not: null },
      role: { code: { in: [RoleCode.CUSTOMER, RoleCode.DEALER] } },
    },
    select: { id: true, phone: true },
  });
  const existing = clients.find(
    (client) => normalizeClientPhone(client.phone) === phone,
  );

  if (existing) {
    redirect(
      fromSalesFloor
        ? back({ clientNotice: "exists", client: `+${phone}` })
        : `/admin/users/${existing.id}?notice=exists`,
    );
  }

  const definition = roleDefinitions[RoleCode.CUSTOMER];
  const role = await db.role.upsert({
    where: { code: RoleCode.CUSTOMER },
    update: {},
    create: {
      code: RoleCode.CUSTOMER,
      name: definition.label,
      description: definition.description,
    },
  });
  const email = buildTechnicalClientEmail(phone);
  const taken = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (taken) {
    redirect(
      fromSalesFloor
        ? back({ clientNotice: "exists", client: `+${phone}` })
        : `/admin/users/${taken.id}?notice=exists`,
    );
  }

  const created = await db.user.create({
    data: {
      email,
      firstName,
      lastName: lastName ?? null,
      phone: `+${phone}`,
      companyName: companyName ?? null,
      roleId: role.id,
      isActive: true,
    },
    select: { id: true },
  });

  revalidateAdminUsers();
  revalidatePath("/admin/sales-floor");
  redirect(
    fromSalesFloor
      ? back({ clientNotice: "created", client: `+${phone}` })
      : `/admin/users/${created.id}?notice=created`,
  );
}

// Контакты клиента в его карточке. Настоящая почта открывает вход в кабинет.
export async function updateClientContactsAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const back = (notice: string) => `/admin/users/${id}?notice=${notice}`;
  const db = getDb();
  const client = await db.user.findFirst({
    where: {
      id,
      role: { code: { in: [RoleCode.CUSTOMER, RoleCode.DEALER] } },
    },
    select: { id: true, email: true, hashedPassword: true },
  });

  if (!client) {
    return;
  }

  const firstName = getString(formData, "firstName").slice(0, 80);
  const rawPhone = getString(formData, "phone");
  const phone = normalizeClientPhone(rawPhone);
  const emailInput = getString(formData, "email").toLowerCase();

  if (!firstName || (rawPhone && !phone)) {
    redirect(back("contacts-invalid"));
  }

  if (emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
    redirect(back("contacts-invalid"));
  }

  // Менеджер вписывает почту только клиенту, заведённому без неё: смена
  // настоящей почты открыла бы чужой кабинет через «Забыли пароль».
  const emailChanges = Boolean(emailInput) && emailInput !== client.email;

  if (emailChanges && !isTechnicalClientEmail(client.email)) {
    redirect(back("contacts-invalid"));
  }

  if (emailInput && isTechnicalClientEmail(emailInput)) {
    redirect(back("contacts-invalid"));
  }

  if (emailChanges) {
    const emailOwner = await db.user.findUnique({
      where: { email: emailInput },
      select: { id: true },
    });

    if (emailOwner) {
      redirect(back("email-taken"));
    }
  }

  await db.user.update({
    where: { id },
    data: {
      firstName,
      lastName: getOptionalString(formData, "lastName")?.slice(0, 80) ?? null,
      companyName:
        getOptionalString(formData, "companyName")?.slice(0, 120) ?? null,
      ...(phone ? { phone: `+${phone}` } : {}),
      ...(emailChanges ? { email: emailInput } : {}),
      // Восстановление пароля работает только для аккаунта с паролем:
      // ставим случайный, клиент задаёт свой через «Забыли пароль?».
      ...(emailChanges && !client.hashedPassword
        ? {
            hashedPassword: await (
              await import("bcryptjs")
            ).hash(randomBytes(24).toString("base64url"), 10),
          }
        : {}),
    },
  });

  revalidateAdminUsers();
  redirect(back("contacts-saved"));
}

export async function setLoyaltyManagerAccessAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureStaffAdminAccess();

  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await setLoyaltyManagerAccess(id, getString(formData, "allowed") === "1");
  revalidatePath("/admin/staff");
  revalidatePath("/admin/users");
}

export async function updateLoyaltyProgramSettingsAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureLoyaltyManageAccess();

  const currentConfig = await getLoyaltyProgramConfig();
  await saveLoyaltyProgramConfig({
    maxTotalDiscountPercent: 0,
    maxRedeemPercent: 50,
    tiers: Object.fromEntries(
      Object.values(LoyaltyTier).map((tier) => {
        const currentTier = currentConfig.tiers[tier];
        const legacyThreshold = getOptionalInt(formData, `${tier}.threshold`);
        const plateMaterialThreshold =
          getOptionalInt(formData, `${tier}.plateMaterialThreshold`) ??
          legacyThreshold ??
          currentTier.plateMaterialThreshold;
        const fittingsThreshold =
          getOptionalInt(formData, `${tier}.fittingsThreshold`) ??
          legacyThreshold ??
          currentTier.fittingsThreshold;
        const plateMaterialAccrualPercent =
          getOptionalInt(formData, `${tier}.plateMaterialAccrualPercent`) ??
          getOptionalInt(formData, `${tier}.accrualPercent`) ??
          currentTier.plateMaterialAccrualPercent;
        const fittingsAccrualPercent =
          getOptionalInt(formData, `${tier}.fittingsAccrualPercent`) ??
          currentTier.fittingsAccrualPercent;

        return [
          tier,
          {
            label:
              getOptionalString(formData, `${tier}.label`) ?? currentTier.label,
            threshold: Math.min(plateMaterialThreshold, fittingsThreshold),
            plateMaterialThreshold,
            fittingsThreshold,
            baseDiscountPercent: 0,
            accrualPercent: plateMaterialAccrualPercent,
            plateMaterialAccrualPercent,
            fittingsAccrualPercent,
          },
        ];
      }),
    ) as Record<
      LoyaltyTier,
      {
        label: string;
        threshold: number;
        plateMaterialThreshold: number;
        fittingsThreshold: number;
        baseDiscountPercent: number;
        accrualPercent: number;
        plateMaterialAccrualPercent: number;
        fittingsAccrualPercent: number;
      }
    >,
  });

  const review = await runMonthlyLoyaltyReview({
    force: true,
    notify: true,
  });

  revalidateAdminUsers();
  revalidatePath("/checkout");

  const searchParams = new URLSearchParams({
    review: review.ok ? "complete" : "error",
    changed: String(review.changed),
    reviewed: String(review.reviewed),
    saved: "1",
  });
  redirect(`/admin/loyalty?${searchParams.toString()}`);
}

export async function recalculateLoyaltyStatusesAction() {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureLoyaltyManageAccess();

  const review = await runMonthlyLoyaltyReview({
    force: true,
    notify: true,
  });

  revalidateAdminUsers();
  revalidatePath("/checkout");

  const searchParams = new URLSearchParams({
    review: review.ok ? "complete" : "error",
    changed: String(review.changed),
    reviewed: String(review.reviewed),
  });
  redirect(`/admin/loyalty?${searchParams.toString()}`);
}

export async function updateUserLoyaltyAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureLoyaltyManageAccess();

  const id = getString(formData, "id");
  const loyaltyTier = getString(formData, "loyaltyTier");
  const plateMaterialLoyaltyTier = getString(
    formData,
    "plateMaterialLoyaltyTier",
  );
  const fittingsLoyaltyTier = getString(formData, "fittingsLoyaltyTier");
  const personalDiscountPercent = Math.max(
    0,
    getOptionalInt(formData, "personalDiscountPercent") ?? 0,
  );

  if (!id) {
    return;
  }

  const selectedLegacyTier =
    Object.values(LoyaltyTier).find((item) => item === loyaltyTier) ??
    LoyaltyTier.BRONZE;
  const selectedPlateMaterialTier =
    Object.values(LoyaltyTier).find(
      (item) => item === plateMaterialLoyaltyTier,
    ) ?? selectedLegacyTier;
  const selectedFittingsTier =
    Object.values(LoyaltyTier).find((item) => item === fittingsLoyaltyTier) ??
    selectedLegacyTier;

  await getDb().user.update({
    where: { id },
    data: {
      loyaltyTier: getHighestLoyaltyTier([
        selectedPlateMaterialTier,
        selectedFittingsTier,
      ]),
      plateMaterialLoyaltyTier: selectedPlateMaterialTier,
      fittingsLoyaltyTier: selectedFittingsTier,
      personalDiscountPercent: clampPersonalDiscountPercent(
        personalDiscountPercent,
      ),
    },
  });

  revalidateAdminUsers();
}

export async function deleteClientAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const session = await ensureLoyaltyManageAccess();
  const id = getString(formData, "id");

  if (!id || id === session.userId) {
    return;
  }

  const client = await getDb().user.findUnique({
    where: { id },
    select: {
      id: true,
      role: {
        select: {
          code: true,
        },
      },
    },
  });

  const clientRoleCodes = new Set<RoleCode>([
    RoleCode.CUSTOMER,
    RoleCode.DEALER,
  ]);

  if (!client || !clientRoleCodes.has(client.role.code)) {
    return;
  }

  await getDb().user.delete({
    where: { id: client.id },
  });

  revalidateAdminUsers();
}

export async function sendUserTelegramNoticeAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const id = getString(formData, "id");
  const returnQuery = getOptionalString(formData, "returnQuery");
  const title =
    getOptionalString(formData, "telegramTitle")?.slice(0, 80) ??
    "Сообщение от Artisan";
  const body = getString(formData, "telegramMessage").slice(0, 3000);
  const searchParams = new URLSearchParams();

  if (returnQuery) {
    searchParams.set("q", returnQuery);
  }

  if (!id || !body) {
    searchParams.set("telegramNotice", "error");
    searchParams.set(
      "telegramMessage",
      "Выберите клиента и напишите текст сообщения.",
    );
    redirect(`/admin/users?${searchParams.toString()}`);
  }

  try {
    const sent = await sendTelegramDirectMessage(id, {
      title,
      category: "manual",
      lines: body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      actions: [
        {
          text: "Открыть кабинет",
          url: "/account",
        },
      ],
    });

    searchParams.set("telegramNotice", sent ? "ok" : "warning");
    searchParams.set(
      "telegramMessage",
      sent
        ? "Сообщение отправлено клиенту в Telegram."
        : "Сообщение не отправлено: у клиента не подключен Telegram или бот не настроен.",
    );
  } catch (error) {
    console.error("[telegram:admin:user-notice]", error);
    searchParams.set("telegramNotice", "error");
    searchParams.set(
      "telegramMessage",
      error instanceof Error
        ? error.message
        : "Telegram вернул неизвестную ошибку.",
    );
  }

  revalidateAdminUsers();
  redirect(`/admin/users?${searchParams.toString()}`);
}

export async function adjustUserLoyaltyPointsAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const session = await ensureLoyaltyManageAccess();

  const id = getString(formData, "id");
  const pointsDelta = getOptionalInt(formData, "pointsDelta");

  if (!id || pointsDelta === null || pointsDelta === 0) {
    return;
  }

  const title = getOptionalString(formData, "title") ?? "Ручная корректировка";
  const description = getOptionalString(formData, "description");
  const db = getDb();
  await ensureLoyaltyAuditSchema(db);
  let adjustment: Awaited<ReturnType<typeof applyApprovedLoyaltyDelta>>;

  try {
    adjustment = await db.$transaction((tx) =>
      applyApprovedLoyaltyDelta(tx, {
        userId: id,
        type: LoyaltyTransactionType.MANUAL_ADJUSTMENT,
        approvedById: session.userId,
        points: pointsDelta,
        title,
        description,
        requireSufficientBalance: pointsDelta < 0,
        recordBalanceBefore: true,
      }),
    );
  } catch (error) {
    if (
      error instanceof InsufficientLoyaltyBalanceError ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025")
    ) {
      return;
    }

    throw error;
  }

  const appliedDelta = adjustment.points;
  const nextBalance = adjustment.balanceAfter;

  try {
    await sendClientDirectMessage(id, {
      title:
        appliedDelta > 0
          ? "Баллы начислены менеджером"
          : "Баллы скорректированы менеджером",
      category: "loyalty",
      lines: [
        `Изменение: ${appliedDelta > 0 ? "+" : ""}${appliedDelta}`,
        `Баланс: ${nextBalance} баллов`,
        description ? `Комментарий: ${description}` : "",
      ].filter(Boolean),
      actions: [
        {
          text: "Открыть бонусы",
          url: "/account",
        },
      ],
    });
  } catch (error) {
    console.error("[telegram:loyalty]", error);
  }

  revalidateAdminUsers();
}

const loyaltyAuditReturnKeys = [
  "q",
  "manager",
  "dateFrom",
  "dateTo",
  "page",
] as const;

function getLoyaltyAuditRedirect(returnQuery: string | null, notice: string) {
  const source = new URLSearchParams(returnQuery?.slice(0, 1000) ?? "");
  const target = new URLSearchParams();

  loyaltyAuditReturnKeys.forEach((key) => {
    const value = source.get(key)?.trim();

    if (value) {
      target.set(key, value.slice(0, 160));
    }
  });

  target.set("auditNotice", notice);
  return `/admin/loyalty?${target.toString()}#loyalty-audit`;
}

function getLoyaltyRollbackNotice(result: RollbackLoyaltyResult) {
  if (result.ok) {
    return "rollback-complete";
  }

  const notices = {
    missing: "rollback-missing",
    "not-approved": "rollback-not-approved",
    "already-reversed": "rollback-already-complete",
    "reversal-operation": "rollback-is-reversal",
    "insufficient-balance": "rollback-insufficient-balance",
  } as const;

  return notices[result.reason];
}

export async function rollbackLoyaltyTransactionAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const session = await ensureStaffAdminAccess();
  const transactionId = getString(formData, "transactionId");
  const confirmation = getString(formData, "confirmRollback");
  const returnQuery = getOptionalString(formData, "returnQuery");

  if (!transactionId || confirmation !== "ROLLBACK") {
    redirect(getLoyaltyAuditRedirect(returnQuery, "rollback-invalid"));
  }

  let result: RollbackLoyaltyResult;

  try {
    result = await rollbackManualLoyaltyTransaction({
      transactionId,
      actorId: session.userId,
    });
  } catch (error) {
    console.error("[loyalty:audit:rollback]", error);
    redirect(getLoyaltyAuditRedirect(returnQuery, "rollback-error"));
  }

  if (result.ok) {
    try {
      await sendClientDirectMessage(result.userId, {
        title: "Корректировка бонусов",
        category: "loyalty",
        lines: [
          `Изменение: ${result.points > 0 ? "+" : ""}${result.points}`,
          `Баланс: ${result.nextBalance} баллов`,
          "Предыдущая ручная операция отменена администратором.",
        ],
        actions: [{ text: "Открыть бонусы", url: "/account" }],
      });
    } catch (error) {
      console.error("[loyalty:audit:rollback-notification]", error);
    }

    revalidateAdminUsers();
  }

  redirect(
    getLoyaltyAuditRedirect(returnQuery, getLoyaltyRollbackNotice(result)),
  );
}

export async function approveLoyaltyTransactionAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const session = await ensureAdminAccess();
  const transactionId = getString(formData, "transactionId");

  if (!transactionId) {
    return;
  }

  const db = getDb();
  const result = await db.$transaction(async (tx) => {
    const transaction = await tx.loyaltyTransaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        userId: true,
        status: true,
        points: true,
        user: {
          select: {
            loyaltyPointsBalance: true,
            loyaltyPointsLifetime: true,
          },
        },
      },
    });

    if (
      !transaction ||
      transaction.status !== LoyaltyTransactionStatus.PENDING ||
      transaction.points <= 0
    ) {
      return null;
    }

    const nextBalance =
      transaction.user.loyaltyPointsBalance + transaction.points;
    const nextLifetime =
      transaction.user.loyaltyPointsLifetime + transaction.points;

    await tx.user.update({
      where: { id: transaction.userId },
      data: {
        loyaltyPointsBalance: nextBalance,
        loyaltyPointsLifetime: nextLifetime,
      },
    });

    await tx.loyaltyTransaction.update({
      where: { id: transaction.id },
      data: {
        status: LoyaltyTransactionStatus.APPROVED,
        balanceAfter: nextBalance,
        approvedAt: new Date(),
        approvedById: session.userId,
      },
    });

    return {
      userId: transaction.userId,
      points: transaction.points,
      nextBalance,
    };
  });

  if (result) {
    try {
      await sendClientDirectMessage(result.userId, {
        title: "Бонусы подтверждены",
        category: "loyalty",
        lines: [
          `Начислено: +${result.points}`,
          `Баланс: ${result.nextBalance} баллов`,
        ],
        actions: [{ text: "Открыть бонусы", url: "/account" }],
      });
    } catch (error) {
      console.error("[telegram:loyalty:approve]", error);
    }

    revalidateAdminUsers();
  }
}

export async function cancelLoyaltyTransactionAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  const session = await ensureAdminAccess();
  const transactionId = getString(formData, "transactionId");

  if (!transactionId) {
    return;
  }

  const transaction = await getDb().loyaltyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      userId: true,
      status: true,
      points: true,
    },
  });

  if (!transaction || transaction.status !== LoyaltyTransactionStatus.PENDING) {
    return;
  }

  await getDb().loyaltyTransaction.update({
    where: { id: transactionId },
    data: {
      status: LoyaltyTransactionStatus.CANCELED,
      canceledAt: new Date(),
      canceledById: session.userId,
    },
  });

  try {
    await sendClientDirectMessage(transaction.userId, {
      title: "Бонусы отменены",
      category: "loyalty",
      lines: [`Операция на ${transaction.points} баллов отменена.`],
      actions: [{ text: "Открыть бонусы", url: "/account" }],
    });
  } catch (error) {
    console.error("[telegram:loyalty:cancel]", error);
  }

  revalidateAdminUsers();
}

export async function createCalculatorMaterialAction(formData: FormData) {
  if (!hasDatabaseUrl()) return;
  await ensureAdminAccess();

  const slug = getString(formData, "slug");
  const label = getString(formData, "label");
  const pricePerSqM = getRequiredInt(formData, "pricePerSqM");
  const cutRatePerMeter = getRequiredInt(formData, "cutRatePerMeter");

  if (!slug || !label || pricePerSqM === null || cutRatePerMeter === null) {
    return;
  }

  await getDb().calculatorMaterial.create({
    data: {
      slug,
      label,
      pricePerSqM,
      cutRatePerMeter,
      edgeRatePerMeter: getRequiredInt(formData, "edgeRatePerMeter") ?? 0,
      setupFee: getRequiredInt(formData, "setupFee") ?? 0,
      thicknessMm: getOptionalInt(formData, "thicknessMm"),
      sortOrder: getRequiredInt(formData, "sortOrder") ?? 0,
    },
  });

  revalidateCalculatorConfig();
}

export async function updateCalculatorMaterialAction(formData: FormData) {
  if (!hasDatabaseUrl()) return;
  await ensureAdminAccess();

  const id = getString(formData, "id");
  if (!id) return;

  const data: Record<string, unknown> = {};
  const label = getString(formData, "label");
  if (label) data.label = label;
  const pricePerSqM = getRequiredInt(formData, "pricePerSqM");
  if (pricePerSqM !== null) data.pricePerSqM = pricePerSqM;
  const cutRatePerMeter = getRequiredInt(formData, "cutRatePerMeter");
  if (cutRatePerMeter !== null) data.cutRatePerMeter = cutRatePerMeter;
  const edgeRatePerMeter = getRequiredInt(formData, "edgeRatePerMeter");
  if (edgeRatePerMeter !== null) data.edgeRatePerMeter = edgeRatePerMeter;
  const setupFee = getRequiredInt(formData, "setupFee");
  if (setupFee !== null) data.setupFee = setupFee;
  const thicknessMm = getOptionalInt(formData, "thicknessMm");
  data.thicknessMm = thicknessMm;
  const sortOrder = getRequiredInt(formData, "sortOrder");
  if (sortOrder !== null) data.sortOrder = sortOrder;
  data.isActive = formData.get("isActive") === "on";

  await getDb().calculatorMaterial.update({ where: { id }, data });
  revalidateCalculatorConfig();
}

export async function deleteCalculatorMaterialAction(formData: FormData) {
  if (!hasDatabaseUrl()) return;
  await ensureAdminAccess();

  const id = getString(formData, "id");
  if (!id) return;

  await getDb().calculatorMaterial.delete({ where: { id } });
  revalidateCalculatorConfig();
}

export async function createCalculatorSheetFormatAction(formData: FormData) {
  if (!hasDatabaseUrl()) return;
  await ensureAdminAccess();

  const slug = getString(formData, "slug");
  const label = getString(formData, "label");
  const widthMm = getRequiredInt(formData, "widthMm");
  const heightMm = getRequiredInt(formData, "heightMm");

  if (!slug || !label || widthMm === null || heightMm === null) {
    return;
  }

  await getDb().calculatorSheetFormat.create({
    data: {
      slug,
      label,
      widthMm,
      heightMm,
      sortOrder: getRequiredInt(formData, "sortOrder") ?? 0,
    },
  });

  revalidateCalculatorConfig();
}

export async function updateCalculatorSheetFormatAction(formData: FormData) {
  if (!hasDatabaseUrl()) return;
  await ensureAdminAccess();

  const id = getString(formData, "id");
  if (!id) return;

  const data: Record<string, unknown> = {};
  const label = getString(formData, "label");
  if (label) data.label = label;
  const widthMm = getRequiredInt(formData, "widthMm");
  if (widthMm !== null) data.widthMm = widthMm;
  const heightMm = getRequiredInt(formData, "heightMm");
  if (heightMm !== null) data.heightMm = heightMm;
  const sortOrder = getRequiredInt(formData, "sortOrder");
  if (sortOrder !== null) data.sortOrder = sortOrder;
  data.isActive = formData.get("isActive") === "on";

  await getDb().calculatorSheetFormat.update({ where: { id }, data });
  revalidateCalculatorConfig();
}

export async function deleteCalculatorSheetFormatAction(formData: FormData) {
  if (!hasDatabaseUrl()) return;
  await ensureAdminAccess();

  const id = getString(formData, "id");
  if (!id) return;

  await getDb().calculatorSheetFormat.delete({ where: { id } });
  revalidateCalculatorConfig();
}

export type CuttingManagerAccountFormState = {
  status?: "success" | "error";
  message?: string;
};

export async function createCuttingManagerAccountAction(
  _previousState: CuttingManagerAccountFormState,
  formData: FormData,
): Promise<CuttingManagerAccountFormState> {
  await ensureStaffAdminAccess();

  if (!hasDatabaseUrl()) {
    return {
      status: "error",
      message: "Подключите базу данных для создания сотрудника.",
    };
  }

  const firstName = getString(formData, "firstName");
  const lastName = getOptionalString(formData, "lastName");
  const phone = getOptionalString(formData, "phone");
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");

  if (firstName.length < 2) {
    return { status: "error", message: "Укажите имя сотрудника." };
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { status: "error", message: "Проверьте email для входа." };
  }

  if (password.length < 8 || password.length > 128) {
    return {
      status: "error",
      message: "Пароль должен содержать от 8 до 128 символов.",
    };
  }

  const db = getDb();
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return {
      status: "error",
      message: "Пользователь с таким email уже существует.",
    };
  }

  const role = await db.role.upsert({
    where: { code: RoleCode.CUTTING_MANAGER },
    update: {
      name: "Менеджер кроя",
      description:
        "Сотрудник производства с доступом только к очереди и заявкам на распил.",
    },
    create: {
      code: RoleCode.CUTTING_MANAGER,
      name: "Менеджер кроя",
      description:
        "Сотрудник производства с доступом только к очереди и заявкам на распил.",
    },
  });
  const { hash } = await import("bcryptjs");

  await db.user.create({
    data: {
      email,
      hashedPassword: await hash(password, 10),
      firstName,
      lastName,
      phone,
      companyName: "Artisan",
      roleId: role.id,
      isActive: true,
    },
  });

  revalidatePath("/admin/staff");

  return {
    status: "success",
    message: `Доступ для ${firstName} создан.`,
  };
}

export type ProductionAccountFormState = {
  status?: "success" | "error";
  message?: string;
};

export async function createProductionAccountAction(
  _previousState: ProductionAccountFormState,
  formData: FormData,
): Promise<ProductionAccountFormState> {
  await ensureStaffAdminAccess();

  if (!hasDatabaseUrl()) {
    return {
      status: "error",
      message: "Подключите базу данных для создания сотрудника.",
    };
  }

  const firstName = getString(formData, "firstName");
  const lastName = getOptionalString(formData, "lastName");
  const phone = getOptionalString(formData, "phone");
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const accessType = getString(formData, "accessType");
  const stationByAccessType: Record<string, ProductionStation> = {
    cutting: ProductionStation.CUTTING,
    edging: ProductionStation.EDGING,
    drilling: ProductionStation.DRILLING,
  };
  const productionStation = stationByAccessType[accessType] ?? null;
  const roleCode =
    accessType === "manager"
      ? RoleCode.PRODUCTION_MANAGER
      : productionStation
        ? RoleCode.PRODUCTION_OPERATOR
        : null;

  if (firstName.length < 2) {
    return { status: "error", message: "Укажите название или имя аккаунта." };
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { status: "error", message: "Проверьте email для входа." };
  }

  if (password.length < 8 || password.length > 128) {
    return {
      status: "error",
      message: "Пароль должен содержать от 8 до 128 символов.",
    };
  }

  if (!roleCode) {
    return { status: "error", message: "Выберите производственный доступ." };
  }

  const db = getDb();
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return {
      status: "error",
      message: "Пользователь с таким email уже существует.",
    };
  }

  const definition = roleDefinitions[roleCode];
  const role = await db.role.upsert({
    where: { code: roleCode },
    update: { name: definition.label, description: definition.description },
    create: {
      code: roleCode,
      name: definition.label,
      description: definition.description,
    },
  });
  const { hash } = await import("bcryptjs");

  await db.user.create({
    data: {
      email,
      hashedPassword: await hash(password, 10),
      firstName,
      lastName,
      phone,
      companyName: "Artisan",
      roleId: role.id,
      productionStation,
      isActive: true,
    },
  });

  revalidatePath("/admin/staff");

  return {
    status: "success",
    message: `Производственный доступ для ${firstName} создан.`,
  };
}

export async function updateStaffAccountRoleAction(formData: FormData) {
  const session = await ensureStaffAdminAccess();

  if (!hasDatabaseUrl()) {
    return;
  }

  const id = getString(formData, "id");
  const requestedRole = getString(formData, "roleCode") as RoleCode;
  const stationValue = getString(formData, "productionStation");
  const requestedStation = Object.values(ProductionStation).find(
    (station) => station === stationValue,
  );

  if (!id || !Object.values(RoleCode).includes(requestedRole)) {
    redirect("/admin/staff?notice=invalid-role");
  }

  if (id === session.userId) {
    redirect("/admin/staff?notice=self-role");
  }

  const db = getDb();
  const account = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      isActive: true,
      productionStation: true,
      role: { select: { code: true } },
    },
  });

  if (!account) {
    redirect("/admin/staff?notice=account-missing");
  }

  const isSuperAdmin = session.roleCode === RoleCode.SUPER_ADMIN;
  const privilegedRoles = new Set<RoleCode>([
    RoleCode.ADMIN,
    RoleCode.SUPER_ADMIN,
  ]);

  if (
    !isSuperAdmin &&
    (privilegedRoles.has(account.role.code) ||
      privilegedRoles.has(requestedRole))
  ) {
    redirect("/admin/staff?notice=role-forbidden");
  }

  if (
    account.role.code === RoleCode.SUPER_ADMIN &&
    requestedRole !== RoleCode.SUPER_ADMIN &&
    account.isActive
  ) {
    const activeSuperAdmins = await db.user.count({
      where: {
        isActive: true,
        role: { code: RoleCode.SUPER_ADMIN },
      },
    });

    if (activeSuperAdmins <= 1) {
      redirect("/admin/staff?notice=last-super-admin");
    }
  }

  if (requestedRole === RoleCode.PRODUCTION_OPERATOR && !requestedStation) {
    redirect("/admin/staff?notice=invalid-station");
  }

  const nextStation =
    requestedRole === RoleCode.PRODUCTION_OPERATOR
      ? (requestedStation ?? null)
      : null;

  if (
    account.role.code === requestedRole &&
    account.productionStation === nextStation
  ) {
    redirect("/admin/staff?notice=role-unchanged");
  }

  const definition = roleDefinitions[requestedRole];
  const role = await db.role.upsert({
    where: { code: requestedRole },
    update: {
      name: definition.label,
      description: definition.description,
    },
    create: {
      code: requestedRole,
      name: definition.label,
      description: definition.description,
    },
  });

  await db.user.update({
    where: { id: account.id },
    data: { roleId: role.id, productionStation: nextStation },
  });

  revalidatePath("/admin/staff");
  revalidatePath("/admin/users");
  redirect("/admin/staff?notice=role-updated");
}

export async function toggleCuttingManagerAccessAction(formData: FormData) {
  return setStaffAccountAccessAction(formData);
}

export async function resetCuttingManagerPasswordAction(formData: FormData) {
  await ensureStaffAdminAccess();

  if (!hasDatabaseUrl()) {
    return;
  }

  const id = getString(formData, "id");
  const password = getString(formData, "password");

  if (!id || password.length < 8 || password.length > 128) {
    redirect("/admin/staff?notice=invalid-password");
  }

  const manager = await getDb().user.findFirst({
    where: {
      id,
      role: {
        code: {
          in: [
            RoleCode.CUTTING_MANAGER,
            RoleCode.PRODUCTION_MANAGER,
            RoleCode.PRODUCTION_OPERATOR,
          ],
        },
      },
    },
    select: { id: true },
  });

  if (!manager) {
    return;
  }

  const { hash } = await import("bcryptjs");

  await getDb().user.update({
    where: { id },
    data: { hashedPassword: await hash(password, 10) },
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff?notice=password-updated");
}
