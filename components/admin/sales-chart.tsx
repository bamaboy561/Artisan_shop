type DailySale = {
  date: string;
  revenue: number;
  orders: number;
};

type BrandSale = {
  name: string;
  revenue: number;
  share: number;
};

const numberFormatter = new Intl.NumberFormat("ru-RU");

function formatDay(date: string) {
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
}

export function SalesChart({
  days,
  brands,
}: {
  days: DailySale[];
  brands: BrandSale[];
}) {
  const maxRevenue = Math.max(...days.map((day) => day.revenue), 0);
  const bestDay = days.reduce<DailySale | null>(
    (best, day) => (!best || day.revenue > best.revenue ? day : best),
    null,
  );
  const chartHeight = 160;
  const step = 100 / Math.max(days.length, 1);
  const topBrands = brands.slice(0, 6);
  const maxBrandRevenue = Math.max(...topBrands.map((b) => b.revenue), 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-lg border border-[#ece8e2] bg-[#fbfaf8] p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#1b1c19]">
            Выручка по дням
          </h3>
          {bestDay && bestDay.revenue > 0 ? (
            <p className="text-xs text-[#6e6b63]">
              Лучший день: {formatDay(bestDay.date)},{" "}
              {numberFormatter.format(bestDay.revenue)} сом
            </p>
          ) : null}
        </div>

        {maxRevenue > 0 ? (
          <>
            <svg
              viewBox={`0 0 100 ${chartHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="График выручки по дням"
              className="mt-4 h-44 w-full"
            >
              {[0.25, 0.5, 0.75, 1].map((line) => (
                <line
                  key={line}
                  x1="0"
                  x2="100"
                  y1={chartHeight - line * (chartHeight - 8)}
                  y2={chartHeight - line * (chartHeight - 8)}
                  stroke="#e3ddd2"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {days.map((day, index) => {
                const height =
                  day.revenue > 0
                    ? Math.max(
                        (day.revenue / maxRevenue) * (chartHeight - 8),
                        2,
                      )
                    : 0;

                return (
                  <rect
                    key={day.date}
                    x={index * step + step * 0.15}
                    y={chartHeight - height}
                    width={step * 0.7}
                    height={height}
                    fill={day.date === bestDay?.date ? "#a94730" : "#d8a391"}
                  >
                    <title>
                      {`${formatDay(day.date)}: ${numberFormatter.format(day.revenue)} сом, заказов: ${day.orders}`}
                    </title>
                  </rect>
                );
              })}
            </svg>
            <div className="mt-2 flex justify-between text-[11px] text-[#8a857d]">
              <span>{formatDay(days[0].date)}</span>
              <span>макс. {numberFormatter.format(maxRevenue)} сом</span>
              <span>{formatDay(days[days.length - 1].date)}</span>
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm leading-6 text-[#6e6b63]">
            За выбранный период подтверждённых продаж нет.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[#ece8e2] bg-[#fbfaf8] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-[#1b1c19]">
          Продажи по брендам
        </h3>
        {topBrands.length > 0 ? (
          <ul className="mt-4 grid gap-3">
            {topBrands.map((brand) => (
              <li key={brand.name} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-[#1b1c19]">
                    {brand.name}
                  </span>
                  <span className="shrink-0 text-[#5f5b55]">
                    {numberFormatter.format(brand.revenue)} сом · {brand.share}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#ece8e2]">
                  <div
                    className="h-full rounded-full bg-[#a94730]"
                    style={{
                      width: `${maxBrandRevenue > 0 ? Math.max((brand.revenue / maxBrandRevenue) * 100, 2) : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm leading-6 text-[#6e6b63]">
            Продажи по брендам появятся после первых заказов за период.
          </p>
        )}
      </div>
    </div>
  );
}
