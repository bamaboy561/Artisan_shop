import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { RoleCode } from "@/generated/prisma";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { readSession } from "@/lib/auth/session";
import {
  canAccessAdmin,
  canAccessAdminPath,
  getAdminHomePath,
} from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export const getOptionalSession = cache(async () => {
  const session = await readSession();

  if (!session?.userId || !hasDatabaseUrl()) {
    return session;
  }

  const user = await getDb().user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      productionStation: true,
      isActive: true,
      role: { select: { code: true } },
    },
  });

  if (!user?.isActive) {
    return null;
  }

  const revocation = await getDb().siteSetting.findUnique({
    where: { key: `session-revocation:${user.id}` },
    select: { value: true },
  });
  const value = revocation?.value;
  if (value && typeof value === "object" && !Array.isArray(value)
    && typeof value.revokedBefore === "number"
    && (session.issuedAtMilliseconds ?? 0) <= value.revokedBefore) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    productionStation: user.productionStation,
    roleCode: user.role.code,
  };
});

export async function verifySession(redirectTo = "/login") {
  const session = await getOptionalSession();

  if (!session?.userId) {
    redirect(redirectTo);
  }

  return session;
}

export async function requireAdminSession(
  redirectTo = "/login",
  adminPath?: string,
) {
  const session = await verifySession(redirectTo);

  if (!canAccessAdmin(session.roleCode)) {
    redirect("/account");
  }

  if (adminPath && !canAccessAdminPath(session.roleCode, adminPath)) {
    redirect(getAdminHomePath(session.roleCode));
  }

  return session;
}

export async function getCurrentUserRecord() {
  const session = await verifySession();

  if (!hasDatabaseUrl()) {
    return null;
  }

  return getDb().user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      role: {
        select: {
          code: true,
          name: true,
        },
      },
      loyaltyTier: true,
      plateMaterialLoyaltyTier: true,
      fittingsLoyaltyTier: true,
      loyaltyPointsBalance: true,
      loyaltyPointsLifetime: true,
      personalDiscountPercent: true,
    },
  });
}

export async function verifyCredentials(email: string, password: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const { compare } = await import("bcryptjs");
  const normalizedEmail = email.trim().toLowerCase();

  const user = await getDb().user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      productionStation: true,
      hashedPassword: true,
      isActive: true,
      role: {
        select: {
          code: true,
        },
      },
    },
  });

  if (!user?.hashedPassword || !user.isActive) {
    return null;
  }

  const isValid = await compare(password, user.hashedPassword);

  if (!isValid) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    productionStation: user.productionStation,
    roleCode: user.role.code as RoleCode,
  };
}

export { getSafeRedirectPath };
