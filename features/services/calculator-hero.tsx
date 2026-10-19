import { ArrowDown, LayoutGrid, Paperclip } from "lucide-react";

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

function PriceTag({
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
    <div className={`${s.price} rounded-xl px-4 py-3 sm:px-5 sm:py-4`}>
      <p className="text-[11px] tracking-[0.14em] text-white/60 uppercase">
        {label}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <strong className="text-2xl sm:text-[1.9rem]">{price}</strong>
        <span className="text-xs whitespace-nowrap text-white/80 sm:text-sm">
          {unit}
        </span>
        <del className="text-sm text-white/45">{regular}</del>
      </p>
    </div>
  );
}

export function CalculatorHero({ prices }: { prices: SiteCuttingPrices }) {
  return (
    <>
      <section className={s.hero}>
        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-9 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-14 lg:px-10 lg:py-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[11px] tracking-[0.14em] text-white/80 uppercase">
              <span className="size-1.5 rounded-full bg-[#f0a48f]" />
              Раскрой онлайн
            </p>
            <h1
              className={`${s.heroTitle} mt-4 text-[1.75rem] sm:text-[2.5rem] xl:text-[3.2rem]`}
            >
              Соберите раскрой сами.
              <br />
              <em>Это быстрее и дешевле.</em>
            </h1>
            <p className="mt-4 max-w-[36rem] text-[15px] leading-7 text-white/75 sm:text-base">
              Вставьте список деталей, и калькулятор сразу покажет карту
              раскроя, число листов и ориентир цены. Заявка уходит менеджеру.
            </p>

            <div className="mt-6 grid max-w-[30rem] grid-cols-2 gap-3">
              <PriceTag
                label="Распил"
                price={prices.sheet}
                regular={prices.sheetRegular}
                unit="сом / лист"
              />
              <PriceTag
                label="Кромка"
                price={prices.edge}
                regular={prices.edgeRegular}
                unit="сом / метр"
              />
            </div>
            <p className="mt-2 text-xs text-white/50">
              Цены для заявок, собранных на сайте. Точную сумму подтвердит
              менеджер.
            </p>

            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <a
                href="#cut-calculator"
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-[#c4532b] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#a8431f]"
              >
                Начать раскрой <ArrowDown className="size-4" />
              </a>
              <a
                href="#cabinet"
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-white/60 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <LayoutGrid className="size-4" /> Собрать шкаф по размерам
              </a>
              <a
                href="#cut-request-form"
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/60"
              >
                <Paperclip className="size-4" /> Есть файл Базиса или фото
              </a>
              <a
                href="/bazis"
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/60"
              >
                Открыть проект Базиса: макет и детали
              </a>
            </div>
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
