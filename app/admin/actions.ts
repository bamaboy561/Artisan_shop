"use server";

import {
  CategoryKind,
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
  type Prisma,
} from "@/generated/prisma";
import {
  parseProductImportFile,
  slugifyImportValue,
} from "@/features/admin/product-import";
import {
  BUNDLE_ITEM_ATTRIBUTE_NAME,
  BUNDLE_MARKER_ATTRIBUTE_NAME,
  BUNDLE_MARKER_ATTRIBUTE_VALUE,
  isBundleAttributeName,
  parseBundleItemsText,
} from "@/features/catalog/bundles";
import {
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
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl, getDb } from "@/lib/db";
import { ensureBrandLogoColumn } from "@/lib/server/brand-schema";
import { logOperationEvent } from "@/lib/server/operation-events";
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
  getRequestInbox,
  getRequestDetailById,
  getRequestInboxItemById,
  updateRequestInboxItem,
} from "@/lib/server/request-inbox";
import {
  addRequestManagerNote,
  addRequestResultFiles,
  updateRequestProductionResult,
} from "@/lib/server/request-production";
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

function safeSkuBase(value: string) {
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
) {
  const base = safeSkuBase(value);
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

function getProductAttributesFromForm(formData: FormData) {
  const baseAttributes = parseProductAttributes(
    getString(formData, "attributes"),
  ).filter((attribute) => !isBundleAttributeName(attribute.name));
  const bundleItems = parseBundleItemsText(getString(formData, "bundleItems"));
  const isBundleProduct =
    getString(formData, "isBundleProduct") === "on" ||
    bundleItems.length > 0;
  const attributes = [...baseAttributes];

  if (isBundleProduct) {
    attributes.push({
      name: BUNDLE_MARKER_ATTRIBUTE_NAME,
      value: BUNDLE_MARKER_ATTRIBUTE_VALUE,
      sortOrder: 0,
    });

    bundleItems.forEach((item) => {
      attributes.push({
        name: BUNDLE_ITEM_ATTRIBUTE_NAME,
        value: item,
        sortOrder: 0,
      });
    });
  }

  return attributes.map((attribute, index) => ({
    ...attribute,
    sortOrder: (index + 1) * 10,
  }));
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

const PRODUCT_IMAGE_MAX_SIZE = 8 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function sanitizeUploadSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function isAllowedProductImage(file: File) {
  return (
    PRODUCT_IMAGE_TYPES.has(file.type) && file.size <= PRODUCT_IMAGE_MAX_SIZE
  );
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

async function resolveProductImageUrl(formData: FormData, productSlug: string) {
  const uploadedImage = getFileList(formData, "imageFile")[0];

  if (uploadedImage) {
    const blobUrl = await uploadProductImageFile(uploadedImage, productSlug);

    if (blobUrl) {
      return blobUrl;
    }
  }

  return getOptionalString(formData, "imageUrl");
}

const PRODUCT_IMPORT_MAX_FILE_SIZE = 10 * 1024 * 1024;

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
    normalized.includes("кром")
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
      searchParams.set(`import${key[0].toUpperCase()}${key.slice(1)}`, String(value));
    }
  });

  return `/admin/products?${searchParams.toString()}`;
}

function getInventoryStatusFromStock(
  stockQuantity: number | null,
  zeroMissingAsOut: boolean,
) {
  if (stockQuantity === null) {
    return null;
  }

  if (stockQuantity <= 0) {
    return zeroMissingAsOut ? InventoryStatus.OUT_OF_STOCK : null;
  }

  return stockQuantity <= 5
    ? InventoryStatus.LIMITED
    : InventoryStatus.IN_STOCK;
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
  revalidatePath("/account/orders");
  revalidatePath("/account/requests");
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
  return requireAdminSession("/login?next=/admin");
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
  const slug = await getUniqueCategorySlug(db, getString(formData, "slug") || name);
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
        getOptionalInt(formData, "sortOrder") ?? (await getNextCategorySortOrder(db)),
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
  const slug = getString(formData, "slug");

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
  const slug = getString(formData, "slug");

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
  const attributes = getProductAttributesFromForm(formData);
  const brandId = getOptionalString(formData, "brandId");
  const db = getDb();
  const [category, brand] = await Promise.all([
    db.category.findUnique({ where: { id: categoryId }, select: { name: true } }),
    brandId
      ? db.brand.findUnique({ where: { id: brandId }, select: { name: true } })
      : null,
  ]);

  if (!category) {
    return;
  }

  const identity = [brand?.name, category.name, name].filter(Boolean).join(" ");
  const slug = await getUniqueProductSlug(
    db,
    getString(formData, "slug") || identity || name,
  );
  const sku = await getUniqueProductSku(
    db,
    getString(formData, "sku") || identity || name,
  );
  const imageUrl = await resolveProductImageUrl(formData, slug);

  await db.product.create({
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
      images: imageUrl
        ? {
            create: [
              {
                url: imageUrl,
                alt: name,
                sortOrder: 10,
              },
            ],
          }
        : undefined,
      attributes:
        attributes.length > 0
          ? {
              create: attributes,
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
  const attributes = getProductAttributesFromForm(formData);
  const brandId = getOptionalString(formData, "brandId");

  const db = getDb();
  const [previousProduct, category, brand] = await Promise.all([
    db.product.findUnique({
      where: { id },
      select: { slug: true, sku: true },
    }),
    db.category.findUnique({ where: { id: categoryId }, select: { name: true } }),
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
  const sku = await getUniqueProductSku(
    db,
    getString(formData, "sku") || identity || name,
    id,
  );
  const imageUrl = await resolveProductImageUrl(formData, slug);

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
        format: getOptionalString(formData, "format"),
        thicknessMm: getOptionalInt(formData, "thicknessMm"),
        calculatorMaterialId: getOptionalString(
          formData,
          "calculatorMaterialId",
        ),
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
      },
    });

    if (imageUrl) {
      const existing = await tx.productImage.findFirst({
        where: { productId: id },
        orderBy: { sortOrder: "asc" },
      });
      if (existing) {
        await tx.productImage.update({
          where: { id: existing.id },
          data: { url: imageUrl, alt: name },
        });
      } else {
        await tx.productImage.create({
          data: { productId: id, url: imageUrl, alt: name, sortOrder: 10 },
        });
      }
    } else {
      await tx.productImage.deleteMany({ where: { productId: id } });
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
  });

  revalidateAdminCatalog();
  revalidatePath(`/admin/products/${id}`);
  if (previousProduct?.slug && previousProduct.slug !== slug) {
    revalidatePath(`/product/${previousProduct.slug}`);
  }
  revalidatePath(`/product/${slug}`);
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
        message: "Файл больше 10 МБ",
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
      select: { id: true, sku: true, slug: true },
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
  const productBySku = new Map(existingProducts.map((item) => [item.sku, item]));
  const usedProductSlugs = new Set(existingProducts.map((item) => item.slug));
  const usedCategorySlugs = new Set(categories.map((item) => item.slug));
  const usedBrandSlugs = new Set(brands.map((item) => item.slug));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of parsed.rows) {
    try {
      if (!row.name || !row.sku) {
        skipped += 1;
        continue;
      }

      const existingProduct = productBySku.get(row.sku);

      if (existingProduct && !updateExisting) {
        skipped += 1;
        continue;
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
        skipped += 1;
        continue;
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
      const attributeCreates = row.attributes.map((attribute, index) => ({
        name: attribute.name,
        value: attribute.value,
        sortOrder: (index + 1) * 10,
      }));

      if (existingProduct) {
        const updateData: Prisma.ProductUpdateInput = {
          name: row.name,
          orderMode: row.orderMode ?? defaultOrderMode,
          inventoryStatus: row.inventoryStatus ?? defaultInventoryStatus,
        };

        if (moveUpdatedToDraft) {
          updateData.status = ProductStatus.DRAFT;
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
          updateData.stockQuantity = row.stockQuantity;
        }
        if (row.format) updateData.format = row.format;
        if (row.thicknessMm !== null) updateData.thicknessMm = row.thicknessMm;
        if (row.summary) updateData.summary = row.summary;
        if (row.description) updateData.description = row.description;
        if (defaultCalculatorMaterialId) {
          updateData.calculatorMaterialId = defaultCalculatorMaterialId;
        }
        if (defaultCalculatorSheetPresetId) {
          updateData.calculatorSheetPresetId = defaultCalculatorSheetPresetId;
        }
        if (imageUrl) {
          updateData.images = {
            deleteMany: {},
            create: [{ url: imageUrl, alt: row.name, sortOrder: 10 }],
          };
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
        updated += 1;
        continue;
      }

      const productSlug = makeUniqueImportSlug(
        row.slug ?? `${row.brandName ?? ""} ${row.name} ${row.sku}`,
        usedProductSlugs,
      );
      const createData: Prisma.ProductCreateInput = {
        name: row.name,
        slug: productSlug,
        sku: row.sku,
        category: { connect: { id: categoryId as string } },
        brand: brandId ? { connect: { id: brandId } } : undefined,
        price: row.price,
        compareAtPrice: row.compareAtPrice,
        stockQuantity: row.stockQuantity,
        format: row.format,
        thicknessMm: row.thicknessMm,
        summary: row.summary,
        description: row.description,
        status: ProductStatus.DRAFT,
        orderMode: row.orderMode ?? defaultOrderMode,
        inventoryStatus: row.inventoryStatus ?? defaultInventoryStatus,
        calculatorMaterialId: defaultCalculatorMaterialId,
        calculatorSheetPresetId: defaultCalculatorSheetPresetId,
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
      productBySku.set(product.sku, product);
      created += 1;
    } catch {
      errors += 1;
    }
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
    }),
  );
}

export async function updateProductStockFromExcelAction(formData: FormData) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureAdminAccess();

  const file = getFileList(formData, "stockFile")[0];

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
        message: "Файл больше 10 МБ",
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
        message: "В файле не найдено строк для обновления",
        warnings: parsed.warnings.length,
      }),
    );
  }

  const updatePrice = getString(formData, "updatePrice") === "on";
  const updateStock = getString(formData, "updateStock") === "on";
  const updateAvailability = getString(formData, "updateAvailability") === "on";
  const zeroMissingAsOut = getString(formData, "zeroMissingAsOut") === "on";

  if (!updatePrice && !updateStock && !updateAvailability) {
    redirect(
      getProductImportRedirect({
        message: "Выберите хотя бы одно поле для обновления",
        warnings: parsed.warnings.length,
      }),
    );
  }

  const db = getDb();
  const existingProducts = await db.product.findMany({
    select: { id: true, sku: true },
  });
  const productBySku = new Map(
    existingProducts.map((product) => [
      product.sku.trim().toLocaleLowerCase("ru-RU"),
      product,
    ]),
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of parsed.rows) {
    try {
      const skuKey = row.sku.trim().toLocaleLowerCase("ru-RU");
      const product = productBySku.get(skuKey);

      if (!skuKey || !product) {
        skipped += 1;
        continue;
      }

      const updateData: Prisma.ProductUpdateInput = {};

      if (updatePrice && row.price !== null) {
        updateData.price = row.price;
      }

      if (updatePrice && row.compareAtPrice !== null) {
        updateData.compareAtPrice = row.compareAtPrice;
      }

      if (updateStock && row.stockQuantity !== null) {
        updateData.stockQuantity = row.stockQuantity;
      }

      if (updateAvailability) {
        const nextInventoryStatus =
          row.inventoryStatus ??
          getInventoryStatusFromStock(row.stockQuantity, zeroMissingAsOut);

        if (nextInventoryStatus) {
          updateData.inventoryStatus = nextInventoryStatus;
        }
      }

      if (Object.keys(updateData).length === 0) {
        skipped += 1;
        continue;
      }

      await db.product.update({
        where: { id: product.id },
        data: updateData,
      });
      updated += 1;
    } catch {
      errors += 1;
    }
  }

  revalidateAdminCatalog();
  redirect(
    getProductImportRedirect({
      message: "Цены и остатки обновлены",
      updated,
      skipped,
      errors,
      warnings: parsed.warnings.length,
      mapped: parsed.mappedColumns.length,
    }),
  );
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
  const actor = await ensureAdminAccess();

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

  const currentOrder = await getOrderInboxItemById(id);

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

  revalidateAdminOperations();
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

  await updateOrderFulfillment({
    orderId,
    productionDueAt: getOptionalDate(formData, "productionDueAt"),
    fulfillmentComment: getOptionalString(formData, "fulfillmentComment"),
    status: nextStatus,
  });

  const currentOrder = await getOrderInboxItemById(orderId);

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
    orderIds.map(async (orderId) => {
      const currentOrder = await getOrderInboxItemById(orderId);
      const previous = previousOrderMap.get(orderId);

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

  await updateRequestInboxItem({
    id: requestId,
    status: RequestStatus.COMPLETED,
    managerId: request.managerId ?? null,
  });

  await Promise.all([
    logOperationEvent({
      entityType: "request",
      entityId: requestId,
      eventType: "converted",
      title: `Создан заказ ${createdOrder.number ?? createdOrder.id}`,
      description: "Заявка переведена в заказ для дальнейшей работы.",
      fromStatus: request.status,
      toStatus: RequestStatus.COMPLETED,
      isVisibleToClient: true,
      actor,
    }),
    logOperationEvent({
      entityType: "order",
      entityId: createdOrder.id,
      eventType: "created",
      title: `Заказ создан из заявки ${request.number ?? request.id}`,
      description: "Контакты, материал, комментарии и файлы перенесены из заявки.",
      toStatus: OrderStatus.NEW,
      isVisibleToClient: true,
      actor,
    }),
  ]);

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
  const actor = await ensureAdminAccess();

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

export async function addRequestManagerNoteAction(formData: FormData) {
  const actor = await ensureAdminAccess();

  const requestId = getString(formData, "requestId");
  const body = getString(formData, "body");
  const isVisibleToClient = getString(formData, "isVisibleToClient") === "on";

  if (!requestId || !body) {
    return;
  }

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
  const actor = await ensureAdminAccess();

  const requestId = getString(formData, "requestId");
  const status = getString(formData, "status");

  if (!requestId) {
    return;
  }

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

export async function uploadRequestResultFilesAction(formData: FormData) {
  const actor = await ensureAdminAccess();

  const requestId = getString(formData, "requestId");
  const files = getFileList(formData, "files");

  if (!requestId || files.length === 0) {
    return;
  }

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
