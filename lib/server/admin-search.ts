import "server-only";

import { RoleCode, type Prisma } from "@/generated/prisma";
import { getDb } from "@/lib/db";
import {
  buildUserSearchWhere,
  normalizeUserSearchQuery,
} from "@/lib/server/users-admin";

// Общий поиск по админке: клиенты, заказы и заявки одним запросом. Ищет по
// имени, компании, телефону в любом виде и по номеру заказа или заявки.
const insensitive = "insensitive" as const;
const LIMIT = 12;

export async function searchAdmin(rawQuery: string) {
  const query = normalizeUserSearchQuery(rawQuery);

  if (query.length < 2) {
    return null;
  }

  const db = getDb();
  const terms = query.split(" ").filter(Boolean);
  const clients = await db.user.findMany({
    where: {
      role: { code: { in: [RoleCode.CUSTOMER, RoleCode.DEALER] } },
      ...buildUserSearchWhere(query),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: LIMIT,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      phone: true,
      email: true,
      loyaltyPointsBalance: true,
      isActive: true,
    },
  });
  // Заказы и заявки найденных клиентов показываем тоже: так телефон,
  // записанный в заказе по-другому, не мешает найти заказ.
  const clientIds = clients.map((client) => client.id);
  const textMatch = (fields: string[]) => ({
    AND: terms.map((term) => ({
      OR: fields.map((field) => ({
        [field]: { contains: term, mode: insensitive },
      })),
    })),
  });
  const orderWhere: Prisma.OrderWhereInput = {
    OR: [
      textMatch(["number", "contactName", "contactPhone", "companyName"]),
      ...(clientIds.length > 0 ? [{ userId: { in: clientIds } }] : []),
    ],
  };
  const requestWhere: Prisma.RequestWhereInput = {
    OR: [
      textMatch(["number", "contactName", "contactPhone", "subject"]),
      ...(clientIds.length > 0 ? [{ userId: { in: clientIds } }] : []),
    ],
  };
  const [orders, requests] = await Promise.all([
    db.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        number: true,
        status: true,
        contactName: true,
        contactPhone: true,
        total: true,
        createdAt: true,
      },
    }),
    db.request.findMany({
      where: requestWhere,
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        number: true,
        status: true,
        type: true,
        subject: true,
        contactName: true,
        contactPhone: true,
        createdAt: true,
      },
    }),
  ]);

  return { query, clients, orders, requests, limit: LIMIT };
}
