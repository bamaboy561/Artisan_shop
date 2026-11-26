import { ArrowDown, Paperclip } from "lucide-react";

import type { SiteCuttingPrices } from "@/features/cutting/site-prices";

import s from "./calculator-hero.module.css";
import {
  SheetBoard,
  walnutDecor,
  type BoardCut,
  type BoardPiece,
} from "./sheet-board";

// Пример с листа 2800 × 2070: шкаф 800 × 2000, детали в мм, пропил 4 мм.
const demoPieces: BoardPiece[] = [
  {
    id: "b1",
    x: 0,
    y: 0,
    width: 2000,
    height: 560,
    label: "2000 × 560",
    edges: ["bottom"],
  },
  {
    id: "b2",
    x: 0,
    y: 564,
    width: 2000,
    height: 560,
    label: "2000 × 560",
    edges: ["bottom"],
  },
  {
    id: "t1",
    x: 0,
    y: 1128,
    width: 800,
    height: 560,
    label: "800 × 560",
    edges: ["bottom"],
  },
  {
    id: "t2",
    x: 804,
    y: 1128,
    width: 800,
    height: 560,
    label: "800 × 560",
    edges: ["bottom"],
  },
  {
    id: "f1",
    x: 0,
    y: 1692,
    width: 716,
    height: 370,
    label: "716 × 370",
    edges: ["top", "right", "bottom", "left"],
  },
  {
    id: "f2",
    x: 720,
    y: 1692,
    width: 716,
    height: 370,
    label: "716 × 370",
    edges: ["top", "right", "bottom", "left"],
  },
  {
    id: "s1",
    x: 2004,
    y: 0,
    width: 764,
    height: 540,
    label: "764 × 540",
    edges: ["bottom"],
  },
  {
    id: "s2",
    x: 2004,
    y: 544,
    width: 764,
    height: 540,
    label: "764 × 540",
    edges: ["bottom"],
  },
  {
    id: "s3",
    x: 2004,
    y: 1088,
    width: 764,
    height: 540,
    label: "764 × 540",
    edges: ["bottom"],
  },
];

const demoCuts: BoardCut[] = [
  { id: "c1", x: 2002, y: 0, width: 4, height: 2070 },
  { id: "c2", x: 0, y: 562, width: 2002, height: 4 },
  { id: "c3", x: 0, y: 1126, width: 2002, height: 4 },
  { id: "c4", x: 0, y: 1690, width: 2002, height: 4 },
  { id: "c5", x: 2004, y: 542, width: 796, height: 4 },
  { id: "c6", x: 2004, y: 1086, width: 796, height: 4 },
  { id: "c7", x: 2004, y: 1630, width: 796, height: 4 },
  { id: "c8", x: 802, y: 1128, width: 4, height: 562 },
  { id: "c9", x: 718, y: 1692, width: 4, height: 378 },
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
          </div>

          <figure className={s.visual}>
            <SheetBoard
              tilt
              sheetWidth={2800}
              sheetHeight={2070}
              pieces={demoPieces}
              cuts={demoCuts}
              decor={walnutDecor}
              ariaLabel="Пример раскроя: лист 2800 на 2070, девять деталей шкафа"
            />
            <figcaption className={s.caption}>
              Пример: шкаф 800 × 2000 — 9 деталей на одном листе 2800 × 2070,
              остаток 15%
            </figcaption>
          </figure>
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
