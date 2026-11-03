import { CuttingStage, ProductionStation } from "@/generated/prisma";

export const productionPageSize = 25;
export const productionTimeZone = "Asia/Bishkek";
export type ProductionScope = "all" | ProductionStation | "READY_FOR_PICKUP";
export type ProductionFilters = {
  q: string;
  station: ProductionScope;
  from: string;
  to: string;
  sort: "priority" | "created-asc" | "created-desc" | "due-asc";
  due: "all" | "overdue" | "today" | "unplanned";
  flag: "all" | "urgent" | "problem";
  page: number;
};
type Params = Record<string, string | string[] | undefined>;

export function validDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "2000-01-01" ||
    value > "2100-12-31"
  )
    return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : "";
}

export function productionDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: productionTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Норма цеха: распил готов не позже чем через 7 дней после заявки.
export const standardCuttingDays = 7;

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function standardCuttingDueDate(createdAt: Date) {
  return addDaysToDateKey(productionDateKey(createdAt), standardCuttingDays);
}

export function productionDateBounds(from: string, to: string) {
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00+06:00`) } : {}),
    ...(to
      ? {
          lt: new Date(new Date(`${to}T00:00:00+06:00`).getTime() + 86_400_000),
        }
      : {}),
  };
}

export function parseProductionFilters(
  params: Params,
  assignedStation?: ProductionStation | null,
): ProductionFilters {
  const get = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const station = get("station");
  let from = validDate(get("from"));
  let to = validDate(get("to"));
  if (from && to && from > to) [from, to] = [to, from];
  const page = Number(get("page"));
  const sort = get("sort");
  const due = get("due");
  const flag = get("flag");
  return {
    q: get("q").trim().slice(0, 120),
    station:
      assignedStation ??
      (["CUTTING", "EDGING", "DRILLING", "READY_FOR_PICKUP"].includes(station)
        ? (station as ProductionScope)
        : "all"),
    from,
    to,
    // По умолчанию: срочные сверху, затем по сроку, затем старые.
    sort:
      sort === "created-asc" || sort === "created-desc" || sort === "due-asc"
        ? sort
        : "priority",
    due:
      due === "overdue" || due === "today" || due === "unplanned" ? due : "all",
    flag: flag === "urgent" || flag === "problem" ? flag : "all",
    page:
      Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1_000_000) : 1,
  };
}

export function productionQueueUrl(
  filters: ProductionFilters,
  patch: Partial<ProductionFilters> = {},
) {
  const values = { ...filters, ...patch };
  const params = new URLSearchParams();
  for (const key of [
    "q",
    "station",
    "from",
    "to",
    "sort",
    "due",
    "flag",
    "page",
  ] as const) {
    const value = String(values[key]);
    if (
      value &&
      value !== "all" &&
      !(key === "page" && value === "1") &&
      !(key === "sort" && value === "priority")
    )
      params.set(key, value);
  }
  return `/admin/production${params.size ? `?${params}` : ""}`;
}

export const productionBoardPath = "/admin/production/board";

export function safeProductionReturn(value: string) {
  if (value === productionBoardPath) return productionBoardPath;
  if (!/^\/admin\/production(?:\?|$)/.test(value)) return "/admin/production";
  return productionQueueUrl(
    parseProductionFilters(
      Object.fromEntries(
        new URL(value, "https://artisan.invalid").searchParams,
      ),
    ),
  );
}

export function productionScopeForStage(
  stage: CuttingStage | null,
): Exclude<ProductionScope, "all"> {
  if (
    stage === CuttingStage.EDGING ||
    stage === CuttingStage.DRILLING ||
    stage === CuttingStage.READY_FOR_PICKUP
  )
    return stage;
  return ProductionStation.CUTTING;
}

export function getProductionPage(total: number, requestedPage: number) {
  const pages = Math.max(1, Math.ceil(total / productionPageSize));
  const page = Math.max(1, Math.min(requestedPage, pages));
  return { page, pages, skip: (page - 1) * productionPageSize };
}

export function isProductionOverdue(
  dueDate: string | null,
  stage: CuttingStage | null,
  today: string,
) {
  return Boolean(
    dueDate && dueDate < today && stage !== CuttingStage.READY_FOR_PICKUP,
  );
}
