import "server-only";

import {
  LoyaltyTransactionStatus,
  LoyaltyTransactionType,
  RoleCode,
  type Prisma,
} from "@/generated/prisma";
import { getDb } from "@/lib/db";
import { ensureLoyaltyAuditSchema } from "@/lib/server/loyalty-audit-schema";
import {
  buildUserSearchWhere,
  normalizeUserSearchQuery,
} from "@/lib/server/users-admin";

const AUDIT_PAGE_SIZE = 40;
const LOCAL_TIME_OFFSET = "+06:00";

export type LoyaltyAuditFilters = {
  query?: string;
  managerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
};

function parseDateBoundary(value: string | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  const parsed = new Date(`${value}T${time}${LOCAL_TIME_OFFSET}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getUserDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
  );
}

export async function getLoyaltyAuditLog(filters: LoyaltyAuditFilters = {}) {
  const db = getDb();
  await ensureLoyaltyAuditSchema(db);

  const query = normalizeUserSearchQuery(filters.query);
  const managerId = filters.managerId?.trim().slice(0, 80) ?? "";
  const dateFrom = parseDateBoundary(filters.dateFrom, false);
  const dateTo = parseDateBoundary(filters.dateTo, true);
  const requestedPage = Math.max(1, Math.trunc(filters.page ?? 1));
  const where: Prisma.LoyaltyTransactionWhereInput = {
    type: LoyaltyTransactionType.MANUAL_ADJUSTMENT,
    ...(managerId ? { approvedById: managerId } : {}),
    ...(query
      ? {
          user: {
            is: buildUserSearchWhere(query),
          },
        }
      : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };

  const [total, managers] = await Promise.all([
    db.loyaltyTransaction.count({ where }),
    db.user.findMany({
      where: {
        role: {
          code: {
            in: [RoleCode.MANAGER, RoleCode.ADMIN, RoleCode.SUPER_ADMIN],
          },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: { select: { code: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const operations = await db.loyaltyTransaction.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    select: {
      id: true,
      userId: true,
      points: true,
      balanceBefore: true,
      balanceAfter: true,
      title: true,
      description: true,
      status: true,
      approvedById: true,
      reversalOfTransactionId: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          companyName: true,
        },
      },
    },
  });
  const operationIds = operations.map((operation) => operation.id);
  const actorIds = Array.from(
    new Set(
      operations
        .map((operation) => operation.approvedById)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const [actors, reversals] = await Promise.all([
    actorIds.length > 0
      ? db.user.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        })
      : Promise.resolve([]),
    operationIds.length > 0
      ? db.loyaltyTransaction.findMany({
          where: { reversalOfTransactionId: { in: operationIds } },
          select: {
            id: true,
            reversalOfTransactionId: true,
            approvedById: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const reversalByOriginalId = new Map(
    reversals.flatMap((reversal) =>
      reversal.reversalOfTransactionId
        ? [[reversal.reversalOfTransactionId, reversal] as const]
        : [],
    ),
  );

  return {
    query,
    managerId,
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
    page,
    pageSize: AUDIT_PAGE_SIZE,
    total,
    totalPages,
    managers: managers.map((manager) => ({
      ...manager,
      displayName: getUserDisplayName(manager),
    })),
    operations: operations.map((operation) => {
      const actor = operation.approvedById
        ? (actorById.get(operation.approvedById) ?? null)
        : null;
      const reversal = reversalByOriginalId.get(operation.id) ?? null;

      return {
        ...operation,
        actor: actor
          ? { ...actor, displayName: getUserDisplayName(actor) }
          : null,
        reversalTransactionId: reversal?.id ?? null,
        reversedAt: reversal?.createdAt ?? null,
        reversedById: reversal?.approvedById ?? null,
      };
    }),
  };
}

export type RollbackLoyaltyResult =
  | {
      ok: true;
      userId: string;
      points: number;
      nextBalance: number;
    }
  | {
      ok: false;
      reason:
        | "missing"
        | "not-approved"
        | "already-reversed"
        | "reversal-operation"
        | "insufficient-balance";
    };

export async function rollbackManualLoyaltyTransaction(params: {
  transactionId: string;
  actorId: string;
}): Promise<RollbackLoyaltyResult> {
  const db = getDb();
  await ensureLoyaltyAuditSchema(db);

  try {
    return await db.$transaction(async (tx) => {
      const original = await tx.loyaltyTransaction.findUnique({
        where: { id: params.transactionId },
        select: {
          id: true,
          userId: true,
          type: true,
          status: true,
          points: true,
          title: true,
          description: true,
          reversalOfTransactionId: true,
          createdAt: true,
        },
      });

      if (
        !original ||
        original.type !== LoyaltyTransactionType.MANUAL_ADJUSTMENT
      ) {
        return { ok: false, reason: "missing" } as const;
      }

      if (
        original.status !== LoyaltyTransactionStatus.APPROVED ||
        original.points === 0
      ) {
        return { ok: false, reason: "not-approved" } as const;
      }

      if (original.reversalOfTransactionId) {
        return { ok: false, reason: "reversal-operation" } as const;
      }

      const existingReversal = await tx.loyaltyTransaction.findUnique({
        where: { reversalOfTransactionId: original.id },
        select: { id: true },
      });

      if (existingReversal) {
        return { ok: false, reason: "already-reversed" } as const;
      }

      const reversalPoints = -original.points;

      if (original.points > 0) {
        const updated = await tx.user.updateMany({
          where: {
            id: original.userId,
            loyaltyPointsBalance: { gte: original.points },
            loyaltyPointsLifetime: { gte: original.points },
          },
          data: {
            loyaltyPointsBalance: { increment: reversalPoints },
            loyaltyPointsLifetime: { increment: reversalPoints },
          },
        });

        if (updated.count === 0) {
          return { ok: false, reason: "insufficient-balance" } as const;
        }
      } else {
        await tx.user.update({
          where: { id: original.userId },
          data: {
            loyaltyPointsBalance: { increment: reversalPoints },
          },
        });
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: original.userId },
        select: { loyaltyPointsBalance: true },
      });
      const balanceBefore = user.loyaltyPointsBalance - reversalPoints;
      const originalDate = new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Asia/Bishkek",
      }).format(original.createdAt);

      await tx.loyaltyTransaction.create({
        data: {
          userId: original.userId,
          type: LoyaltyTransactionType.MANUAL_ADJUSTMENT,
          status: LoyaltyTransactionStatus.APPROVED,
          points: reversalPoints,
          balanceBefore,
          balanceAfter: user.loyaltyPointsBalance,
          approvedAt: new Date(),
          approvedById: params.actorId,
          reversalOfTransactionId: original.id,
          title: `Откат: ${original.title}`.slice(0, 160),
          description: [
            `Отменена операция от ${originalDate}.`,
            original.description
              ? `Причина исходной операции: ${original.description}`
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
      });

      return {
        ok: true,
        userId: original.userId,
        points: reversalPoints,
        nextBalance: user.loyaltyPointsBalance,
      } as const;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "already-reversed" };
    }

    throw error;
  }
}
