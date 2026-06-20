import { RoleCode } from "@/generated/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { isDemoModeEnabled } from "@/lib/db";

const fallbackDemoAdminEmail = "admin@artisan.local";
const fallbackDemoAdminPassword = "Artisan123!";
const fallbackDemoAdminFirstName = "Artisan";
const fallbackDemoAdminLastName = "Admin";

export function isDemoAdminEnabled() {
  return isDemoModeEnabled();
}

export function getDemoAdminCredentials() {
  if (!isDemoAdminEnabled()) {
    return null;
  }

  return {
    email:
      process.env.ARTISAN_DEMO_ADMIN_EMAIL?.trim().toLowerCase() ??
      fallbackDemoAdminEmail,
    password:
      process.env.ARTISAN_DEMO_ADMIN_PASSWORD?.trim() ??
      fallbackDemoAdminPassword,
  };
}

export function matchesDemoAdminCredentials(email: string, password: string) {
  const credentials = getDemoAdminCredentials();

  if (!credentials) {
    return false;
  }

  return (
    email.trim().toLowerCase() === credentials.email &&
    password === credentials.password
  );
}

export function getDemoAdminSession(): SessionPayload {
  const credentials = getDemoAdminCredentials();

  if (!credentials) {
    throw new Error(
      "Demo admin session is unavailable while demo mode is off.",
    );
  }

  return {
    userId: "demo-super-admin",
    roleCode: RoleCode.SUPER_ADMIN,
    email: credentials.email,
    firstName:
      process.env.ARTISAN_DEMO_ADMIN_FIRST_NAME?.trim() ??
      fallbackDemoAdminFirstName,
    lastName:
      process.env.ARTISAN_DEMO_ADMIN_LAST_NAME?.trim() ??
      fallbackDemoAdminLastName,
  };
}
