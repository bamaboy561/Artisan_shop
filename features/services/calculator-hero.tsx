import { FileUp, LayoutGrid, PencilRuler } from "lucide-react";

import type { SiteCuttingPrices } from "@/features/cutting/site-prices";

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

// Шапка страницы распила: цены и три способа начать. Сам расчёт — ниже,
// в калькуляторе, по шагам.
export function CalculatorHero({ prices }: { prices: SiteCuttingPrices }) {
  const sheetCheaper = prices.sheet < prices.sheetRegular;
  const edgeCheaper = prices.edge < prices.edgeRegular;

  return (
    <section className="border-b border-[color:var(--line)]">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-6 px-4 pt-8 pb-7 sm:px-8 sm:pt-12 sm:pb-9 lg:px-10">
        <div className="max-w-[46rem]">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
            Раскрой онлайн
          </p>
          <h1 className="mt-3 text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[2.6rem] lg:text-[3rem]">
            <span className="text-[var(--accent)]">
              Распил {priceFormatter.format(prices.sheet)} сом
            </span>{" "}
            за лист, кромка {priceFormatter.format(prices.edge)} сом за метр
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-[var(--muted)] sm:text-[15px]">
            {sheetCheaper || edgeCheaper ? (
              <>
                Через сайт дешевле
                {sheetCheaper ? (
                  <>
                    : обычно{" "}
                    <del>{priceFormatter.format(prices.sheetRegular)}</del> сом
                    за лист
                  </>
                ) : null}
                {edgeCheaper ? (
                  <>
                    {sheetCheaper ? " и " : ": обычно "}
                    <del>{priceFormatter.format(prices.edgeRegular)}</del> сом
                    за метр кромки
                  </>
                ) : null}
                .{" "}
              </>
            ) : null}
            Карта раскроя, листы и цена считаются сразу, точную сумму подтвердит
            менеджер.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <a
            href="#cut-calculator"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[15px] font-semibold text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)]"
          >
            <PencilRuler className="size-4" /> Ввести детали
          </a>
          <a
            href="#cut-import"
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[color:var(--line-strong)] px-5 text-[15px] font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]"
          >
            <FileUp className="size-4" /> Базис / Excel
          </a>
          <a
            href="#cabinet"
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[color:var(--line-strong)] px-5 text-[15px] font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]"
          >
            <LayoutGrid className="size-4" /> Собрать шкаф
          </a>
        </div>
      </div>
    </section>
  );
}
