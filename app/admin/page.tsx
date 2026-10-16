import { formatPrice } from "@/lib/commerce";
import Link from "next/link";
import Form from "next/form";
import type { ReactNode } from "react";
import {
  BarChart3,
  Box,
  CalendarRange,
  Calculator,
  FilePlus2,
  FileStack,
  Layers3,
  PackagePlus,
  ReceiptText,
  Scissors,
  TrendingUp,
  Users2,
  WalletCards,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { SalesChart } from "@/components/admin/sales-chart";
import { ExecutiveReportActions } from "@/components/admin/executive-report-actions";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { DataTable } from "@/components/ui/table";
import { OrderStatus, RequestStatus, RequestType } from "@/generated/prisma";
import { cuttingStageLabels } from "@/features/cutting/progress";
import { AdminSearchForm } from "@/components/admin/admin-search-form";
import { AttentionPanel } from "@/components/admin/attention-panel";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import {
  adminReportPeriodKeys,
  getAdminDashboardMetrics,
  getAdminExecutiveReport,
  getAdminOperationalQueues,
  getAdminStockMaterials,
  normalizeAdminReportPeriod,
  type AdminReportPeriodKey,
} from "@/lib/server/admin-data";
import {
  getLatestInventoryValuation,
  type LatestInventoryValuation,
} from "@/lib/server/inventory-valuation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const orderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.NEW]: "Новый",
  [OrderStatus.RESERVED]: "Бронь",
  [OrderStatus.CONFIRMED]: "Подтвержден",
  [OrderStatus.PAID]: "Оплачено",
  [OrderStatus.IN_PRODUCTION]: "В производстве",
  [OrderStatus.READY_FOR_PICKUP]: "Готов к выдаче",
  [OrderStatus.SHIPPED]: "Отгружен",
  [OrderStatus.COMPLETED]: "Завершен",
  [OrderStatus.CANCELED]: "Отменен",
};

const requestStatusLabels: Record<RequestStatus, string> = {
  [RequestStatus.NEW]: "Новая",
  [RequestStatus.IN_REVIEW]: "На расчете",
  [RequestStatus.QUOTE_SENT]: "КП отправлено",
  [RequestStatus.WAITING_FOR_CLIENT]: "Ждем клиента",
  [RequestStatus.IN_PROGRESS]: "В работе",
  [RequestStatus.COMPLETED]: "Завершена",
  [RequestStatus.CANCELED]: "Отменена",
};

const requestTypeLabels: Record<RequestType, string> = {
  [RequestType.PRICE_REQUEST]: "Запрос цены",
  [RequestType.CONSULTATION]: "Консультация",
  [RequestType.CUTTING_SERVICE]: "Распил",
  [RequestType.CUSTOM_SERVICE]: "Индивидуальная услуга",
};

const reportPeriodLabels: Record<AdminReportPeriodKey, string> = {
  today: "Сегодня",
  "7d": "7 дней",
  "30d": "30 дней",
  month: "Месяц",
};

function getFirstSearchValue(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatCurrency(value: number) {
  return formatPrice(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPeriodRange(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const inclusiveEnd = new Date(Math.max(start.getTime(), end.getTime() - 1));

  return `${formatter.format(start)} - ${formatter.format(inclusiveEnd)}`;
}

function formatDelta(value: number) {
  if (value > 0) return `+${value}%`;
  return `${value}%`;
}

function getDeltaClassName(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-700";
  return "text-[#6e6b63]";
}

function getOrderStatusTone(status: OrderStatus) {
  switch (status) {
    case OrderStatus.PAID:
    case OrderStatus.CONFIRMED:
    case OrderStatus.COMPLETED:
      return "success" as const;
    case OrderStatus.IN_PRODUCTION:
    case OrderStatus.READY_FOR_PICKUP:
    case OrderStatus.SHIPPED:
      return "accent" as const;
    case OrderStatus.CANCELED:
      return "neutral" as const;
    case OrderStatus.RESERVED:
    case OrderStatus.NEW:
    default:
      return "warning" as const;
  }
}

function getRequestStatusTone(status: RequestStatus) {
  switch (status) {
    case RequestStatus.COMPLETED:
      return "success" as const;
    case RequestStatus.IN_REVIEW:
    case RequestStatus.QUOTE_SENT:
    case RequestStatus.IN_PROGRESS:
      return "accent" as const;
    case RequestStatus.WAITING_FOR_CLIENT:
      return "warning" as const;
    case RequestStatus.CANCELED:
      return "neutral" as const;
    case RequestStatus.NEW:
    default:
      return "neutral" as const;
  }
}

function buildReportHref(period: AdminReportPeriodKey) {
  return period === "month" ? "/admin" : `/admin?period=${period}`;
}

function buildExecutiveReportText(
  report: Awaited<ReturnType<typeof getAdminExecutiveReport>>,
  inventoryValuation: LatestInventoryValuation | null,
) {
  const topClient = report.breakdown.topClients[0];
  const topBrand = report.breakdown.revenueByBrand[0];
  const topCategory = report.breakdown.revenueByCategory[0];
  const topProduct = report.breakdown.topProducts[0];

  return [
    `Отчет Artisan: ${report.period.label}`,
    `Период: ${formatPeriodRange(report.period.start, report.period.end)}`,
    `Сформировано: ${formatDateTime(report.generatedAt)}`,
    "",
    `Продажи: ${formatCurrency(report.sales.revenue)}`,
    `Заказы: ${formatNumber(report.sales.orderCount)} оплачиваемых из ${formatNumber(report.sales.allOrderCount)} всего`,
    `Средний чек: ${formatCurrency(report.sales.averageOrderTotal)}`,
    `Продано: ${formatNumber(report.sales.itemsSold)} ед., ${formatNumber(report.breakdown.soldProducts.length)} позиций, ${formatNumber(report.breakdown.revenueByBrand.length)} брендов`,
    `В работе: ${formatNumber(report.sales.activeOrders)}, завершено: ${formatNumber(report.sales.completedOrders)}, отменено: ${formatNumber(report.sales.canceledOrders)}`,
    `Скидки: ${formatCurrency(report.sales.discounts)}, оплата бонусами: ${formatCurrency(report.sales.loyaltyRedemptionTotal)}`,
    inventoryValuation
      ? `Сумма склада: ${formatCurrency(inventoryValuation.amount)}`
      : "Сумма склада: файл остатков еще не загружен",
    inventoryValuation
      ? `Источник склада: ${inventoryValuation.reportTitle ?? inventoryValuation.sourceFile}; загружено ${formatDateTime(inventoryValuation.importedAt)}`
      : null,
    "",
    `Клиенты: всего ${formatNumber(report.clients.total)}, новых за период ${formatNumber(report.clients.new)}, покупали ${formatNumber(report.clients.activeBuying)}, повторных ${formatNumber(report.clients.repeat)}`,
    `Telegram подключен: ${formatNumber(report.clients.telegramLinked)}`,
    `Бонусный баланс клиентов: ${formatNumber(report.clients.loyaltyBalance)} баллов`,
    "",
    `Заявки: ${formatNumber(report.requests.total)}, активные ${formatNumber(report.requests.active)}, распил ${formatNumber(report.requests.cutting)}`,
    `Распил: ${formatNumber(report.cuttingReport.totalSheets)} листов; количество заполнено в ${formatNumber(report.cuttingReport.sheetCountSpecified)} из ${formatNumber(report.cuttingReport.workloadRequests)} рабочих заявок`,
    topClient
      ? `Топ клиент: ${topClient.name} - ${formatCurrency(topClient.revenue)}`
      : "Топ клиент: данных пока нет",
    topBrand
      ? `Топ бренд: ${topBrand.name} - ${formatCurrency(topBrand.revenue)} (${topBrand.share}%)`
      : "Топ бренд: данных пока нет",
    topCategory
      ? `Топ направление: ${topCategory.name} - ${formatCurrency(topCategory.revenue)}`
      : "Топ направление: данных пока нет",
    topProduct
      ? `Топ товар: ${topProduct.name} - ${formatCurrency(topProduct.revenue)}`
      : "Топ товар: данных пока нет",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function buildCuttingReportText(
  report: Awaited<ReturnType<typeof getAdminExecutiveReport>>,
) {
  const materials = report.cuttingReport.materials.map(
    (material) =>
      `- ${material.name}: ${formatNumber(material.sheets)} листов, ${formatNumber(material.requests)} заявок${material.withoutCount > 0 ? `, без количества: ${formatNumber(material.withoutCount)}` : ""}`,
  );
  const edges = report.cuttingReport.edges.map(
    (edge) =>
      `- ${edge.name}: ${formatNumber(edge.meters)} м, ${formatNumber(edge.requests)} заявок${edge.withoutMeters > 0 ? `, без метража: ${formatNumber(edge.withoutMeters)}` : ""}`,
  );
  const requests = report.cuttingReport.items.map((request) => {
    const requestNumber = request.number ?? request.id.slice(0, 8);
    const stage = request.cuttingStage
      ? cuttingStageLabels[request.cuttingStage]
      : "Не запущен";
    const sheets = request.cuttingSheetCount
      ? `${formatNumber(request.cuttingSheetCount)} листов`
      : "количество не указано";
    const edgeMeters = request.cuttingEdgeMeters
      ? `${formatNumber(request.cuttingEdgeMeters)} м`
      : "метраж не указан";

    return `- ${requestNumber}: ${request.contactName}; ${request.material ?? "материал не указан"}; ${sheets}; кромка: ${request.edgeName ?? request.edgeOption ?? "не указана"}, ${edgeMeters}; сумма работ: ${request.quotedTotal !== null ? formatCurrency(request.quotedTotal) : "не рассчитана"}; ${stage}; ${requestStatusLabels[request.status]}`;
  });

  return [
    `Отчет по распилу Artisan: ${report.period.label}`,
    `Период: ${formatPeriodRange(report.period.start, report.period.end)}`,
    `Сформировано: ${formatDateTime(report.generatedAt)}`,
    "",
    `Заявок: ${formatNumber(report.cuttingReport.totalRequests)}`,
    `Сумма работ (без отменённых): ${formatCurrency(report.cuttingReport.totalAmount)}; рассчитано ${report.cuttingReport.amountSpecified} из ${report.cuttingReport.workloadRequests} заявок`,
    `Рабочих: ${formatNumber(report.cuttingReport.workloadRequests)}, активных: ${formatNumber(report.cuttingReport.activeRequests)}, завершено: ${formatNumber(report.cuttingReport.completedRequests)}, отменено: ${formatNumber(report.cuttingReport.canceledRequests)}`,
    `Листов: ${formatNumber(report.cuttingReport.totalSheets)}; количество заполнено в ${formatNumber(report.cuttingReport.sheetCountSpecified)} из ${formatNumber(report.cuttingReport.workloadRequests)} рабочих заявок`,
    `Кромка: ${formatNumber(report.cuttingReport.totalEdgeMeters)} м; тип заполнен в ${formatNumber(report.cuttingReport.edgeSpecified)} заявках, метраж в ${formatNumber(report.cuttingReport.edgeMetersSpecified)} заявках`,
    "",
    "Материалы:",
    ...(materials.length > 0 ? materials : ["- Данных пока нет"]),
    "",
    "Кромка:",
    ...(edges.length > 0 ? edges : ["- Данных пока нет"]),
    "",
    "Заявки:",
    ...(requests.length > 0 ? requests : ["- Заявок за период нет"]),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function escapeCsvCell(value: string | number) {
  const normalized = String(value).replaceAll('"', '""');
  return `"${normalized}"`;
}

function buildCuttingReportCsv(
  report: Awaited<ReturnType<typeof getAdminExecutiveReport>>,
) {
  const row = (...values: Array<string | number>) =>
    values.map(escapeCsvCell).join(";");
  const lines = [
    row("Отчет по распилу Artisan"),
    row("Период", formatPeriodRange(report.period.start, report.period.end)),
    row("Всего листов", report.cuttingReport.totalSheets),
    row("Всего кромки, м", report.cuttingReport.totalEdgeMeters),
    row("Сумма работ без отменённых, сом", report.cuttingReport.totalAmount),
    row("Заявок с рассчитанной суммой", report.cuttingReport.amountSpecified),
    "",
    row("МАТЕРИАЛЫ"),
    row("Материал / лист", "Листов", "Заявок", "Без количества"),
    ...report.cuttingReport.materials.map((material) =>
      row(
        material.name,
        material.sheets,
        material.requests,
        material.withoutCount,
      ),
    ),
    "",
    row("КРОМКА"),
    row("Тип кромки", "Пог. м", "Заявок", "Без метража"),
    ...report.cuttingReport.edges.map((edge) =>
      row(edge.name, edge.meters, edge.requests, edge.withoutMeters),
    ),
    "",
    row("ЗАЯВКИ"),
    row(
      "Дата",
      "Номер",
      "Клиент",
      "Материал / лист",
      "Листов",
      "Кромка",
      "Кромка, м",
      "Сумма работ, сом",
      "Этап",
      "Статус",
    ),
    ...report.cuttingReport.items.map((request) =>
      row(
        formatDateTime(request.createdAt),
        request.number ?? request.id.slice(0, 8),
        request.contactName,
        request.material ?? "Не указан",
        request.cuttingSheetCount ?? "Не указано",
        request.edgeName ?? request.edgeOption ?? "Не указана",
        request.cuttingEdgeMeters ?? "Не указано",
        request.quotedTotal ?? "Не рассчитана",
        request.cuttingStage
          ? cuttingStageLabels[request.cuttingStage]
          : "Не запущен",
        requestStatusLabels[request.status],
      ),
    ),
  ];

  return lines.join("\r\n");
}

function MiniChart() {
  return (
    <svg viewBox="0 0 180 44" className="mt-4 h-11 w-full text-[#c4532b]">
      <path
        d="M4 32 C 22 34, 28 34, 42 31 S 66 20, 83 25 S 108 36, 126 19 S 150 10, 176 13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <path
        d="M4 38 C 22 40, 28 40, 42 37 S 66 26, 83 31 S 108 42, 126 25 S 150 16, 176 19"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity="0.14"
        strokeWidth="8"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  chart = false,
  compactValue = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  chart?: boolean;
  compactValue?: boolean;
}) {
  return (
    <article className="min-w-0 rounded-[20px] border border-[#e3ddd2] bg-white p-3.5 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] text-[#6e6b63] sm:text-sm">{label}</span>
        <Icon
          className="size-5 shrink-0 text-[#c4532b] sm:size-6"
          strokeWidth={1.75}
        />
      </div>
      <p
        className={`mt-4 leading-tight font-semibold [overflow-wrap:anywhere] text-[#1b1c19] ${
          compactValue ? "text-base sm:text-xl" : "text-lg sm:text-[26px]"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-[#8a857d] sm:mt-3 sm:text-sm">{detail}</p>
      {chart ? <MiniChart /> : null}
    </article>
  );
}

function ReportStat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#ece8e2] bg-[#fbfaf8] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-[#8a857d]">{label}</p>
        <Icon className="size-5 shrink-0 text-[#c4532b]" strokeWidth={1.8} />
      </div>
      <p className="mt-3 text-lg leading-tight font-semibold [overflow-wrap:anywhere] text-[#1b1c19] sm:text-2xl">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-[#6e6b63]">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#e3ddd2] bg-white shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
      <div className="flex items-center justify-between gap-4 border-b border-[#e3ddd2] px-5 py-4">
        <h2 className="text-lg font-semibold text-[#1b1c19]">{title}</h2>
        {href && linkLabel ? (
          <Link
            href={href}
            className="text-sm font-medium text-[#c4532b] transition hover:text-[#9f4327]"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdminSession("/login?next=/admin", "/admin");

  if (!hasDatabaseUrl() && !isDemoModeEnabled()) {
    return (
      <SetupState
        title="Админка заработает после подключения PostgreSQL"
        description="Интерфейс уже готов для каталога, заказов, заявок и клиентов. Чтобы включить живые данные, подключите базу и выполните production bootstrap."
        steps={[
          "Скопируйте .env.example в .env и добавьте рабочий DATABASE_URL.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Запустите npm run prisma:bootstrap, чтобы создать роли, первого администратора и базовые настройки.",
        ]}
      />
    );
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const reportPeriod = normalizeAdminReportPeriod(
    getFirstSearchValue(resolvedSearchParams, "period"),
  );
  const reportFrom = getFirstSearchValue(resolvedSearchParams, "from");
  const reportTo = getFirstSearchValue(resolvedSearchParams, "to");

  const [metrics, queues, stockMaterials, executiveReport, inventoryValuation] =
    await Promise.all([
      getAdminDashboardMetrics(),
      getAdminOperationalQueues(),
      getAdminStockMaterials(),
      getAdminExecutiveReport(reportPeriod, {
        from: reportFrom,
        to: reportTo,
      }),
      getLatestInventoryValuation(),
    ]);

  const reportText = buildExecutiveReportText(
    executiveReport,
    inventoryValuation,
  );
  const cuttingReportText = buildCuttingReportText(executiveReport);
  const cuttingReportCsv = buildCuttingReportCsv(executiveReport);
  const orderRows = queues.recentOrders.map((order) => ({
    order: (
      <Link
        href={`/admin/orders/${order.id}`}
        className="font-medium text-[#1b1c19] transition hover:text-[#c4532b]"
      >
        {order.number ?? order.id.slice(0, 8)}
      </Link>
    ),
    client: order.contactName,
    status: (
      <StatusBadge tone={getOrderStatusTone(order.status)}>
        {orderStatusLabels[order.status]}
      </StatusBadge>
    ),
    date: formatDate(order.createdAt),
    total: formatCurrency(order.total),
  }));

  const requestRows = queues.recentRequests.map((request) => ({
    request: (
      <Link
        href={`/admin/requests/${request.id}`}
        className="font-medium text-[#1b1c19] transition hover:text-[#c4532b]"
      >
        {request.number ?? request.id.slice(0, 8)}
      </Link>
    ),
    client: request.contactName,
    status: (
      <StatusBadge tone={getRequestStatusTone(request.status)}>
        {requestStatusLabels[request.status]}
      </StatusBadge>
    ),
    created: formatDate(request.createdAt),
  }));

  const topClientRows = executiveReport.breakdown.topClients.map((client) => ({
    client: client.name,
    orders: formatNumber(client.orders),
    revenue: formatCurrency(client.revenue),
    average: formatCurrency(Math.round(client.revenue / client.orders)),
    lastOrder: formatDate(client.lastOrderAt),
  }));

  const categoryRows = executiveReport.breakdown.revenueByCategory.map(
    (category) => ({
      category: category.name,
      revenue: formatCurrency(category.revenue),
      quantity: formatNumber(category.quantity),
      share: `${category.share}%`,
    }),
  );

  const managerRows = executiveReport.breakdown.revenueByManager.map(
    (manager) => ({
      manager: manager.name,
      orders: formatNumber(manager.orders),
      average: formatCurrency(manager.averageOrder),
      revenue: formatCurrency(manager.revenue),
      share: `${manager.share}%`,
    }),
  );
  const brandRows = executiveReport.breakdown.revenueByBrand.map((brand) => ({
    brand: (
      <span className="block min-w-40">
        <span className="block font-medium text-[#1b1c19]">{brand.name}</span>
        <span className="text-xs text-[#8a857d]">
          {formatNumber(brand.products)} товаров
        </span>
      </span>
    ),
    quantity: formatNumber(brand.quantity),
    orders: formatNumber(brand.orders),
    revenue: formatCurrency(brand.revenue),
    share: `${brand.share}%`,
  }));

  const soldProductRows = executiveReport.breakdown.soldProducts.map(
    (product, index) => ({
      product: (
        <span className="block min-w-56">
          <span className="block font-medium text-[#1b1c19]">
            {index + 1}. {product.name}
          </span>
          <span className="text-xs text-[#8a857d]">
            {product.sku ?? "Без артикула"}
          </span>
        </span>
      ),
      brand: product.brand ?? "Без бренда",
      quantity: formatNumber(product.quantity),
      orders: formatNumber(product.orders),
      average: formatCurrency(product.averagePrice),
      revenue: formatCurrency(product.revenue),
      share: `${product.share}%`,
    }),
  );

  const orderStatusRows = executiveReport.breakdown.ordersByStatus.map(
    (item) => ({
      status: (
        <StatusBadge tone={getOrderStatusTone(item.status)}>
          {orderStatusLabels[item.status]}
        </StatusBadge>
      ),
      count: formatNumber(item.count),
      revenue: formatCurrency(item.revenue),
    }),
  );

  const requestStatusRows = executiveReport.breakdown.requestsByStatus.map(
    (item) => ({
      status: (
        <StatusBadge tone={getRequestStatusTone(item.status)}>
          {requestStatusLabels[item.status]}
        </StatusBadge>
      ),
      count: formatNumber(item.count),
    }),
  );

  const requestTypeRows = executiveReport.breakdown.requestsByType.map(
    (item) => ({
      type: requestTypeLabels[item.type],
      count: formatNumber(item.count),
    }),
  );

  const cuttingMaterialRows = executiveReport.cuttingReport.materials.map(
    (material) => ({
      material: (
        <span className="block min-w-56 font-medium text-[#1b1c19]">
          {material.name}
        </span>
      ),
      sheets: formatNumber(material.sheets),
      requests: formatNumber(material.requests),
      missing:
        material.withoutCount > 0 ? formatNumber(material.withoutCount) : "-",
    }),
  );

  const cuttingEdgeRows = executiveReport.cuttingReport.edges.map((edge) => ({
    edge: (
      <span className="block min-w-48 font-medium text-[#1b1c19]">
        {edge.name}
      </span>
    ),
    meters: `${formatNumber(edge.meters)} м`,
    requests: formatNumber(edge.requests),
    missing: edge.withoutMeters > 0 ? formatNumber(edge.withoutMeters) : "-",
  }));

  const cuttingRequestRows = executiveReport.cuttingReport.items.map(
    (request) => ({
      request: (
        <Link
          href={`/admin/requests/${request.id}`}
          className="font-medium text-[#1b1c19] transition hover:text-[#c4532b]"
        >
          {request.number ?? request.id.slice(0, 8)}
        </Link>
      ),
      client: request.contactName,
      material: request.material ?? "Не указан",
      amount:
        request.quotedTotal !== null
          ? formatCurrency(request.quotedTotal)
          : "Не рассчитана",
      sheets:
        request.cuttingSheetCount !== null
          ? `${formatNumber(request.cuttingSheetCount)} шт.`
          : "Не указано",
      edge: request.edgeName ?? request.edgeOption ?? "Не указана",
      edgeMeters:
        request.cuttingEdgeMeters !== null
          ? `${formatNumber(request.cuttingEdgeMeters)} м`
          : "Не указано",
      stage: request.cuttingStage
        ? cuttingStageLabels[request.cuttingStage]
        : "Не запущен",
      status: (
        <StatusBadge tone={getRequestStatusTone(request.status)}>
          {requestStatusLabels[request.status]}
        </StatusBadge>
      ),
      date: formatDate(request.createdAt),
    }),
  );

  const quickActions = [
    { href: "/admin/orders", label: "Новый заказ", icon: FilePlus2 },
    { href: "/admin/requests", label: "Запрос на расчет", icon: FileStack },
    { href: "/calculator", label: "Раскрой детали", icon: Calculator },
    { href: "/admin/products", label: "Добавить материал", icon: PackagePlus },
    { href: "/admin/categories", label: "Каталог", icon: Layers3 },
    { href: "/admin/users", label: "Добавить клиента", icon: Users2 },
  ];

  const stockMaterialRows = stockMaterials.map((product) => ({
    name: product.name,
    format: product.format ?? "",
    stock: product.stockQuantity ?? 0,
    swatch: product.images[0]?.url ?? "",
    updatedAt: product.updatedAt,
  }));

  return (
    <div className="space-y-5">
      <AdminSearchForm className="lg:hidden" />
      <AttentionPanel />
      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Выручка по заказам"
          value={formatCurrency(metrics.ordersRevenue)}
          detail="все неотмененные заказы"
          icon={ReceiptText}
        />
        <KpiCard
          label="Сумма склада"
          value={
            inventoryValuation
              ? formatCurrency(inventoryValuation.amount)
              : "Нет данных"
          }
          detail={
            inventoryValuation
              ? (inventoryValuation.reportTitle ??
                inventoryValuation.sourceFile)
              : "загрузите свежий файл цен и остатков"
          }
          icon={Warehouse}
          compactValue
        />
        <KpiCard
          label="Заказы в работе"
          value={metrics.openOrders}
          detail="активные производственные статусы"
          icon={PackagePlus}
        />
        <KpiCard
          label="Запросы на расчет"
          value={metrics.openRequests}
          detail="активные заявки клиентов"
          icon={Calculator}
        />
        <KpiCard
          label="Средний чек"
          value={formatCurrency(metrics.averageOrderTotal)}
          detail="по неотмененным заказам"
          icon={TrendingUp}
        />
        <KpiCard
          label="Клиенты"
          value={formatNumber(metrics.usersTotal)}
          detail="зарегистрированные аккаунты"
          icon={Users2}
        />
      </section>

      <section className="rounded-xl border border-[#e3ddd2] bg-white p-5 shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-medium text-[#8a857d]">
              Управленческий отчет
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1b1c19]">
              Клиенты и продажи для руководителя
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#6e6b63]">
              {executiveReport.period.label} ·{" "}
              {formatPeriodRange(
                executiveReport.period.start,
                executiveReport.period.end,
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {adminReportPeriodKeys.map((period) => (
              <Link
                key={period}
                href={buildReportHref(period)}
                className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition ${
                  period === executiveReport.period.key
                    ? "border-[#1b1c19] bg-[#1b1c19] text-white"
                    : "border-[#e3ddd2] bg-white text-[#5f5b55] hover:border-[#c4532b] hover:text-[#c4532b]"
                }`}
              >
                {reportPeriodLabels[period]}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-5">
          <ReportStat
            label="Продажи"
            value={formatCurrency(executiveReport.sales.revenue)}
            detail={`к прошлому периоду ${formatDelta(executiveReport.sales.revenueDeltaPercent)}`}
            icon={BarChart3}
          />
          <ReportStat
            label="Заказы"
            value={formatNumber(executiveReport.sales.orderCount)}
            detail={`к прошлому периоду ${formatDelta(executiveReport.sales.orderDeltaPercent)}`}
            icon={ReceiptText}
          />
          <ReportStat
            label="Новые клиенты"
            value={formatNumber(executiveReport.clients.new)}
            detail={`к прошлому периоду ${formatDelta(executiveReport.clients.newDeltaPercent)}`}
            icon={Users2}
          />
          <ReportStat
            label="Бонусный баланс"
            value={formatNumber(executiveReport.clients.loyaltyBalance)}
            detail={`${formatNumber(executiveReport.clients.telegramLinked)} клиентов подключили Telegram`}
            icon={WalletCards}
          />
          <ReportStat
            label="Бренды и товары"
            value={`${formatNumber(executiveReport.breakdown.revenueByBrand.length)} / ${formatNumber(executiveReport.breakdown.soldProducts.length)}`}
            detail={`${formatNumber(executiveReport.sales.itemsSold)} ед. продано за период`}
            icon={Box}
          />
        </div>

        <div className="mt-5">
          <SalesChart
            days={executiveReport.breakdown.dailySales}
            brands={executiveReport.breakdown.revenueByBrand}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <textarea
            readOnly
            value={reportText}
            className="min-h-72 w-full resize-y rounded-lg border border-[#e3ddd2] bg-[#fbfaf8] p-4 font-mono text-sm leading-6 text-[#1b1c19] outline-none"
          />
          <div className="flex flex-col justify-between gap-4 rounded-lg border border-[#ece8e2] bg-[#fbfaf8] p-4">
            <div className="space-y-3 text-sm leading-6 text-[#5f5b55]">
              <p>
                Отчет уже собран в формате, который можно отправить в Telegram
                или вставить в письмо руководителю.
              </p>
              <p>
                В расчет продаж входят все заказы периода кроме отмененных.
                Оплата бонусами и скидки вынесены отдельными строками.
              </p>
              <p
                className={`font-medium ${getDeltaClassName(executiveReport.sales.revenueDeltaPercent)}`}
              >
                Динамика выручки:{" "}
                {formatDelta(executiveReport.sales.revenueDeltaPercent)}
              </p>
            </div>
            <ExecutiveReportActions reportText={reportText} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden border border-[#e3ddd2] bg-white shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center bg-[#c4532b] text-white">
              <Scissors className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-xs font-medium text-[#8a857d]">
                Производственный отчет
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#1b1c19]">
                Распил, материалы и кромка
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#6e6b63]">
                {executiveReport.period.label} ·{" "}
                {formatPeriodRange(
                  executiveReport.period.start,
                  executiveReport.period.end,
                )}
                <span className="block text-xs text-[#8a857d]">
                  По дате создания заявки; отмененные заявки не входят в объем
                  материалов и кромки
                </span>
              </p>
            </div>
          </div>
          <ExecutiveReportActions
            reportText={cuttingReportText}
            csvContent={cuttingReportCsv}
            csvFileName={`artisan-cutting-${executiveReport.period.dateFrom}-${executiveReport.period.dateTo}.csv`}
          />
        </div>

        <Form
          action="/admin"
          className="grid gap-3 border-t border-[#e3ddd2] bg-[#fbfaf8] px-5 py-4 sm:grid-cols-[minmax(9rem,12rem)_minmax(9rem,12rem)_auto_auto] sm:items-end"
        >
          <label className="grid gap-1.5 text-xs font-medium text-[#5f5b55]">
            Дата с
            <input
              name="from"
              type="date"
              required
              defaultValue={executiveReport.period.dateFrom}
              className="h-10 min-w-0 rounded-lg border border-[#d8d3cc] bg-white px-3 text-sm text-[#1b1c19] transition outline-none focus:border-[#c4532b]"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-[#5f5b55]">
            Дата по
            <input
              name="to"
              type="date"
              required
              defaultValue={executiveReport.period.dateTo}
              className="h-10 min-w-0 rounded-lg border border-[#d8d3cc] bg-white px-3 text-sm text-[#1b1c19] transition outline-none focus:border-[#c4532b]"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1b1c19] px-4 text-sm font-medium text-white transition hover:bg-[#c4532b]"
          >
            <CalendarRange className="size-4" strokeWidth={1.9} />
            Сформировать
          </button>
          {executiveReport.period.key === "custom" ? (
            <Link
              href="/admin"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d8d3cc] bg-white px-4 text-sm font-medium text-[#5f5b55] transition hover:border-[#1b1c19] hover:text-[#1b1c19]"
            >
              Сбросить
            </Link>
          ) : null}
        </Form>

        <div className="grid border-y border-[#e3ddd2] bg-[#fbfaf8] md:grid-cols-2 md:divide-x md:divide-[#e3ddd2] xl:grid-cols-3">
          <div className="border-b border-[#e3ddd2] p-4">
            <p className="text-xs text-[#6e6b63]">Сумма работ без отменённых</p>
            <p className="mt-2 text-xl font-semibold break-words text-[#1b1c19]">
              {formatCurrency(executiveReport.cuttingReport.totalAmount)}
            </p>
            <p className="mt-1 text-xs text-[#8a857d]">
              Рассчитано: {executiveReport.cuttingReport.amountSpecified} /{" "}
              {executiveReport.cuttingReport.workloadRequests}
            </p>
          </div>
          <div className="border-b border-[#e3ddd2] p-4 xl:border-b-0">
            <p className="text-xs text-[#6e6b63]">Заявки на распил</p>
            <p className="mt-2 text-2xl font-semibold text-[#1b1c19]">
              {formatNumber(executiveReport.cuttingReport.totalRequests)}
            </p>
            <p className="mt-1 text-xs text-[#8a857d]">
              рабочих:{" "}
              {formatNumber(executiveReport.cuttingReport.workloadRequests)}
            </p>
          </div>
          <div className="border-b border-[#e3ddd2] p-4 xl:border-b-0">
            <p className="text-xs text-[#6e6b63]">Всего листов</p>
            <p className="mt-2 text-2xl font-semibold text-[#1b1c19]">
              {formatNumber(executiveReport.cuttingReport.totalSheets)}
            </p>
            <p className="mt-1 text-xs text-[#8a857d]">
              Заявок с количеством:{" "}
              {formatNumber(executiveReport.cuttingReport.sheetCountSpecified)}{" "}
              / {formatNumber(executiveReport.cuttingReport.workloadRequests)}
            </p>
          </div>
          <div className="border-b border-[#e3ddd2] p-4 md:border-b-0">
            <p className="text-xs text-[#6e6b63]">Сейчас в работе</p>
            <p className="mt-2 text-2xl font-semibold text-[#1b1c19]">
              {formatNumber(executiveReport.cuttingReport.activeRequests)}
            </p>
            <p className="mt-1 text-xs text-[#8a857d]">
              завершено:{" "}
              {formatNumber(executiveReport.cuttingReport.completedRequests)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-[#6e6b63]">Всего кромки</p>
            <p className="mt-2 text-2xl font-semibold text-[#1b1c19]">
              {formatNumber(executiveReport.cuttingReport.totalEdgeMeters)} м
            </p>
            <p className="mt-1 text-xs text-[#8a857d]">
              Заявок с метражом:{" "}
              {formatNumber(executiveReport.cuttingReport.edgeMetersSpecified)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-[#6e6b63]">Тип кромки указан</p>
            <p className="mt-2 text-2xl font-semibold text-[#1b1c19]">
              {formatNumber(executiveReport.cuttingReport.edgeSpecified)}
            </p>
            <p className="mt-1 text-xs text-[#8a857d]">
              Всего рабочих заявок:{" "}
              {formatNumber(executiveReport.cuttingReport.workloadRequests)}
            </p>
          </div>
        </div>

        <div className="grid 2xl:grid-cols-2 2xl:divide-x 2xl:divide-[#e3ddd2]">
          <div className="min-w-0 border-b border-[#e3ddd2] 2xl:border-b-0">
            <h3 className="border-b border-[#e3ddd2] px-5 py-3 text-sm font-semibold text-[#1b1c19]">
              Какие листы использованы
            </h3>
            <div className="max-h-80 overflow-y-auto">
              <DataTable
                caption="Материалы распила"
                variant="embedded"
                columns={[
                  { key: "material", label: "Материал / лист" },
                  { key: "sheets", label: "Листов" },
                  { key: "requests", label: "Заявок" },
                  { key: "missing", label: "Без кол-ва" },
                ]}
                rows={cuttingMaterialRows}
                emptyMessage="Материалы появятся после заявок на распил."
              />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="border-b border-[#e3ddd2] px-5 py-3 text-sm font-semibold text-[#1b1c19]">
              Использованная кромка
            </h3>
            <div className="max-h-80 overflow-y-auto">
              <DataTable
                caption="Кромка распила"
                variant="embedded"
                columns={[
                  { key: "edge", label: "Кромка" },
                  { key: "meters", label: "Пог. м" },
                  { key: "requests", label: "Заявок" },
                  { key: "missing", label: "Без метража" },
                ]}
                rows={cuttingEdgeRows}
                emptyMessage="Кромка появится после заполнения заявок."
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[#e3ddd2]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3ddd2] px-5 py-3">
            <h3 className="text-sm font-semibold text-[#1b1c19]">
              Все заявки периода
            </h3>
            <Link
              href="/admin/requests?type=CUTTING_SERVICE"
              className="text-sm font-medium text-[#c4532b] transition hover:text-[#9f4327]"
            >
              Открыть заявки
            </Link>
          </div>
          <div className="max-h-[34rem] overflow-y-auto">
            <DataTable
              caption="Детальный отчет по распилу"
              variant="embedded"
              columns={[
                { key: "request", label: "Заявка" },
                { key: "client", label: "Клиент" },
                { key: "material", label: "Материал" },
                { key: "sheets", label: "Листы" },
                { key: "edge", label: "Кромка" },
                { key: "edgeMeters", label: "Пог. м" },
                { key: "amount", label: "Сумма работ" },
                { key: "stage", label: "Этап" },
                { key: "status", label: "Статус" },
                { key: "date", label: "Дата" },
              ]}
              rows={cuttingRequestRows}
              emptyMessage="За выбранный период заявок на распил нет."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel
          title="Топ клиентов за период"
          href="/admin/users"
          linkLabel="Все клиенты"
        >
          <DataTable
            caption="Топ клиентов за период"
            variant="embedded"
            columns={[
              { key: "client", label: "Клиент" },
              { key: "orders", label: "Заказы" },
              { key: "revenue", label: "Выручка" },
              { key: "average", label: "Средний чек" },
              { key: "lastOrder", label: "Последний заказ" },
            ]}
            rows={topClientRows}
            emptyMessage="За выбранный период еще нет продаж по клиентам."
          />
        </Panel>

        <Panel title="Продажи по менеджерам">
          <DataTable
            caption="Продажи по менеджерам"
            variant="embedded"
            columns={[
              { key: "manager", label: "Менеджер" },
              { key: "orders", label: "Заказы" },
              { key: "average", label: "Средний чек" },
              { key: "revenue", label: "Выручка" },
              { key: "share", label: "Доля" },
            ]}
            rows={managerRows}
            emptyMessage="Появится после подтверждённых заказов за период."
          />
        </Panel>

        <Panel title="Продажи по брендам">
          <DataTable
            caption="Продажи по брендам"
            variant="embedded"
            columns={[
              { key: "brand", label: "Бренд" },
              { key: "quantity", label: "Кол-во" },
              { key: "orders", label: "Заказы" },
              { key: "revenue", label: "Выручка" },
              { key: "share", label: "Доля" },
            ]}
            rows={brandRows}
            emptyMessage="Бренды появятся после заказов с товарами."
          />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Продажи по направлениям">
          <DataTable
            caption="Продажи по направлениям"
            variant="embedded"
            columns={[
              { key: "category", label: "Направление" },
              { key: "revenue", label: "Выручка" },
              { key: "quantity", label: "Кол-во" },
              { key: "share", label: "Доля" },
            ]}
            rows={categoryRows}
            emptyMessage="Категории появятся после заказов с товарами."
          />
        </Panel>

        <Panel title="Статусы продаж">
          <DataTable
            caption="Статусы продаж"
            variant="embedded"
            columns={[
              { key: "status", label: "Статус" },
              { key: "count", label: "Кол-во" },
              { key: "revenue", label: "Выручка" },
            ]}
            rows={orderStatusRows}
            emptyMessage="Заказов за выбранный период нет."
          />
        </Panel>
      </section>

      <Panel title="Все проданные товары">
        <div className="max-h-[32rem] overflow-y-auto">
          <DataTable
            caption="Все проданные товары"
            variant="embedded"
            columns={[
              { key: "product", label: "Товар / артикул" },
              { key: "brand", label: "Бренд" },
              { key: "quantity", label: "Кол-во" },
              { key: "orders", label: "Заказы" },
              { key: "average", label: "Средняя цена" },
              { key: "revenue", label: "Выручка" },
              { key: "share", label: "Доля" },
            ]}
            rows={soldProductRows}
            emptyMessage="Проданные товары появятся после заказов с позициями."
          />
        </div>
      </Panel>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <Panel
          title="Последние заказы"
          href="/admin/orders"
          linkLabel="Все заказы"
        >
          <DataTable
            caption="Последние заказы"
            variant="embedded"
            columns={[
              { key: "order", label: "Заказ" },
              { key: "client", label: "Клиент" },
              { key: "status", label: "Статус" },
              { key: "date", label: "Дата" },
              { key: "total", label: "Сумма" },
            ]}
            rows={orderRows}
            emptyMessage="Первые заказы появятся здесь сразу после оформления через сайт."
          />
        </Panel>

        <Panel
          title="Последние заявки"
          href="/admin/requests"
          linkLabel="Все заявки"
        >
          <DataTable
            caption="Последние заявки"
            variant="embedded"
            columns={[
              { key: "request", label: "Заявка" },
              { key: "client", label: "Клиент" },
              { key: "status", label: "Статус" },
              { key: "created", label: "Создана" },
            ]}
            rows={requestRows}
            emptyMessage="Новые заявки и файлы клиентов появятся здесь."
          />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.35fr_1.1fr]">
        <Panel title="Быстрые действия">
          <div className="grid grid-cols-2 gap-3 p-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex min-h-20 items-center gap-3 rounded-xl border border-[#e3ddd2] bg-white px-4 py-3 text-sm font-medium text-[#1b1c19] transition hover:border-[#d2ccc4] hover:bg-[#faf8f5]"
                >
                  <Icon className="size-5 text-[#c4532b]" strokeWidth={1.75} />
                  <span>{action.label}</span>
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Заканчиваются на складе"
          href="/admin/products"
          linkLabel="Все товары"
        >
          <div className="divide-y divide-[#ece8e2] px-5">
            {stockMaterialRows.length > 0 ? (
              stockMaterialRows.map((material) => (
                <div
                  key={material.name}
                  className="grid grid-cols-[44px_minmax(0,1fr)_70px_70px] items-center gap-3 py-3.5 text-sm"
                >
                  <span
                    className="size-8 rounded-md border border-[#e3ddd2] bg-cover bg-center"
                    style={{
                      backgroundImage: material.swatch
                        ? `url(${material.swatch})`
                        : undefined,
                    }}
                  />
                  <span className="min-w-0 truncate font-medium text-[#1b1c19]">
                    {material.name}
                  </span>
                  <span className="truncate text-[#8a857d]">
                    {material.format || "-"}
                  </span>
                  <span className="text-right font-medium text-[#1b1c19]">
                    {formatNumber(material.stock)} шт.
                  </span>
                </div>
              ))
            ) : (
              <p className="py-5 text-sm text-[#8a857d]">
                Остатки пока не указаны в карточках товаров.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Заявки по типам">
          <div className="grid gap-4 p-4">
            <DataTable
              caption="Заявки по типам"
              variant="embedded"
              columns={[
                { key: "type", label: "Тип" },
                { key: "count", label: "Кол-во" },
              ]}
              rows={requestTypeRows}
              emptyMessage="Заявок за выбранный период нет."
            />
            <DataTable
              caption="Заявки по статусам"
              variant="embedded"
              columns={[
                { key: "status", label: "Статус" },
                { key: "count", label: "Кол-во" },
              ]}
              rows={requestStatusRows}
              emptyMessage="Заявок за выбранный период нет."
            />
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid overflow-hidden rounded-xl border border-[#e3ddd2] bg-white shadow-[0_18px_50px_rgba(30,28,25,0.04)] md:grid-cols-4">
          {[
            ["Производство", `${metrics.openOrders} заказов в работе`],
            [
              "Заявки на распил сегодня",
              `${metrics.cuttingRequestsToday} заявок`,
            ],
            ["Готово к выдаче", `${metrics.readyForPickupOrders} заказов`],
            ["Отгружено сегодня", `${metrics.shippedToday} заказов`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-b border-[#e3ddd2] px-5 py-4 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
            >
              <p className="text-sm text-[#8a857d]">{label}</p>
              <p className="mt-2 text-xl font-semibold text-[#1b1c19]">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[#e3ddd2] bg-white px-5 py-4 shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
          <div>
            <p className="text-sm text-[#8a857d]">Склад</p>
            <p className="mt-2 text-xl font-semibold text-[#1b1c19]">
              {formatNumber(metrics.activeProducts)} материалов
            </p>
          </div>
          <Box className="size-8 text-[#c4532b]" strokeWidth={1.6} />
        </div>
      </section>
    </div>
  );
}
