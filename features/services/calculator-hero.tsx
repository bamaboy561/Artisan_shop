import { ClipboardPaste, Paperclip } from "lucide-react";

import { cuttingSiteIncentive } from "@/lib/site-config";

import s from "./calculator-hero.module.css";

const SHEET_WIDTH = 2440;
const SHEET_HEIGHT = 1220;

// Пример раскладки для иллюстрации: реальные размеры деталей кухни на листе 2440 × 1220.
const demoParts = [
  { title: "Боковина", x: 0, y: 0, w: 720, h: 560, color: "#f3c6a5" },
  { title: "Боковина", x: 724, y: 0, w: 720, h: 560, color: "#f3c6a5" },
  { title: "Дно", x: 1448, y: 0, w: 800, h: 560, color: "#bfd8c6" },
  { title: "Полка", x: 0, y: 564, w: 564, h: 540, color: "#c9d3ec" },
  { title: "Полка", x: 568, y: 564, w: 564, h: 540, color: "#c9d3ec" },
  { title: "Полка", x: 1136, y: 564, w: 564, h: 540, color: "#c9d3ec" },
  { title: "Фасад", x: 1704, y: 564, w: 716, h: 396, color: "#f1dc9c" },
];

const steps = [
  {
    title: "Вставьте список",
    text: "Скопируйте детали из Excel или загрузите файл. Можно ввести вручную.",
  },
  {
    title: "Смотрите карту и цену",
    text: "Листы, остатки и ориентир по стоимости пересчитываются на ходу.",
  },
  {
    title: "Отправьте в цех",
    text: "Заявка уходит менеджеру вместе с файлом для GibLab. Можно приложить проект Базиса или фото.",
  },
];

export function CalculatorHero() {
  return (
    <section className={s.hero}>
      <div className={s.inner}>
        <div>
          <p className={s.eyebrow}>Распил и кромление · Бишкек</p>
          <h1 className={s.title}>
            Раскрой ЛДСП <em>онлайн</em> за пару минут
          </h1>
          <p className={s.lead}>
            Вставьте список деталей и сразу увидите, сколько нужно листов, как
            лягут детали и сколько это стоит. Без звонков и пересылки фото.
          </p>

          {cuttingSiteIncentive ? (
            <div className={s.offers}>
              {cuttingSiteIncentive.offers.map((offer) => (
                <div key={offer.label} className={s.offer}>
                  <span className={s.offerLabel}>{offer.label}</span>
                  <span className={s.offerPrice}>
                    <s>{offer.was}</s>
                    <strong>{offer.now}</strong>
                    <span className={s.offerUnit}>{offer.unit}</span>
                  </span>
                </div>
              ))}
              <p className={s.offerNote}>
                Цена для заявок через сайт. Материал по обычной цене.
              </p>
            </div>
          ) : null}

          <div className={s.actions}>
            <a href="#cut-import" className={s.primary}>
              <ClipboardPaste className="size-4" />
              Вставить список из Excel
            </a>
            <a href="#cut-request-form" className={s.secondary}>
              <Paperclip className="size-4" />
              Отправить файл Базиса
            </a>
          </div>
        </div>

        <div className={s.visual} aria-hidden="true">
          <div className={s.sheet}>
            {demoParts.map((part, index) => (
              <span
                key={`${part.title}-${index}`}
                className={s.part}
                style={{
                  left: `${(part.x / SHEET_WIDTH) * 100}%`,
                  top: `${(part.y / SHEET_HEIGHT) * 100}%`,
                  width: `${(part.w / SHEET_WIDTH) * 100}%`,
                  height: `${(part.h / SHEET_HEIGHT) * 100}%`,
                  background: part.color,
                  animationDelay: `${300 + index * 220}ms`,
                }}
              >
                {part.title}
                <br />
                {part.w}×{part.h}
              </span>
            ))}
          </div>
          <div className={s.statCard}>
            <span className={s.statLabel}>Карта готова</span>
            <span className={s.statValue}>1 лист · 82%</span>
            <span className={s.statMeta}>
              7 деталей · кромка считается сама
            </span>
          </div>
        </div>
      </div>

      <ol className={s.steps}>
        {steps.map((step, index) => (
          <li key={step.title} className={s.step}>
            <span className={s.stepNumber}>{index + 1}</span>
            <div>
              <p className={s.stepTitle}>{step.title}</p>
              <p className={s.stepText}>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
