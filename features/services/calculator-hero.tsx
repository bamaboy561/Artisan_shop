import {
  ArrowRight,
  LayoutGrid,
  PencilLine,
  Upload,
  type LucideIcon,
} from "lucide-react";

import type { SiteCuttingPrices } from "@/features/cutting/site-prices";

import s from "./calculator-hero.module.css";

// Детали на листе 2800 × 2070 в масштабе иллюстрации: x, y, ширина, высота.
const parts = [
  { x: 24, y: 24, w: 214, h: 150, label: "720 × 560", tone: "#c9a27c" },
  { x: 244, y: 24, w: 214, h: 150, label: "720 × 560", tone: "#c9a27c" },
  { x: 24, y: 180, w: 150, h: 176, label: "500 × 600", tone: "#b98b62" },
  { x: 180, y: 180, w: 150, h: 176, label: "500 × 600", tone: "#b98b62" },
  { x: 336, y: 180, w: 122, h: 86, label: "400 × 300", tone: "#d8b896" },
  { x: 336, y: 272, w: 122, h: 84, label: "400 × 300", tone: "#d8b896" },
  { x: 464, y: 24, w: 72, h: 242, label: "", tone: "#a97850" },
];

const cuts = [
  "M20 177 H461",
  "M241 20 V177",
  "M461 20 V360",
  "M177 177 V360",
  "M333 177 V360",
  "M333 269 H461",
];

function PriceInline({
  label,
  price,
  regular,
  unit,
}: {
  label: string;
  price: number;
  regular: number;
  unit: string;
}) {
  return (
    <span className="whitespace-nowrap">
      {label}{" "}
      <strong className="font-[family-name:var(--font-unbounded)] text-base font-semibold text-white sm:text-lg">
        {price}
      </strong>{" "}
      {unit} <del className="text-white/50">{regular}</del>
    </span>
  );
}

function StartOption({
  href,
  icon: Icon,
  title,
  hint,
  primary = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      className={
        primary
          ? "flex min-h-14 items-center gap-3.5 rounded-[14px] bg-[#c4532b] px-4 py-3 text-white transition hover:bg-[#a8431f]"
          : "flex min-h-14 items-center gap-3.5 rounded-[14px] border border-[rgba(27,28,25,0.22)] px-4 py-3 transition hover:border-[#c4532b]"
      }
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="text-[15px]">{title}</strong>
        <span
          className={
            primary ? "text-[13px] text-white/85" : "text-[13px] text-[#6e6b63]"
          }
        >
          {hint}
        </span>
      </span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
    </a>
  );
}

export function CalculatorHero({ prices }: { prices: SiteCuttingPrices }) {
  return (
    <>
      <section className={s.hero}>
        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-6 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-14 lg:px-10 lg:py-16">
          <div>
            <h1
              className={`${s.heroTitle} text-[1.45rem] sm:text-[2.2rem] xl:text-[2.8rem]`}
            >
              Соберите раскрой сами.
              <br />
              <em>Это быстрее и дешевле.</em>
            </h1>
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-white/75 sm:text-sm">
              <PriceInline
                label="Распил"
                price={prices.sheet}
                regular={prices.sheetRegular}
                unit="сом/лист"
              />
              <PriceInline
                label="Кромка"
                price={prices.edge}
                regular={prices.edgeRegular}
                unit="сом/м"
              />
            </p>

            {/* Один выбор вместо четырёх равных кнопок: клиент начинает
                расчёт уже на первом экране. */}
            <div className="mt-5 max-w-[34rem] rounded-[18px] bg-white p-4 text-[#1b1c19] shadow-[0_18px_40px_rgba(0,0,0,0.25)] sm:p-5">
              <h2 className="text-[17px] font-bold">С чего начнём?</h2>
              <div className="mt-3 grid gap-2.5">
                <StartOption
                  href="#cut-calculator"
                  icon={PencilLine}
                  title="Ввести детали"
                  hint="Размеры, количество, кромка"
                  primary
                />
                <StartOption
                  href="#cut-import"
                  icon={Upload}
                  title="Загрузить список"
                  hint="Фото, Excel, проект Базиса или SketchUp"
                />
                <StartOption
                  href="#cabinet"
                  icon={LayoutGrid}
                  title="Собрать шкаф по размерам"
                  hint="Детали посчитаются сами"
                />
              </div>
              <a
                href="/bazis"
                className="mt-3 inline-flex min-h-11 items-center text-[13px] text-[#6e6b63] underline underline-offset-2 hover:text-[#1b1c19]"
              >
                Есть проект Базиса? Откройте макет и детали
              </a>
            </div>

            <ol
              aria-label="Шаги расчёта"
              className="mt-5 grid max-w-[34rem] grid-cols-4 gap-1.5 text-center text-[12px] font-semibold text-white/80"
            >
              {["Материал", "Детали", "Раскрой", "Заявка"].map(
                (label, index) => (
                  <li key={label} className="flex flex-col items-center gap-1.5">
                    <span className="flex size-7 items-center justify-center rounded-full border border-white/30 text-[12px]">
                      {index + 1}
                    </span>
                    {label}
                  </li>
                ),
              )}
            </ol>
            <p className="mt-3 text-xs text-white/60">
              Цены для заявок, собранных на сайте. Точную сумму подтвердит
              менеджер.
            </p>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[620px] sm:block">
            <svg
              viewBox="0 0 560 380"
              role="img"
              aria-label="Пример карты раскроя листа на детали"
              className={`${s.board} h-auto w-full`}
            >
              <rect
                x="20"
                y="20"
                width="520"
                height="340"
                rx="6"
                fill="#efe6d8"
              />
              <rect
                x="464"
                y="272"
                width="72"
                height="84"
                fill="none"
                stroke="#b8ab97"
                strokeDasharray="5 5"
              />
              <text
                x="500"
                y="318"
                textAnchor="middle"
                fontSize="10"
                fill="#9a8d79"
              >
                остаток
              </text>
              {parts.map((part, index) => (
                <g
                  key={`${part.x}-${part.y}`}
                  className={s.part}
                  style={{ animationDelay: `${index * 0.18}s` }}
                >
                  <rect
                    x={part.x}
                    y={part.y}
                    width={part.w}
                    height={part.h}
                    rx="3"
                    fill={part.tone}
                  />
                  {part.label ? (
                    <text
                      x={part.x + part.w / 2}
                      y={part.y + part.h / 2 + 4}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="600"
                      fill="#3b2a1c"
                    >
                      {part.label}
                    </text>
                  ) : null}
                </g>
              ))}
              {cuts.map((path, index) => (
                <path
                  key={path}
                  d={path}
                  className={s.cut}
                  style={{ animationDelay: `${1.2 + index * 0.12}s` }}
                  stroke="#a94730"
                  strokeWidth="2.5"
                  fill="none"
                />
              ))}
            </svg>
            <div
              className={`${s.result} absolute right-3 -bottom-4 rounded-xl bg-white px-4 py-3 text-[#252b29] shadow-[0_18px_40px_rgba(0,0,0,0.35)] sm:right-6`}
            >
              <p className="text-[10px] tracking-[0.14em] text-[#69716d] uppercase">
                Пример расчёта
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                7 деталей · 1 лист · остаток 4%
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
