import { RoleCode } from "@/generated/prisma";

export const adminRoleCodes = new Set<RoleCode>([
  RoleCode.MANAGER,
  RoleCode.ADMIN,
  RoleCode.SUPER_ADMIN,
]);

export function canAccessAdmin(roleCode: RoleCode) {
  return adminRoleCodes.has(roleCode);
}
