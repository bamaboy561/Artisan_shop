import { OrderStatus, RequestStatus, RequestType } from "@/generated/prisma";

type SearchParamValue = string | string[] | undefined;
type AdminSearchParams = Record<string, SearchParamValue>;

export const orderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.NEW]: "Новый",
  [OrderStatus.CONFIRMED]: "Подтвержден",
  [OrderStatus.IN_PRODUCTION]: "В производстве",
  [OrderStatus.READY_FOR_PICKUP]: "Готов к выдаче",
  [OrderStatus.SHIPPED]: "Отгружен",
  [OrderStatus.COMPLETED]: "Завершен",
  [OrderStatus.CANCELED]: "Отменен",
};

export const requestStatusLabels: Record<RequestStatus, string> = {
  [RequestStatus.NEW]: "Новая",
  [RequestStatus.IN_REVIEW]: "На расчете",
  [RequestStatus.QUOTE_SENT]: "КП отправлено",
  [RequestStatus.WAITING_FOR_CLIENT]: "Ждем клиента",
  [RequestStatus.IN_PROGRESS]: "В работе",
  [RequestStatus.COMPLETED]: "Завершена",
  [RequestStatus.CANCELED]: "Отменена",
};

export const requestTypeLabels: Record<RequestType, string> = {
  [RequestType.PRICE_REQUEST]: "Запрос цены",
  [RequestType.CONSULTATION]: "Консультация",
  [RequestType.CUTTING_SERVICE]: "Распил",
  [RequestType.CUSTOM_SERVICE]: "Индивидуальная услуга",
};

export type AdminAssignmentFilter = "all" | "assigned" | "unassigned";

export type AdminOrderSort = "updated-desc" | "created-desc" | "total-desc";
export type AdminOrderFilterState = {
  q: string;
  status: OrderStatus | "all";
  managerId: string;
  assignment: AdminAssignmentFilter;
  delivery: "all" | "delivery" | "pickup";
  sort: AdminOrderSort;
};

export type AdminRequestSort =
  | "updated-desc"
  | "created-desc"
  | "budget-desc"
  | "files-desc";
export type AdminRequestFilterState = {
  q: string;
  status: RequestStatus | "all";
  type: RequestType | "all";
  managerId: string;
  assignment: AdminAssignmentFilter;
  files: "all" | "with-files" | "without-files";
  sort: AdminRequestSort;
};

export type AdminOrderItem = {
  id: string;
  userId?: string | null;
  number: string | null;
  status: OrderStatus;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  companyName: string | null;
  deliveryMethodId: string | null;
  appliedPromoCode: string | null;
  loyaltyRedemptionTotal: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
  user: {
    companyName: string | null;
  } | null;
  manager: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  deliveryMethod: {
    name: string;
  } | null;
  _count: {
    items: number;
  };
};

export type AdminRequestItem = {
  id: string;
  userId?: string | null;
  number: string | null;
  type: RequestType;
  status: RequestStatus;
  subject: string;
  message: string | null;
  material: string | null;
  edgeOption: string | null;
  estimatedBudget: number | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  messengerType?: string | null;
  messengerHandle?: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerId: string | null;
  deliveryNeeded: boolean;
  product: {
    name: string;
    sku: string;
  } | null;
  manager: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  _count: {
    files: number;
  };
};

export const activeOrderStatuses = new Set<OrderStatus>([
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.SHIPPED,
]);

export const activeRequestStatuses = new Set<RequestStatus>([
  RequestStatus.NEW,
  RequestStatus.IN_REVIEW,
  RequestStatus.QUOTE_SENT,
  RequestStatus.WAITING_FOR_CLIENT,
  RequestStatus.IN_PROGRESS,
]);

export const adminOrderSortOptions: Array<{
  value: AdminOrderSort;
  label: string;
}> = [
  { value: "updated-desc", label: "Сначала обновленные" },
  { value: "created-desc", label: "Сначала новые" },
  { value: "total-desc", label: "Сумма: по убыванию" },
];

export const adminRequestSortOptions: Array<{
  value: AdminRequestSort;
  label: string;
}> = [
  { value: "updated-desc", label: "Сначала обновленные" },
  { value: "created-desc", label: "Сначала новые" },
  { value: "budget-desc", label: "Бюджет: по убыванию" },
  { value: "files-desc", label: "Сначала с файлами" },
];

function getFirstSearchValue(searchParams: AdminSearchParams, key: string) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const validAssignmentFilters = new Set<AdminAssignmentFilter>([
  "all",
  "assigned",
  "unassigned",
]);

const validOrderSorts = new Set<AdminOrderSort>([
  "updated-desc",
  "created-desc",
  "total-desc",
]);

const validRequestSorts = new Set<AdminRequestSort>([
  "updated-desc",
  "created-desc",
  "budget-desc",
  "files-desc",
]);

export function getManagerDisplayName(manager: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return (
    [manager.firstName, manager.lastName].filter(Boolean).join(" ") ||
    manager.email
  );
}

export function parseAdminOrderSearchParams(
  searchParams: AdminSearchParams,
): AdminOrderFilterState {
  const statusCandidate = getFirstSearchValue(searchParams, "status");
  const assignmentCandidate = getFirstSearchValue(searchParams, "assignment");
  const deliveryCandidate = getFirstSearchValue(searchParams, "delivery");
  const sortCandidate = getFirstSearchValue(searchParams, "sort");

  return {
    q: getFirstSearchValue(searchParams, "q").trim(),
    status:
      Object.values(OrderStatus).find((item) => item === statusCandidate) ??
      "all",
    managerId: getFirstSearchValue(searchParams, "managerId").trim(),
    assignment: validAssignmentFilters.has(
      assignmentCandidate as AdminAssignmentFilter,
    )
      ? (assignmentCandidate as AdminAssignmentFilter)
      : "all",
    delivery:
      deliveryCandidate === "delivery" || deliveryCandidate === "pickup"
        ? deliveryCandidate
        : "all",
    sort: validOrderSorts.has(sortCandidate as AdminOrderSort)
      ? (sortCandidate as AdminOrderSort)
      : "updated-desc",
  };
}

export function sanitizeAdminOrderFilterState(
  state: AdminOrderFilterState,
  managers: Array<{ id: string }>,
) {
  const validManagerIds = new Set(managers.map((manager) => manager.id));

  return {
    ...state,
    managerId: validManagerIds.has(state.managerId) ? state.managerId : "",
  };
}

export function filterAdminOrders(
  orders: AdminOrderItem[],
  state: AdminOrderFilterState,
) {
  const query = normalizeSearchValue(state.q);

  return orders.filter((order) => {
    if (state.status !== "all" && order.status !== state.status) {
      return false;
    }

    if (state.managerId && order.managerId !== state.managerId) {
      return false;
    }

    if (state.assignment === "assigned" && !order.managerId) {
      return false;
    }

    if (state.assignment === "unassigned" && order.managerId) {
      return false;
    }

    if (state.delivery === "delivery" && !order.deliveryMethodId) {
      return false;
    }

    if (state.delivery === "pickup" && order.deliveryMethodId) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchText = normalizeSearchValue(
      [
        order.number ?? "",
        order.contactName,
        order.contactPhone,
        order.contactEmail ?? "",
        order.companyName ?? "",
        order.user?.companyName ?? "",
        order.deliveryMethod?.name ?? "",
        order.appliedPromoCode ?? "",
      ].join(" "),
    );

    return searchText.includes(query);
  });
}

export function sortAdminOrders(
  orders: AdminOrderItem[],
  sort: AdminOrderSort,
) {
  const sorted = [...orders];

  switch (sort) {
    case "created-desc":
      return sorted.sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    case "total-desc":
      return sorted.sort((left, right) => right.total - left.total);
    case "updated-desc":
    default:
      return sorted.sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      );
  }
}

export function buildAdminOrdersHref(
  basePath: string,
  state: AdminOrderFilterState,
) {
  const params = new URLSearchParams();

  if (state.q.trim()) {
    params.set("q", state.q.trim());
  }

  if (state.status !== "all") {
    params.set("status", state.status);
  }

  if (state.managerId) {
    params.set("managerId", state.managerId);
  }

  if (state.assignment !== "all") {
    params.set("assignment", state.assignment);
  }

  if (state.delivery !== "all") {
    params.set("delivery", state.delivery);
  }

  if (state.sort !== "updated-desc") {
    params.set("sort", state.sort);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function parseAdminRequestSearchParams(
  searchParams: AdminSearchParams,
): AdminRequestFilterState {
  const statusCandidate = getFirstSearchValue(searchParams, "status");
  const typeCandidate = getFirstSearchValue(searchParams, "type");
  const assignmentCandidate = getFirstSearchValue(searchParams, "assignment");
  const filesCandidate = getFirstSearchValue(searchParams, "files");
  const sortCandidate = getFirstSearchValue(searchParams, "sort");

  return {
    q: getFirstSearchValue(searchParams, "q").trim(),
    status:
      Object.values(RequestStatus).find((item) => item === statusCandidate) ??
      "all",
    type:
      Object.values(RequestType).find((item) => item === typeCandidate) ??
      "all",
    managerId: getFirstSearchValue(searchParams, "managerId").trim(),
    assignment: validAssignmentFilters.has(
      assignmentCandidate as AdminAssignmentFilter,
    )
      ? (assignmentCandidate as AdminAssignmentFilter)
      : "all",
    files:
      filesCandidate === "with-files" || filesCandidate === "without-files"
        ? filesCandidate
        : "all",
    sort: validRequestSorts.has(sortCandidate as AdminRequestSort)
      ? (sortCandidate as AdminRequestSort)
      : "updated-desc",
  };
}

export function sanitizeAdminRequestFilterState(
  state: AdminRequestFilterState,
  managers: Array<{ id: string }>,
) {
  const validManagerIds = new Set(managers.map((manager) => manager.id));

  return {
    ...state,
    managerId: validManagerIds.has(state.managerId) ? state.managerId : "",
  };
}

export function filterAdminRequests(
  requests: AdminRequestItem[],
  state: AdminRequestFilterState,
) {
  const query = normalizeSearchValue(state.q);

  return requests.filter((request) => {
    if (state.status !== "all" && request.status !== state.status) {
      return false;
    }

    if (state.type !== "all" && request.type !== state.type) {
      return false;
    }

    if (state.managerId && request.managerId !== state.managerId) {
      return false;
    }

    if (state.assignment === "assigned" && !request.managerId) {
      return false;
    }

    if (state.assignment === "unassigned" && request.managerId) {
      return false;
    }

    if (state.files === "with-files" && request._count.files === 0) {
      return false;
    }

    if (state.files === "without-files" && request._count.files > 0) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchText = normalizeSearchValue(
      [
        request.number ?? "",
        request.subject,
        request.message ?? "",
        request.contactName,
        request.contactPhone,
        request.contactEmail ?? "",
        request.material ?? "",
        request.product?.name ?? "",
        request.product?.sku ?? "",
        request.edgeOption ?? "",
      ].join(" "),
    );

    return searchText.includes(query);
  });
}

export function sortAdminRequests(
  requests: AdminRequestItem[],
  sort: AdminRequestSort,
) {
  const sorted = [...requests];

  switch (sort) {
    case "created-desc":
      return sorted.sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    case "budget-desc":
      return sorted.sort(
        (left, right) =>
          (right.estimatedBudget ?? Number.NEGATIVE_INFINITY) -
          (left.estimatedBudget ?? Number.NEGATIVE_INFINITY),
      );
    case "files-desc":
      return sorted.sort(
        (left, right) => right._count.files - left._count.files,
      );
    case "updated-desc":
    default:
      return sorted.sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      );
  }
}

export function buildAdminRequestsHref(
  basePath: string,
  state: AdminRequestFilterState,
) {
  const params = new URLSearchParams();

  if (state.q.trim()) {
    params.set("q", state.q.trim());
  }

  if (state.status !== "all") {
    params.set("status", state.status);
  }

  if (state.type !== "all") {
    params.set("type", state.type);
  }

  if (state.managerId) {
    params.set("managerId", state.managerId);
  }

  if (state.assignment !== "all") {
    params.set("assignment", state.assignment);
  }

  if (state.files !== "all") {
    params.set("files", state.files);
  }

  if (state.sort !== "updated-desc") {
    params.set("sort", state.sort);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
