import "server-only";

import { RoleCode, type Prisma } from "@/generated/prisma";
import { employeeRoleCodes } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import {
  buildUserSearchWhere,
  normalizeUserSearchQuery,
} from "@/lib/server/users-admin";

export const staffAccountPageSize = 50;

export type StaffAccountScope = "all" | "staff" | RoleCode;

type StaffAccountFilters = {
  page?: number;
  query?: string;
  scope?: string;
};

const accountScopes = new Set<string>([
  "all",
  "staff",
  ...Object.values(RoleCode),
]);

function normalizeScope(scope: string | undefined): StaffAccountScope {
  return accountScopes.has(scope ?? "")
    ? (scope as StaffAccountScope)
    : "staff";
}

function getScopeWhere(scope: StaffAccountScope): Prisma.UserWhereInput {
  if (scope === "all") {
    return {};
  }

  if (scope === "staff") {
    return {
      role: { code: { in: [...employeeRoleCodes] } },
    };
  }

  return {
    role: { code: scope },
  };
}

export async function getStaffAccountDirectory(
  filters: StaffAccountFilters = {},
) {
  const db = getDb();
  const query = normalizeUserSearchQuery(filters.query);
  const requestedScope = normalizeScope(filters.scope);
  const scope = query && requestedScope === "staff" ? "all" : requestedScope;
  const where: Prisma.UserWhereInput = {
    ...buildUserSearchWhere(query),
    ...getScopeWhere(scope),
  };
  const requestedPage = Math.max(1, Math.trunc(filters.page ?? 1));
  const [total, roleCounts] = await Promise.all([
    db.user.count({ where }),
    db.role.findMany({
      orderBy: { code: "asc" },
      select: {
        code: true,
        _count: { select: { users: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / staffAccountPageSize));
  const page = Math.min(requestedPage, totalPages);
  const records = await db.user.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * staffAccountPageSize,
    take: staffAccountPageSize,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      productionStation: true,
      hashedPassword: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          code: true,
          name: true,
        },
      },
      _count: {
        select: {
          managedOrders: true,
          managedRequests: true,
        },
      },
    },
  });

  return {
    accounts: records.map(({ hashedPassword, ...account }) => ({
      ...account,
      hasPassword: Boolean(hashedPassword),
    })),
    page,
    query,
    roleCounts: roleCounts.map((role) => ({
      code: role.code,
      count: role._count.users,
    })),
    scope,
    total,
    totalPages,
  };
}
