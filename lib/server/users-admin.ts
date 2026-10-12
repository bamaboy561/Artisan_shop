import {
  LoyaltyTransactionStatus,
  RoleCode,
  type Prisma,
} from "@/generated/prisma";

import { getDb } from "@/lib/db";

type AdminUserFilters = {
  query?: string;
};

const insensitiveMode = "insensitive" as const;

export function normalizeUserSearchQuery(query: string | null | undefined) {
  return query?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "";
}

function getPhoneSearchTerms(term: string) {
  const digits = term.replace(/\D/g, "");

  if (digits.length < 3) {
    return [];
  }

  const variants = new Set<string>([digits]);
  const withoutLeadingZeroes = digits.replace(/^0+/, "");

  if (withoutLeadingZeroes.length >= 3) {
    variants.add(withoutLeadingZeroes);
    variants.add(`+${withoutLeadingZeroes}`);

    if (!withoutLeadingZeroes.startsWith("996")) {
      variants.add(`996${withoutLeadingZeroes}`);
      variants.add(`+996${withoutLeadingZeroes}`);
    }
  }

  for (const length of [9, 7, 6, 4, 3]) {
    if (digits.length >= length) {
      variants.add(digits.slice(-length));
    }
  }

  return Array.from(variants).filter((value) => value.length >= 3);
}

function getTelegramSearchTerms(term: string) {
  const normalized = term.trim().replace(/^@+/, "");

  return normalized && normalized !== term ? [normalized] : [];
}

export function buildUserSearchWhere(query: string): Prisma.UserWhereInput {
  const terms = normalizeUserSearchQuery(query)
    .split(" ")
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return {};
  }

  return {
    AND: terms.map((term) => {
      const phoneTerms = getPhoneSearchTerms(term);
      const telegramTerms = getTelegramSearchTerms(term);

      return {
        OR: [
          { id: { equals: term } },
          { email: { contains: term, mode: insensitiveMode } },
          { firstName: { contains: term, mode: insensitiveMode } },
          { lastName: { contains: term, mode: insensitiveMode } },
          { phone: { contains: term, mode: insensitiveMode } },
          { companyName: { contains: term, mode: insensitiveMode } },
          { telegramUsername: { contains: term, mode: insensitiveMode } },
          { telegramChatId: { contains: term, mode: insensitiveMode } },
          ...phoneTerms.flatMap((phoneTerm) => [
            { phone: { contains: phoneTerm, mode: insensitiveMode } },
            { telegramChatId: { contains: phoneTerm, mode: insensitiveMode } },
          ]),
          ...telegramTerms.map((telegramTerm) => ({
            telegramUsername: {
              contains: telegramTerm,
              mode: insensitiveMode,
            },
          })),
        ],
      };
    }),
  };
}

export async function getAdminUsers(filters: AdminUserFilters = {}) {
  const db = getDb();
  const queryWhere = buildUserSearchWhere(filters.query ?? "");

  return db.user.findMany({
    where: {
      role: {
        code: {
          in: [RoleCode.CUSTOMER, RoleCode.DEALER],
        },
      },
      ...queryWhere,
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
      plateMaterialLoyaltyTier: true,
      fittingsLoyaltyTier: true,
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

export async function getAdminUserProfile(id: string) {
  const db = getDb();

  return db.user.findFirst({
    where: {
      id,
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
      loyaltyPointsBalance: true,
      loyaltyPointsLifetime: true,
      personalDiscountPercent: true,
      telegramChatId: true,
      telegramUsername: true,
      createdAt: true,
      role: {
        select: {
          name: true,
        },
      },
      orders: {
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
          _count: {
            select: {
              items: true,
            },
          },
        },
      },
      requests: {
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          subject: true,
          quotedTotal: true,
          createdAt: true,
        },
      },
      loyaltyTransactions: {
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
        select: {
          id: true,
          title: true,
          points: true,
          status: true,
          balanceAfter: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          orders: true,
          requests: true,
        },
      },
    },
  });
}
