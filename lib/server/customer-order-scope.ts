import type { Prisma } from "@/generated/prisma";

export type CustomerOrderIdentity = {
  id: string;
  email?: string | null;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getCustomerOrderWhere(
  customer: CustomerOrderIdentity,
): Prisma.OrderWhereInput {
  const contactMatches: Prisma.OrderWhereInput[] = [];
  const email = normalizeText(customer.email)?.toLowerCase();

  if (email) {
    contactMatches.push({
      userId: null,
      contactEmail: {
        equals: email,
        mode: "insensitive",
      },
    });
  }

  return {
    OR: [{ userId: customer.id }, ...contactMatches],
  };
}
