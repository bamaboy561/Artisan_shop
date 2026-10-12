import "server-only";

import type { RoleCode } from "@/generated/prisma";
import { canManageStaff } from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";

// Менеджеры, которым администратор разрешил менять правила бонусов,
// баллы, уровни, личные скидки и удалять клиентов. По умолчанию никто.
const loyaltyManagersKey = "staff:loyalty-managers:v1";

function parseManagerIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function getLoyaltyManagerIds() {
  if (!hasDatabaseUrl()) {
    return new Set<string>();
  }

  const setting = await getDb().siteSetting.findUnique({
    where: { key: loyaltyManagersKey },
  });

  return new Set(parseManagerIds(setting?.value));
}

export async function setLoyaltyManagerAccess(
  userId: string,
  allowed: boolean,
) {
  const ids = await getLoyaltyManagerIds();

  if (allowed) {
    ids.add(userId);
  } else {
    ids.delete(userId);
  }

  const value = [...ids];

  await getDb().siteSetting.upsert({
    where: { key: loyaltyManagersKey },
    create: {
      key: loyaltyManagersKey,
      value,
      description:
        "Менеджеры с правом управлять бонусами, скидками и клиентами",
    },
    update: { value },
  });
}

export async function canManageLoyalty(session: {
  userId: string;
  roleCode: RoleCode;
}) {
  if (canManageStaff(session.roleCode)) {
    return true;
  }

  return (await getLoyaltyManagerIds()).has(session.userId);
}
