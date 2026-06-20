import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  MessengerType,
  RequestFileKind,
  RequestStatus,
  RequestType,
} from "@/generated/prisma";
import { getDemoAdminSession } from "@/lib/auth/demo-access";
import { getDb, hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import type { AdminRequestItem } from "@/features/admin/operations-filters";

type DemoRequestRecord = Omit<AdminRequestItem, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  addressText?: string | null;
  userId?: string | null;
  quotedTotal?: number | null;
  productionComment?: string | null;
  files?: RequestFileRecord[];
  managerNotes?: ManagerNoteRecord[];
};

export type RequestFileRecord = {
  id: string;
  kind?: RequestFileKind;
  isVisibleToClient?: boolean;
  uploadedByUserId?: string | null;
  uploadedByName?: string | null;
  note?: string | null;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  size?: number | null;
  createdAt: string;
};

export type ManagerNoteRecord = {
  id: string;
  body: string;
  isVisibleToClient: boolean;
  authorId?: string | null;
  authorName?: string | null;
  createdAt: string;
};

export type RequestDetailItem = AdminRequestItem & {
  userId?: string | null;
  addressText?: string | null;
  quotedTotal?: number | null;
  productionComment?: string | null;
  files: RequestFileRecord[];
  managerNotes?: ManagerNoteRecord[];
  linkedOrders?: Array<{
    id: string;
    number: string | null;
    status?: string;
  }>;
};

export type CuttingRequestSubmission = {
  subject: string;
  message: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  messengerType?: string | null;
  messengerHandle?: string | null;
  material: string;
  edgeOption: string;
  estimatedBudget: number | null;
  deliveryNeeded?: boolean;
  addressText?: string | null;
  userId?: string | null;
  uploadedFiles?: File[];
};

export type ContactRequestSubmission = {
  subject: string;
  message: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  userId?: string | null;
};

type CreatedCuttingRequestResult = {
  id: string;
  number: string | null;
  duplicate?: boolean;
};

const runtimeDirectory = path.join(process.cwd(), ".artisan-runtime");
const demoRequestsPath = path.join(runtimeDirectory, "requests.json");
const requestUploadsDirectory = path.join(
  process.cwd(),
  "public",
  "uploads",
  "requests",
);

async function ensureRuntimeDirectory() {
  await mkdir(runtimeDirectory, { recursive: true });
}

async function ensureRequestUploadsDirectory(
  requestId: string,
  directorySlug?: string,
) {
  const targetDirectory = directorySlug
    ? path.join(requestUploadsDirectory, requestId, directorySlug)
    : path.join(requestUploadsDirectory, requestId);

  await mkdir(targetDirectory, { recursive: true });
  return targetDirectory;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function isAllowedRequestFile(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return new Set([
    ".pdf",
    ".xls",
    ".xlsx",
    ".csv",
    ".txt",
    ".doc",
    ".docx",
    ".zip",
    ".rar",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".dwg",
    ".dxf",
  ]).has(extension);
}

export async function persistRequestFiles(
  requestId: string,
  files: File[],
  options: {
    directorySlug?: string;
    kind?: RequestFileKind;
    isVisibleToClient?: boolean;
    uploadedByUserId?: string | null;
    uploadedByName?: string | null;
    note?: string | null;
  } = {},
) {
  if (files.length === 0) {
    return [] as RequestFileRecord[];
  }

  const directory = await ensureRequestUploadsDirectory(
    requestId,
    options.directorySlug,
  );
  const savedFiles: RequestFileRecord[] = [];

  for (const file of files) {
    const sanitizedBaseName = sanitizeFileName(file.name || "attachment");
    const safeName = sanitizedBaseName || `file-${Date.now()}`;
    const storedFileName = `${Date.now()}-${safeName}`;
    const targetPath = path.join(directory, storedFileName);
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(targetPath, bytes);

    savedFiles.push({
      id: `file-${Date.now()}-${savedFiles.length + 1}`,
      kind: options.kind ?? RequestFileKind.CLIENT_UPLOAD,
      isVisibleToClient: options.isVisibleToClient ?? false,
      uploadedByUserId: options.uploadedByUserId ?? null,
      uploadedByName: options.uploadedByName ?? null,
      note: options.note ?? null,
      fileName: file.name,
      fileUrl: options.directorySlug
        ? `/uploads/requests/${requestId}/${options.directorySlug}/${storedFileName}`
        : `/uploads/requests/${requestId}/${storedFileName}`,
      mimeType: file.type || null,
      size: file.size,
      createdAt: new Date().toISOString(),
    });
  }

  return savedFiles;
}

function createDemoRequestRecord(
  record: Partial<DemoRequestRecord> & {
    id: string;
    number: string;
    subject: string;
    contactName: string;
    contactPhone: string;
  },
): DemoRequestRecord {
  const timestamp = new Date().toISOString();

  return {
    id: record.id,
    number: record.number,
    type: record.type ?? RequestType.CUTTING_SERVICE,
    status: record.status ?? RequestStatus.NEW,
    subject: record.subject,
    message: record.message ?? null,
    material: record.material ?? null,
    edgeOption: record.edgeOption ?? null,
    estimatedBudget: record.estimatedBudget ?? null,
    contactName: record.contactName,
    contactPhone: record.contactPhone,
    contactEmail: record.contactEmail ?? null,
    messengerType: record.messengerType ?? null,
    messengerHandle: record.messengerHandle ?? null,
    createdAt: record.createdAt ?? timestamp,
    updatedAt: record.updatedAt ?? timestamp,
    managerId: record.managerId ?? null,
    userId: record.userId ?? null,
    deliveryNeeded: record.deliveryNeeded ?? false,
    addressText: record.addressText ?? null,
    product: record.product ?? null,
    manager: record.manager ?? null,
    files: record.files ?? [],
    managerNotes: [],
    quotedTotal: null,
    productionComment: null,
    _count: {
      files: record.files?.length ?? record._count?.files ?? 0,
    },
  };
}

const initialDemoRequests: DemoRequestRecord[] = [];

async function readDemoRequests() {
  await ensureRuntimeDirectory();

  try {
    const content = await readFile(demoRequestsPath, "utf8");
    const parsed = JSON.parse(content) as DemoRequestRecord[];

    return parsed.map((request) =>
      createDemoRequestRecord({
        ...request,
        number: request.number ?? buildNextRequestNumber([]),
        _count: {
          files: request.files?.length ?? request._count?.files ?? 0,
        },
      }),
    );
  } catch {
    await writeDemoRequests(initialDemoRequests);
    return initialDemoRequests;
  }
}

async function writeDemoRequests(requests: DemoRequestRecord[]) {
  await ensureRuntimeDirectory();
  await writeFile(demoRequestsPath, JSON.stringify(requests, null, 2), "utf8");
}

function toAdminRequestItem(record: DemoRequestRecord): AdminRequestItem {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toRequestDetailItem(record: DemoRequestRecord): RequestDetailItem {
  return {
    ...toAdminRequestItem(record),
    userId: record.userId ?? null,
    addressText: record.addressText ?? null,
    quotedTotal: record.quotedTotal ?? null,
    productionComment: record.productionComment ?? null,
    files: record.files ?? [],
    managerNotes: record.managerNotes ?? [],
    linkedOrders: [],
  };
}

function buildNextRequestNumber(existingNumbers: string[]) {
  const maxValue = existingNumbers.reduce((currentMax, value) => {
    const match = value.match(/^R-(\d+)$/);

    if (!match) {
      return currentMax;
    }

    const parsed = Number.parseInt(match[1], 10);
    return Number.isNaN(parsed) ? currentMax : Math.max(currentMax, parsed);
  }, 2000);

  return `R-${String(maxValue + 1).padStart(4, "0")}`;
}

function resolveMessengerType(value?: string | null) {
  if (
    value === MessengerType.PHONE ||
    value === MessengerType.WHATSAPP ||
    value === MessengerType.TELEGRAM ||
    value === MessengerType.EMAIL
  ) {
    return value;
  }

  return null;
}

function resolveDemoManager(managerId?: string | null) {
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

function isSameCuttingRequest(
  request: {
    type?: RequestType;
    contactPhone: string;
    subject: string;
    material?: string | null;
    message?: string | null;
    contactEmail?: string | null;
  },
  input: CuttingRequestSubmission,
) {
  return (
    (request.type ?? RequestType.CUTTING_SERVICE) ===
      RequestType.CUTTING_SERVICE &&
    request.contactPhone.trim() === input.contactPhone.trim() &&
    request.subject.trim() === input.subject.trim() &&
    (request.material ?? "").trim() === input.material.trim() &&
    (request.message ?? "").trim() === input.message.trim() &&
    (request.contactEmail ?? "").trim() === (input.contactEmail ?? "").trim()
  );
}

function isSameContactRequest(
  request: {
    type?: RequestType;
    contactPhone: string;
    subject: string;
    message?: string | null;
    contactEmail?: string | null;
  },
  input: ContactRequestSubmission,
) {
  return (
    (request.type ?? RequestType.CONSULTATION) === RequestType.CONSULTATION &&
    request.contactPhone.trim() === input.contactPhone.trim() &&
    request.subject.trim() === input.subject.trim() &&
    (request.message ?? "").trim() === input.message.trim() &&
    (request.contactEmail ?? "").trim() === (input.contactEmail ?? "").trim()
  );
}

function isRecentRequest(value: Date | string, maxAgeMs: number) {
  const createdAt = value instanceof Date ? value : new Date(value);
  return Date.now() - createdAt.getTime() <= maxAgeMs;
}

export async function getRequestInbox() {
  if (hasDatabaseUrl()) {
    return getDb().request.findMany({
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
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
      },
    });
  }

  if (!isDemoModeEnabled()) {
    return [];
  }

  const requests = await readDemoRequests();
  return requests
    .map(toAdminRequestItem)
    .sort(
      (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
    );
}

export async function getRequestInboxItemById(id: string) {
  if (hasDatabaseUrl()) {
    return getDb().request.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        linkedOrders: {
          select: {
            id: true,
            number: true,
            status: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
      },
    });
  }

  if (!isDemoModeEnabled()) {
    return null;
  }

  const requests = await readDemoRequests();
  const request = requests.find((item) => item.id === id);

  return request ? toAdminRequestItem(request) : null;
}

export async function getRequestDetailById(
  id: string,
): Promise<RequestDetailItem | null> {
  if (hasDatabaseUrl()) {
    const request = await getDb().request.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        files: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            kind: true,
            isVisibleToClient: true,
            uploadedByUserId: true,
            uploadedByName: true,
            note: true,
            fileName: true,
            fileUrl: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
        linkedOrders: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            status: true,
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
            files: true,
          },
        },
      },
    });

    if (!request) {
      return null;
    }

    return {
      ...request,
      addressText: request.addressText ?? null,
      userId: request.userId ?? null,
      quotedTotal: request.quotedTotal ?? null,
      productionComment: request.productionComment ?? null,
      files: request.files.map((file) => ({
        ...file,
        createdAt: file.createdAt.toISOString(),
      })),
      managerNotes: request.managerNotes.map((note) => ({
        ...note,
        createdAt: note.createdAt.toISOString(),
      })),
      linkedOrders: request.linkedOrders,
    };
  }

  if (!isDemoModeEnabled()) {
    return null;
  }

  const requests = await readDemoRequests();
  const request = requests.find((item) => item.id === id);

  return request ? toRequestDetailItem(request) : null;
}

export async function createCuttingRequest(
  input: CuttingRequestSubmission,
): Promise<CreatedCuttingRequestResult> {
  const uploadedFiles = (input.uploadedFiles ?? []).filter(
    (file) =>
      file &&
      typeof file.name === "string" &&
      file.size > 0 &&
      isAllowedRequestFile(file.name),
  );
  const duplicateWindowMs = 10 * 60 * 1000;

  if (hasDatabaseUrl()) {
    const db = getDb();
    const duplicateRequest = await db.request.findFirst({
      where: {
        type: RequestType.CUTTING_SERVICE,
        contactPhone: input.contactPhone.trim(),
        subject: input.subject.trim(),
        material: input.material.trim(),
        message: input.message.trim(),
        contactEmail: input.contactEmail ?? null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        createdAt: true,
      },
    });

    if (
      duplicateRequest &&
      isRecentRequest(duplicateRequest.createdAt, duplicateWindowMs)
    ) {
      return {
        id: duplicateRequest.id,
        number: duplicateRequest.number,
        duplicate: true,
      };
    }

    const existingNumbers = await db.request.findMany({
      select: { number: true },
      where: {
        number: {
          not: null,
        },
      },
    });

    const number = buildNextRequestNumber(
      existingNumbers.flatMap((item) => (item.number ? [item.number] : [])),
    );

    const createdRequest = await db.request.create({
      data: {
        number,
        type: RequestType.CUTTING_SERVICE,
        status: RequestStatus.NEW,
        subject: input.subject,
        message: input.message,
        userId: input.userId ?? null,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail ?? null,
        messengerType: resolveMessengerType(input.messengerType),
        messengerHandle: input.messengerHandle ?? null,
        material: input.material,
        edgeOption: input.edgeOption,
        deliveryNeeded: input.deliveryNeeded ?? false,
        addressText: input.addressText ?? null,
        estimatedBudget: input.estimatedBudget,
      },
      select: {
        id: true,
        number: true,
      },
    });

    if (uploadedFiles.length > 0) {
      const storedFiles = await persistRequestFiles(
        createdRequest.id,
        uploadedFiles,
        {
          kind: RequestFileKind.CLIENT_UPLOAD,
          isVisibleToClient: Boolean(input.userId),
          uploadedByUserId: input.userId ?? null,
          uploadedByName: input.contactName,
        },
      );

      if (storedFiles.length > 0) {
        await db.requestFile.createMany({
          data: storedFiles.map((file) => ({
            requestId: createdRequest.id,
            kind: file.kind ?? RequestFileKind.CLIENT_UPLOAD,
            isVisibleToClient: file.isVisibleToClient ?? false,
            uploadedByUserId: file.uploadedByUserId ?? null,
            uploadedByName: file.uploadedByName ?? null,
            note: file.note ?? null,
            fileName: file.fileName,
            fileUrl: file.fileUrl,
            mimeType: file.mimeType ?? null,
            size: file.size ?? null,
          })),
        });
      }
    }

    return createdRequest;
  }

  const requests = await readDemoRequests();
  const duplicateRequest = requests.find(
    (request) =>
      isSameCuttingRequest(request, input) &&
      isRecentRequest(request.createdAt, duplicateWindowMs),
  );

  if (duplicateRequest) {
    return {
      id: duplicateRequest.id,
      number: duplicateRequest.number,
      duplicate: true,
    };
  }

  const now = new Date().toISOString();
  const number = buildNextRequestNumber(
    requests.flatMap((item) => (item.number ? [item.number] : [])),
  );

  const created = createDemoRequestRecord({
    id: `demo-${Date.now()}`,
    number,
    subject: input.subject,
    message: input.message,
    material: input.material,
    edgeOption: input.edgeOption,
    estimatedBudget: input.estimatedBudget,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail ?? null,
    messengerType: resolveMessengerType(input.messengerType),
    messengerHandle: input.messengerHandle ?? null,
    deliveryNeeded: input.deliveryNeeded ?? false,
    addressText: input.addressText ?? null,
    userId: input.userId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  if (uploadedFiles.length > 0) {
    created.files = await persistRequestFiles(created.id, uploadedFiles, {
      kind: RequestFileKind.CLIENT_UPLOAD,
      isVisibleToClient: Boolean(input.userId),
      uploadedByUserId: input.userId ?? null,
      uploadedByName: input.contactName,
    });
    created._count.files = created.files.length;
  }

  await writeDemoRequests([created, ...requests]);

  return {
    id: created.id,
    number: created.number,
  };
}

export async function createContactRequest(
  input: ContactRequestSubmission,
): Promise<CreatedCuttingRequestResult> {
  const duplicateWindowMs = 10 * 60 * 1000;

  if (hasDatabaseUrl()) {
    const db = getDb();
    const duplicateRequest = await db.request.findFirst({
      where: {
        type: RequestType.CONSULTATION,
        contactPhone: input.contactPhone.trim(),
        subject: input.subject.trim(),
        message: input.message.trim(),
        contactEmail: input.contactEmail ?? null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        createdAt: true,
      },
    });

    if (
      duplicateRequest &&
      isRecentRequest(duplicateRequest.createdAt, duplicateWindowMs)
    ) {
      return {
        id: duplicateRequest.id,
        number: duplicateRequest.number,
        duplicate: true,
      };
    }

    const existingNumbers = await db.request.findMany({
      select: { number: true },
      where: {
        number: {
          not: null,
        },
      },
    });

    const number = buildNextRequestNumber(
      existingNumbers.flatMap((item) => (item.number ? [item.number] : [])),
    );

    return db.request.create({
      data: {
        number,
        type: RequestType.CONSULTATION,
        status: RequestStatus.NEW,
        subject: input.subject,
        message: input.message,
        userId: input.userId ?? null,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail ?? null,
        messengerType: input.contactEmail ? MessengerType.EMAIL : null,
        messengerHandle: input.contactEmail ?? null,
      },
      select: {
        id: true,
        number: true,
      },
    });
  }

  const requests = await readDemoRequests();
  const duplicateRequest = requests.find(
    (request) =>
      isSameContactRequest(request, input) &&
      isRecentRequest(request.createdAt, duplicateWindowMs),
  );

  if (duplicateRequest) {
    return {
      id: duplicateRequest.id,
      number: duplicateRequest.number,
      duplicate: true,
    };
  }

  const now = new Date().toISOString();
  const number = buildNextRequestNumber(
    requests.flatMap((item) => (item.number ? [item.number] : [])),
  );

  const created = createDemoRequestRecord({
    id: `demo-${Date.now()}`,
    number,
    type: RequestType.CONSULTATION,
    subject: input.subject,
    message: input.message,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail ?? null,
    messengerType: input.contactEmail ? MessengerType.EMAIL : null,
    messengerHandle: input.contactEmail ?? null,
    userId: input.userId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await writeDemoRequests([created, ...requests]);

  return {
    id: created.id,
    number: created.number,
  };
}

export async function updateRequestInboxItem(input: {
  id: string;
  status: RequestStatus;
  managerId?: string | null;
}) {
  if (hasDatabaseUrl()) {
    await getDb().request.update({
      where: { id: input.id },
      data: {
        status: input.status,
        managerId: input.managerId ?? null,
      },
    });

    return;
  }

  if (!isDemoModeEnabled()) {
    return;
  }

  const requests = await readDemoRequests();
  const updated = requests.map((request) =>
    request.id === input.id
      ? {
          ...request,
          status: input.status,
          managerId: input.managerId ?? null,
          manager: resolveDemoManager(input.managerId ?? null),
          updatedAt: new Date().toISOString(),
        }
      : request,
  );

  await writeDemoRequests(updated);
}

export async function bulkUpdateRequestInboxItems(input: {
  requestIds: string[];
  status?: RequestStatus;
  managerId?: string | null;
  clearManager?: boolean;
}) {
  if (input.requestIds.length === 0) {
    return;
  }

  if (hasDatabaseUrl()) {
    await getDb().request.updateMany({
      where: { id: { in: input.requestIds } },
      data: {
        ...(input.status ? { status: input.status } : {}),
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

  const requestIds = new Set(input.requestIds);
  const updated = (await readDemoRequests()).map((request) => {
    if (!requestIds.has(request.id)) {
      return request;
    }

    return {
      ...request,
      status: input.status ?? request.status,
      managerId: input.clearManager
        ? null
        : input.managerId !== undefined
          ? input.managerId
          : request.managerId,
      manager: input.clearManager
        ? null
        : input.managerId !== undefined
          ? resolveDemoManager(input.managerId)
          : request.manager,
      updatedAt: new Date().toISOString(),
    };
  });

  await writeDemoRequests(updated);
}
