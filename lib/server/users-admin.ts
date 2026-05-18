import { LoyaltyTransactionStatus, RoleCode } from "@/generated/prisma";

import { getDb } from "@/lib/db";

export async function getAdminUsers() {
  const db = getDb();

  return db.user.findMany({
    where: {
      role: {
        code: {
          in: [RoleCode.CUSTOMER, RoleCode.DEALER],
        },
      },
    },
    orderBy: [{ loyaltyPointsBalance: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      loyaltyTier: true,
      loyaltyPointsBalance: true,
      loyaltyPointsLifetime: true,
      personalDiscountPercent: true,
      telegramChatId: true,
      telegramUsername: true,
      telegramLinkedAt: true,
      loyaltyTransactions: {
        where: {
          status: LoyaltyTransactionStatus.PENDING,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        select: {
          id: true,
          points: true,
        },
      },
      role: {
        select: {
          code: true,
          name: true,
        },
      },
      _count: {
        select: {
          orders: true,
          requests: true,
          loyaltyTransactions: true,
        },
      },
    },
  });
}
