import { RoleCode } from "@/generated/prisma";
import type { NavItem } from "@/types/navigation";

export const adminRoleCodes = new Set<RoleCode>([
  RoleCode.MANAGER,
  RoleCode.ADMIN,
  RoleCode.SUPER_ADMIN,
]);

export function canAccessAdmin(roleCode: RoleCode) {
  return adminRoleCodes.has(roleCode);
}

const managerAdminRoutes = [
  "/admin/my",
  "/admin/sales",
  "/admin/orders",
  "/admin/requests",
  "/admin/cutting",
  "/admin/users/",
];

const adminAdminRoutes = [
  "/admin/my",
  "/admin/sales",
  "/admin/orders",
  "/admin/requests",
  "/admin/cutting",
  "/admin/categories",
  "/admin/products",
  "/admin/brands",
  "/admin/users",
  "/admin/promotions",
  "/admin/calculator",
];

function normalizePath(pathname: string) {
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/admin";
  return path === "" ? "/admin" : path;
}

function isExactOrChild(pathname: string, route: string) {
  const normalizedPath = normalizePath(pathname);
  const normalizedRoute = route.replace(/\/+$/, "");

  if (route.endsWith("/")) {
    return normalizedPath.startsWith(normalizedRoute + "/");
  }

  return (
    normalizedPath === normalizedRoute ||
    normalizedPath.startsWith(`${normalizedRoute}/`)
  );
}

export function canAccessAdminRoute(roleCode: RoleCode, pathname: string) {
  if (!canAccessAdmin(roleCode)) {
    return false;
  }

  if (roleCode === RoleCode.SUPER_ADMIN) {
    return true;
  }

  if (roleCode === RoleCode.ADMIN) {
    if (normalizePath(pathname) === "/admin") {
      return true;
    }

    return adminAdminRoutes.some((route) => isExactOrChild(pathname, route));
  }

  if (roleCode === RoleCode.MANAGER) {
    return managerAdminRoutes.some((route) => isExactOrChild(pathname, route));
  }

  return false;
}

export function getAdminFallbackPath(roleCode: RoleCode) {
  if (roleCode === RoleCode.MANAGER) {
    return "/admin/my";
  }

  if (roleCode === RoleCode.ADMIN || roleCode === RoleCode.SUPER_ADMIN) {
    return "/admin";
  }

  return "/account";
}

export function getAdminNavigationForRole(
  roleCode: RoleCode,
  items: NavItem[],
) {
  return items.filter((item) => canAccessAdminRoute(roleCode, item.href));
}
