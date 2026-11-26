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

function formatPrice(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function CalculatorHero({ prices }: { prices: SiteCuttingPrices }) {
  const facts = [
    {
      value: formatPrice(prices.sheet),
      unit: "сом/лист",
      regular: prices.sheetRegular,
      label: "Распил",
    },
    {
      value: formatPrice(prices.edge),
      unit: "сом/м",
      regular: prices.edgeRegular,
      label: "Кромление",
    },
    { value: "0 сом", label: "Предоплата на сайте" },
    { value: "Сразу", label: "Карта раскроя и число листов" },
  ];

  return (
    <>
      <section className={s.hero}>
        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 pt-8 pb-6 sm:px-8 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:px-10 lg:pt-16 lg:pb-10">
          <div>
            <h1 className={s.heroTitle}>
              Соберите раскрой сами. <em>Быстрее и&nbsp;дешевле.</em>
            </h1>
            <p className={s.heroLead}>
              Вставьте список деталей, и калькулятор сразу покажет карту
              раскроя, число листов и ориентир цены. Заявка уходит менеджеру.
            </p>

            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <a href="#cut-calculator" className={s.primary}>
                Ввести детали <ArrowDown className="size-4" />
              </a>
              <a href="#cut-request-form" className={s.textLink}>
                <Paperclip className="size-3.5" /> Файл Базиса, Excel или фото
              </a>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <a href="#cabinet" className={s.textLink}>
                <LayoutGrid className="size-3.5" /> Собрать шкаф по размерам
              </a>
              <a href="/bazis" className={s.textLink}>
                Проект Базиса в 3D
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
              className={`${s.result} absolute right-3 -bottom-4 rounded-2xl bg-white px-4 py-3 text-[#1b1c19] shadow-[0_18px_40px_rgba(27,28,25,0.12)] sm:right-6`}
            >
              <p className="text-xs text-[#6e6b63]">Пример расчёта</p>
              <p className="mt-0.5 text-sm font-semibold">
                7 деталей · 1 лист · остаток 4%
              </p>
            </div>
          </div>
        </div>
        <ul
          className={`${s.facts} mx-auto max-w-[1600px] px-4 sm:px-8 lg:px-10`}
        >
          {facts.map((fact) => (
            <li key={fact.label}>
              <strong>
                {fact.value}
                {fact.unit ? <small> {fact.unit}</small> : null}
                {fact.regular ? <del>{fact.regular}</del> : null}
              </strong>
              <span>{fact.label}</span>
            </li>
          ))}
        </ul>
        <p className="mx-auto max-w-[1600px] px-4 pt-2 pb-6 text-xs text-[#6e6b63] sm:px-8 lg:px-10">
          Цены для заявок, собранных на сайте. Точную сумму подтвердит менеджер.
        </p>
      </section>
    </>
  );
}
