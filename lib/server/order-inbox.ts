import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { OrderStatus } from "@/generated/prisma";
import type { AdminOrderItem } from "@/features/admin/operations-filters";
import { getDemoAdminSession } from "@/lib/auth/demo-access";
import { getDb, hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import type { RequestDetailItem } from "@/lib/server/request-inbox";

type DemoOrderLine = {
  name: string;
  sku?: string | null;
  brand?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

type DemoManager = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
} | null;

type DemoOrderRecord = Omit<AdminOrderItem, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  subtotal: number;
  discountTotal: number;
  deliveryTotal: number;
  productionDueAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  fulfillmentComment: string | null;
  comment: string | null;
  sourceRequestId: string | null;
  contactEmail: string | null;
  items: DemoOrderLine[];
  managerNotes?: OrderManagerNoteRecord[];
};

export type OrderManagerNoteRecord = {
  id: string;
  body: string;
  isVisibleToClient: boolean;
  authorId?: string | null;
  authorName?: string | null;
  createdAt: string;
};

export type OrderDetailItem = AdminOrderItem & {
  subtotal: number;
  discountTotal: number;
  deliveryTotal: number;
  productionDueAt: Date | string | null;
  readyAt: Date | string | null;
  completedAt: Date | string | null;
  fulfillmentComment: string | null;
  comment: string | null;
  sourceRequestId: string | null;
  contactEmail: string | null;
  items: DemoOrderLine[];
  managerNotes?: OrderManagerNoteRecord[];
};

const runtimeDirectory = path.join(process.cwd(), ".artisan-runtime");
const demoOrdersPath = path.join(runtimeDirectory, "orders.json");

async function ensureRuntimeDirectory() {
  await mkdir(runtimeDirectory, { recursive: true });
}

function buildOrderNumber() {
  const datePart = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `A-${datePart}-${randomPart}`;
}

function resolveDemoManager(managerId?: string | null): DemoManager {
  if (!managerId) {
    return null;
  }

  const demoAdmin = getDemoAdminSession();

  return managerId === demoAdmin.userId
    ? {
        id: demoAdmin.userId,
        firstName: demoAdmin.firstName ?? null,
        lastName: demoAdmin.lastName ?? null,
        email: demoAdmin.email,
      }
    : null;
}

function createDemoOrderRecord(
  record: Partial<DemoOrderRecord> & {
    id: string;
    number: string | null;
    contactName: string;
    contactPhone: string;
  },
): DemoOrderRecord {
  const timestamp = new Date().toISOString();
  const items = record.items ?? [];

  return {
    id: record.id,
    number: record.number,
    status: record.status ?? OrderStatus.NEW,
    contactName: record.contactName,
    contactPhone: record.contactPhone,
    contactEmail: record.contactEmail ?? null,
    companyName: record.companyName ?? null,
    deliveryMethodId: record.deliveryMethodId ?? null,
    appliedPromoCode: record.appliedPromoCode ?? null,
    loyaltyRedemptionTotal: record.loyaltyRedemptionTotal ?? 0,
    total: record.total ?? 0,
    subtotal: record.subtotal ?? record.total ?? 0,
    discountTotal: record.discountTotal ?? 0,
    deliveryTotal: record.deliveryTotal ?? 0,
    productionDueAt: record.productionDueAt ?? null,
    readyAt: record.readyAt ?? null,
    completedAt: record.completedAt ?? null,
    fulfillmentComment: record.fulfillmentComment ?? null,
    createdAt: record.createdAt ?? timestamp,
    updatedAt: record.updatedAt ?? timestamp,
    managerId: record.managerId ?? null,
    user: record.user ?? null,
    manager: record.manager ?? null,
    deliveryMethod: record.deliveryMethod ?? null,
    _count: {
      items: items.length,
    },
    comment: record.comment ?? null,
    sourceRequestId: record.sourceRequestId ?? null,
    items,
    managerNotes: record.managerNotes ?? [],
  };
}

async function readDemoOrders() {
  await ensureRuntimeDirectory();

  try {
    const content = await readFile(demoOrdersPath, "utf8");
    return (JSON.parse(content) as DemoOrderRecord[]).map((order) =>
      createDemoOrderRecord(order),
    );
  } catch {
    return [];
  }
}

async function writeDemoOrders(orders: DemoOrderRecord[]) {
  await ensureRuntimeDirectory();
  await writeFile(demoOrdersPath, JSON.stringify(orders, null, 2), "utf8");
}

function toAdminOrderItem(record: DemoOrderRecord): AdminOrderItem {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toOrderDetailItem(record: DemoOrderRecord): OrderDetailItem {
  return {
    ...toAdminOrderItem(record),
    subtotal: record.subtotal,
    discountTotal: record.discountTotal,
    deliveryTotal: record.deliveryTotal,
    productionDueAt: record.productionDueAt,
    readyAt: record.readyAt,
    completedAt: record.completedAt,
    fulfillmentComment: record.fulfillmentComment,
    comment: record.comment,
    sourceRequestId: record.sourceRequestId,
    contactEmail: record.contactEmail,
    items: record.items,
    managerNotes: record.managerNotes ?? [],
  };
}

function buildOrderCommentFromRequest(request: RequestDetailItem) {
  const parts = [
    `Источник: заявка ${request.number ?? request.id}`,
    request.material ? `Материал: ${request.material}` : "",
    request.edgeOption ? `Кромка: ${request.edgeOption}` : "",
    request.addressText ? `Адрес: ${request.addressText}` : "",
    request.message ? request.message : "",
    request.files.length > 0
      ? `Файлы:\n${request.files
          .map((file) => `${file.fileName} — ${file.fileUrl}`)
          .join("\n")}`
      : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

function buildOrderLineFromRequest(request: RequestDetailItem): DemoOrderLine {
  return {
    name: request.product?.name ?? request.subject,
    sku: request.product?.sku ?? request.number ?? null,
    brand: request.material ?? null,
    quantity: 1,
    unitPrice: request.estimatedBudget ?? 0,
    total: request.estimatedBudget ?? 0,
  };
}

export async function getOrderInbox() {
  if (hasDatabaseUrl()) {
    return getDb().order.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            email: true,
          },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        deliveryMethod: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
  }

  if (!isDemoModeEnabled()) {
    return [];
  }

  return (await readDemoOrders())
    .map(toAdminOrderItem)
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

export async function getOrderInboxItemById(id: string): Promise<OrderDetailItem | null> {
  if (hasDatabaseUrl()) {
    const order = await getDb().order.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        sourceRequestId: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        companyName: true,
        comment: true,
        total: true,
        subtotal: true,
        discountTotal: true,
        deliveryTotal: true,
        productionDueAt: true,
        readyAt: true,
        completedAt: true,
        fulfillmentComment: true,
        createdAt: true,
        updatedAt: true,
        appliedPromoCode: true,
        loyaltyRedemptionTotal: true,
        managerId: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        user: {
          select: {
            companyName: true,
          },
        },
        deliveryMethodId: true,
        deliveryMethod: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            snapshotName: true,
            snapshotSku: true,
            snapshotBrand: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
        managerNotes: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            body: true,
            isVisibleToClient: true,
            authorId: true,
            authorName: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return {
      ...order,
      managerNotes: order.managerNotes.map((note) => ({
        ...note,
        createdAt: note.createdAt.toISOString(),
      })),
      items: order.items.map((item) => ({
        name: item.snapshotName,
        sku: item.snapshotSku,
        brand: item.snapshotBrand,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    };
  }

  if (!isDemoModeEnabled()) {
    return null;
  }

  const order = (await readDemoOrders()).find((item) => item.id === id);
  return order ? toOrderDetailItem(order) : null;
}

export async function getOrdersForRequest(requestId: string) {
  if (hasDatabaseUrl()) {
    return getDb().order.findMany({
      where: { sourceRequestId: requestId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        number: true,
        status: true,
      },
    });
  }

  if (!isDemoModeEnabled()) {
    return [];
  }

  return (await readDemoOrders())
    .filter((order) => order.sourceRequestId === requestId)
    .map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
    }));
}

export async function createOrderFromRequest(request: RequestDetailItem) {
  const orderNumber = buildOrderNumber();
  const orderComment = buildOrderCommentFromRequest(request);
  const orderLine = buildOrderLineFromRequest(request);

  if (hasDatabaseUrl()) {
    const db = getDb();

    return db.order.create({
      data: {
        number: orderNumber,
        sourceRequestId: request.id,
        userId: request.userId ?? null,
        managerId: request.managerId ?? null,
        status: OrderStatus.NEW,
        contactName: request.contactName,
        contactPhone: request.contactPhone,
        contactEmail: request.contactEmail,
        companyName: null,
        comment: orderComment,
        subtotal: orderLine.total,
        total: orderLine.total,
        items: {
          create: [
            {
              productId: null,
              quantity: orderLine.quantity,
              unitPrice: orderLine.unitPrice,
              discountAmount: 0,
              total: orderLine.total,
              snapshotName: orderLine.name,
              snapshotSku: orderLine.sku ?? null,
              snapshotBrand: orderLine.brand ?? null,
            },
          ],
        },
      },
      select: {
        id: true,
        number: true,
      },
    });
  }

  const orders = await readDemoOrders();
  const created = createDemoOrderRecord({
    id: `demo-order-${Date.now()}`,
    number: orderNumber,
    status: OrderStatus.NEW,
    sourceRequestId: request.id,
    contactName: request.contactName,
    contactPhone: request.contactPhone,
    contactEmail: request.contactEmail,
    managerId: request.managerId ?? null,
    manager: (request.manager as DemoManager) ?? null,
    companyName: null,
    total: orderLine.total,
    subtotal: orderLine.total,
    discountTotal: 0,
    deliveryTotal: 0,
    productionDueAt: null,
    readyAt: null,
    completedAt: null,
    fulfillmentComment: null,
    comment: orderComment,
    items: [orderLine],
  });

  await writeDemoOrders([created, ...orders]);

  return {
    id: created.id,
    number: created.number,
  };
}

export async function updateOrderInboxItem(input: {
  id: string;
  status: OrderStatus;
  managerId?: string | null;
}) {
  const timestampFields =
    input.status === OrderStatus.READY_FOR_PICKUP
      ? { readyAt: new Date() }
      : input.status === OrderStatus.COMPLETED
        ? { completedAt: new Date() }
        : {};

  if (hasDatabaseUrl()) {
    await getDb().order.update({
      where: { id: input.id },
      data: {
        status: input.status,
        managerId: input.managerId ?? null,
        ...timestampFields,
      },
    });

    return;
  }

  if (!isDemoModeEnabled()) {
    return;
  }

  const orders = await readDemoOrders();
  const updated = orders.map((order) =>
    order.id === input.id
      ? {
          ...order,
          status: input.status,
          readyAt:
            input.status === OrderStatus.READY_FOR_PICKUP
              ? new Date().toISOString()
              : order.readyAt,
          completedAt:
            input.status === OrderStatus.COMPLETED
              ? new Date().toISOString()
              : order.completedAt,
          managerId: input.managerId ?? null,
          manager: resolveDemoManager(input.managerId ?? null),
          updatedAt: new Date().toISOString(),
        }
      : order,
  );

  await writeDemoOrders(updated);
}

export async function bulkUpdateOrderInboxItems(input: {
  orderIds: string[];
  status?: OrderStatus;
  managerId?: string | null;
  clearManager?: boolean;
}) {
  if (input.orderIds.length === 0) {
    return;
  }

  if (hasDatabaseUrl()) {
    const timestampFields =
      input.status === OrderStatus.READY_FOR_PICKUP
        ? { readyAt: new Date() }
        : input.status === OrderStatus.COMPLETED
          ? { completedAt: new Date() }
          : {};

    await getDb().order.updateMany({
      where: { id: { in: input.orderIds } },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...timestampFields,
        ...(input.clearManager
          ? { managerId: null }
          : input.managerId
            ? { managerId: input.managerId }
            : {}),
      },
    });

    return;
  }

  if (!isDemoModeEnabled()) {
    return;
  }

  const orderIds = new Set(input.orderIds);
  const updated = (await readDemoOrders()).map((order) => {
    if (!orderIds.has(order.id)) {
      return order;
    }

    return {
      ...order,
      status: input.status ?? order.status,
      readyAt:
        input.status === OrderStatus.READY_FOR_PICKUP
          ? new Date().toISOString()
          : order.readyAt,
      completedAt:
        input.status === OrderStatus.COMPLETED
          ? new Date().toISOString()
          : order.completedAt,
      managerId: input.clearManager
        ? null
        : input.managerId !== undefined
          ? input.managerId
          : order.managerId,
      manager: input.clearManager
        ? null
        : input.managerId !== undefined
          ? resolveDemoManager(input.managerId)
          : order.manager,
      updatedAt: new Date().toISOString(),
    };
  });

  await writeDemoOrders(updated);
}
