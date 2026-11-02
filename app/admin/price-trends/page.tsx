import { CategoryKind } from "@/generated/prisma";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import {
  formatPriceTrendMonth,
  type PriceTrendMonth,
} from "@/features/admin/price-trends";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import {
  getPriceTrend,
  priceTrendPeriods,
  type PriceTrendFilters,
  type PriceTrendPeriod,
} from "@/lib/server/price-trends";

export const dynamic = "force-dynamic";

type PriceTrendsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const kindOptions: { value: PriceTrendFilters["kind"]; label: string }[] = [
  { value: CategoryKind.PLATE, label: "Плитные материалы (ЛДСП, МДФ…)" },
  { value: CategoryKind.FITTINGS, label: "Фурнитура" },
  { value: CategoryKind.OTHER, label: "Прочее" },
  { value: "ALL", label: "Все товары" },
];

const numberFormatter = new Intl.NumberFormat("ru-RU");

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

function formatChange(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${value.toLocaleString("ru-RU")}%`;
}

function changeClassName(value: number) {
  if (value > 0) {
    return "font-semibold text-[#a94730]";
  }

  if (value < 0) {
    return "font-semibold text-emerald-700";
  }

  return "text-[var(--muted)]";
}

function PriceIndexChart({ months }: { months: PriceTrendMonth[] }) {
  const points = months
    .map((month, index) => ({ ...month, position: index }))
    .filter((month) => month.index !== null);

  if (points.length < 2) {
    return (
      <p className="rounded-lg border border-[#ece8e2] bg-[#fbfaf8] p-5 text-sm leading-6 text-[#6e6b63]">
        Пока мало данных для графика: нужны товары, которые продавались хотя бы
        в двух разных месяцах выбранного периода.
      </p>
    );
  }

  const values = points.map((point) => point.index as number);
  const min = Math.min(...values, 100);
  const max = Math.max(...values, 100);
  const padding = Math.max((max - min) * 0.15, 2);
  const low = min - padding;
  const high = max + padding;
  const width = 640;
  const height = 220;
  const left = 44;
  const right = 12;
  const top = 12;
  const bottom = 28;
  const step = (width - left - right) / Math.max(months.length - 1, 1);
  const x = (position: number) => left + position * step;
  const y = (value: number) =>
    top + ((high - value) / (high - low)) * (height - top - bottom);
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${x(point.position).toFixed(1)},${y(point.index as number).toFixed(1)}`,
    )
    .join(" ");
  const ticks = [low + padding, 100, high - padding].filter(
    (value, index, all) =>
      all.findIndex((v) => Math.abs(v - value) < 1) === index,
  );
  const labelEvery = months.length > 12 ? 3 : months.length > 6 ? 2 : 1;

  return (
    <div className="rounded-lg border border-[#ece8e2] bg-[#fbfaf8] p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-[#1b1c19]">
        Индекс цены продажи (100 = цена в первый месяц продаж)
      </h3>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="График индекса цен продаж по месяцам"
        className="mt-3 h-auto w-full"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={Math.abs(tick - 100) < 0.01 ? "#bdb5a8" : "#e3ddd2"}
              strokeDasharray={Math.abs(tick - 100) < 0.01 ? "4 4" : undefined}
            />
            <text
              x={left - 6}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#8a857d"
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#a94730" strokeWidth="2.5" />
        {points.map((point) => (
          <circle
            key={point.key}
            cx={x(point.position)}
            cy={y(point.index as number)}
            r="4"
            fill="#a94730"
          >
            <title>
              {`${point.label}: ${point.index}, сравнено товаров: ${point.comparedProducts}`}
            </title>
          </circle>
        ))}
        {months.map((month, index) =>
          index % labelEvery === 0 || index === months.length - 1 ? (
            <text
              key={month.key}
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#8a857d"
            >
              {month.label}
            </text>
          ) : null,
        )}
      </svg>
      <p className="mt-2 text-xs leading-5 text-[#6e6b63]">
        Каждый товар сравнивается сам с собой, поэтому смена ассортимента не
        искажает картину. Наведите на точку, чтобы увидеть число товаров.
      </p>
    </div>
  );
}

export default async function AdminPriceTrendsPage({
  searchParams,
}: PriceTrendsPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Динамика цен заработает после подключения базы данных"
        description="Раздел строится по ценам в уже оформленных заказах."
        steps={["Добавьте DATABASE_URL в окружение."]}
      />
    );
  }

  await requireAdminSession(
    "/login?next=/admin/price-trends",
    "/admin/price-trends",
  );

  const params = searchParams ? await searchParams : {};
  const kindParam = readParam(params, "kind");
  const kind =
    kindOptions.find((option) => option.value === kindParam)?.value ??
    CategoryKind.PLATE;
  const monthsParam = Number(readParam(params, "months"));
  const months: PriceTrendPeriod = priceTrendPeriods.includes(
    monthsParam as PriceTrendPeriod,
  )
    ? (monthsParam as PriceTrendPeriod)
    : 12;
  const query = readParam(params, "q").slice(0, 80);

  const report = await getPriceTrend({ kind, months, query });
  const rising = report.products.filter((p) => p.changePercent > 0).length;
  const falling = report.products.filter((p) => p.changePercent < 0).length;

  const productRows = report.products.slice(0, 100).map((product) => ({
    name: (
      <div className="min-w-0">
        <p className="font-medium">{product.name}</p>
        {product.sku ? (
          <p className="text-xs text-[var(--muted)]">{product.sku}</p>
        ) : null}
      </div>
    ),
    first: `${numberFormatter.format(product.firstPrice)} сом · ${formatPriceTrendMonth(product.firstMonth)}`,
    last: `${numberFormatter.format(product.lastPrice)} сом · ${formatPriceTrendMonth(product.lastMonth)}`,
    change: (
      <span className={changeClassName(product.changePercent)}>
        {formatChange(product.changePercent)}
      </span>
    ),
    sold: `${numberFormatter.format(product.quantity)} шт · ${product.monthsSold} мес.`,
  }));

  const monthRows = report.months
    .filter((month) => month.lines > 0)
    .reverse()
    .map((month) => ({
      month: month.label,
      index: month.index === null ? "—" : month.index.toLocaleString("ru-RU"),
      compared: String(month.comparedProducts),
      lines: `${numberFormatter.format(month.lines)} строк · ${numberFormatter.format(month.quantity)} шт`,
    }));

  return (
    <div className="grid gap-6">
      <SectionHeading
        title="Динамика цен"
        description="Как менялась цена продажи товаров по уже оформленным заказам (без отменённых). Скидки клиентам не учитываются: берётся цена за единицу на момент заказа."
        titleClassName="text-2xl sm:text-3xl"
        descriptionClassName="text-sm leading-6"
      />

      <form className="grid gap-3 rounded-lg border border-[#ece8e2] bg-white p-4 sm:grid-cols-[1.2fr_0.8fr_1.4fr_auto] sm:items-end">
        <label className="grid gap-1.5 text-xs font-medium text-[var(--muted)]">
          Группа
          <Select name="kind" defaultValue={kind}>
            {kindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-[var(--muted)]">
          Период
          <Select name="months" defaultValue={String(months)}>
            {priceTrendPeriods.map((period) => (
              <option key={period} value={period}>
                {period} мес.
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-[var(--muted)]">
          Название или артикул
          <Input
            name="q"
            defaultValue={query}
            placeholder="Например: ЛДСП, Egger, белый"
          />
        </label>
        <Button type="submit">Показать</Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Изменение цены"
          value={formatChange(report.overallChangePercent)}
          detail="В среднем по товарам, с учётом проданного количества."
          tone={
            report.overallChangePercent === null
              ? "neutral"
              : report.overallChangePercent > 0
                ? "warning"
                : "success"
          }
        />
        <MetricCard
          label="Подорожали"
          value={rising}
          detail="Товаров, у которых последняя цена выше первой."
          tone="warning"
        />
        <MetricCard
          label="Подешевели"
          value={falling}
          detail="Товаров, у которых последняя цена ниже первой."
          tone="success"
        />
        <MetricCard
          label="Строк продаж"
          value={numberFormatter.format(report.totalLines)}
          detail={`За ${months} мес. В сравнении: ${report.products.length} товаров, проданных в 2+ месяцах.`}
          tone="neutral"
        />
      </div>

      <PriceIndexChart months={report.months} />

      <DataTable
        caption="Товары с самым большим изменением цены"
        columns={[
          { key: "name", label: "Товар" },
          { key: "first", label: "Первая цена" },
          { key: "last", label: "Последняя цена" },
          { key: "change", label: "Изменение" },
          { key: "sold", label: "Продано" },
        ]}
        rows={productRows}
        emptyMessage="Нет товаров, которые продавались хотя бы в двух разных месяцах периода."
      />

      <DataTable
        caption="По месяцам"
        columns={[
          { key: "month", label: "Месяц" },
          { key: "index", label: "Индекс" },
          { key: "compared", label: "Сравнено товаров" },
          { key: "lines", label: "Продажи" },
        ]}
        rows={monthRows}
        emptyMessage="За выбранный период продаж нет."
      />
    </div>
  );
}
