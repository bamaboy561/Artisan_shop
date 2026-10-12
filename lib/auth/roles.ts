import { ProductionStation, RequestType, RoleCode } from "@/generated/prisma";

export const roleDefinitions = {
  [RoleCode.CUSTOMER]: {
    label: "Клиент",
    description: "Личный кабинет, история заказов и бонусная программа.",
  },
  [RoleCode.DEALER]: {
    label: "Дилер",
    description: "Клиентский кабинет с партнерской ролью.",
  },
  [RoleCode.CUTTING_MANAGER]: {
    label: "Менеджер кроя",
    description: "Только очередь распила, файлы и этапы производства.",
  },
  [RoleCode.PRODUCTION_MANAGER]: {
    label: "Начальник производства",
    description:
      "Вся производственная очередь, этапы, файлы и контроль выдачи.",
  },
  [RoleCode.PRODUCTION_OPERATOR]: {
    label: "Оператор станции",
    description: "Мобильное рабочее место одной станции производства.",
  },
  [RoleCode.MANAGER]: {
    label: "Менеджер",
    description: "Заказы, заявки, продажи и работа с клиентами.",
  },
  [RoleCode.ADMIN]: {
    label: "Администратор",
    description: "Каталог, заказы, заявки, контент и сотрудники.",
  },
  [RoleCode.SUPER_ADMIN]: {
    label: "Супер-админ",
    description: "Полный доступ ко всем разделам и системным настройкам.",
  },
} satisfies Record<
  RoleCode,
  {
    label: string;
    description: string;
  }
>;

export const employeeRoleCodes = [
  RoleCode.CUTTING_MANAGER,
  RoleCode.PRODUCTION_MANAGER,
  RoleCode.PRODUCTION_OPERATOR,
  RoleCode.MANAGER,
  RoleCode.ADMIN,
  RoleCode.SUPER_ADMIN,
] as const;

export const standardAssignableRoleCodes = [
  RoleCode.CUSTOMER,
  RoleCode.DEALER,
  RoleCode.CUTTING_MANAGER,
  RoleCode.PRODUCTION_MANAGER,
  RoleCode.PRODUCTION_OPERATOR,
  RoleCode.MANAGER,
] as const;

export const generalAdminRoleCodes = new Set<RoleCode>([
  RoleCode.MANAGER,
  RoleCode.ADMIN,
  RoleCode.SUPER_ADMIN,
]);

export const adminRoleCodes = new Set<RoleCode>([
  RoleCode.CUTTING_MANAGER,
  RoleCode.PRODUCTION_MANAGER,
  RoleCode.PRODUCTION_OPERATOR,
  ...generalAdminRoleCodes,
]);

export const productionStationDefinitions = {
  [ProductionStation.CUTTING]: {
    label: "Станция распила",
    shortLabel: "Распил",
  },
  [ProductionStation.EDGING]: {
    label: "Станция кромки",
    shortLabel: "Кромка",
  },
  [ProductionStation.DRILLING]: {
    label: "Станция присадки",
    shortLabel: "Присадка",
  },
} satisfies Record<ProductionStation, { label: string; shortLabel: string }>;

export const orderDeleteRoleCodes = new Set<RoleCode>([RoleCode.SUPER_ADMIN]);

export const requestDeleteRoleCodes = new Set<RoleCode>([RoleCode.SUPER_ADMIN]);

export const staffAdminRoleCodes = new Set<RoleCode>([
  RoleCode.ADMIN,
  RoleCode.SUPER_ADMIN,
]);

export function canAccessAdmin(roleCode: RoleCode) {
  return adminRoleCodes.has(roleCode);
}

export function canAccessGeneralAdmin(roleCode: RoleCode) {
  return generalAdminRoleCodes.has(roleCode);
}

export function isCuttingManager(roleCode: RoleCode) {
  return roleCode === RoleCode.CUTTING_MANAGER;
}

export function isProductionManager(roleCode: RoleCode) {
  return roleCode === RoleCode.PRODUCTION_MANAGER;
}

export function isProductionOperator(roleCode: RoleCode) {
  return roleCode === RoleCode.PRODUCTION_OPERATOR;
}

export function canAccessProduction(roleCode: RoleCode) {
  return (
    canAccessGeneralAdmin(roleCode) ||
    isCuttingManager(roleCode) ||
    isProductionManager(roleCode) ||
    isProductionOperator(roleCode)
  );
}

export function canManageProduction(roleCode: RoleCode) {
  return (
    canAccessGeneralAdmin(roleCode) ||
    isCuttingManager(roleCode) ||
    isProductionManager(roleCode)
  );
}

export function canManageStaff(roleCode: RoleCode) {
  return staffAdminRoleCodes.has(roleCode);
}

export const staffAccessRoleCodes = [
  RoleCode.MANAGER,
  RoleCode.CUTTING_MANAGER,
  RoleCode.PRODUCTION_MANAGER,
  RoleCode.PRODUCTION_OPERATOR,
] as const;

export function canManageStaffAccess(
  actorRole: RoleCode,
  targetRole: RoleCode,
) {
  return (
    canManageStaff(actorRole) &&
    staffAccessRoleCodes.some((role) => role === targetRole)
  );
}

export function getAdminHomePath(roleCode: RoleCode) {
  return isProductionManager(roleCode) || isProductionOperator(roleCode)
    ? "/admin/production"
    : isCuttingManager(roleCode)
      ? "/admin/cutting"
      : "/admin";
}

export function canAccessAdminPath(roleCode: RoleCode, pathname: string) {
  if (!canAccessAdmin(roleCode)) {
    return false;
  }

  if (pathname === "/admin/staff" || pathname.startsWith("/admin/staff/")) {
    return canManageStaff(roleCode);
  }

  if (isProductionManager(roleCode) || isProductionOperator(roleCode)) {
    const isProductionPath =
      pathname === "/admin/production" ||
      pathname.startsWith("/admin/production/");

    if (isProductionPath) {
      return true;
    }

    return (
      isProductionManager(roleCode) &&
      /^\/admin\/requests\/[^/]+\/route-sheet\/?$/.test(pathname)
    );
  }

  if (!isCuttingManager(roleCode)) {
    return true;
  }

  if (
    pathname === "/admin/production" ||
    pathname.startsWith("/admin/production/")
  ) {
    return true;
  }

  if (pathname === "/admin/cutting" || pathname.startsWith("/admin/cutting/")) {
    return true;
  }

  return /^\/admin\/requests\/[^/]+(?:\/route-sheet)?\/?$/.test(pathname);
}

export function canAccessRequestType(
  roleCode: RoleCode,
  requestType: RequestType,
) {
  return (
    canAccessGeneralAdmin(roleCode) ||
    ((isCuttingManager(roleCode) || isProductionManager(roleCode)) &&
      requestType === RequestType.CUTTING_SERVICE)
  );
}

export function canDeleteOrders(roleCode: RoleCode) {
  return orderDeleteRoleCodes.has(roleCode);
}

export function canDeleteRequests(roleCode: RoleCode) {
  return requestDeleteRoleCodes.has(roleCode);
}
