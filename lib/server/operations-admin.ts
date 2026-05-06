import { RoleCode } from "@/generated/prisma";
import { getDemoAdminSession } from "@/lib/auth/demo-access";
import { getDb, hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { getOrderInbox } from "@/lib/server/order-inbox";

export async function getAdminManagers() {
  if (!hasDatabaseUrl() && isDemoModeEnabled()) {
    const demoAdmin = getDemoAdminSession();

    return [
      {
        id: demoAdmin.userId,
        firstName: demoAdmin.firstName ?? null,
        lastName: demoAdmin.lastName ?? null,
        email: demoAdmin.email,
        role: {
          code: demoAdmin.roleCode,
          name: "Demo Admin",
        },
      },
    ];
  }

  const db = getDb();

  return db.user.findMany({
    where: {
      role: {
        code: {
          in: [RoleCode.MANAGER, RoleCode.ADMIN, RoleCode.SUPER_ADMIN],
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });
}

export async function getAdminOrders() {
  return getOrderInbox();
}

export async function getAdminRequests() {
  const db = getDb();

  return db.request.findMany({
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
