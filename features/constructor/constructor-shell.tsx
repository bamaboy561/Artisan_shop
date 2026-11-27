"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, Minus, Plus } from "lucide-react";

import { useNumberInput } from "@/features/services/use-number-input";
import { cn } from "@/lib/utils";

import styles from "./constructor.module.css";
import { formatSom, type Estimate } from "./estimate";

// Шаги конструктора линией с номерами, как в калькуляторе распила:
// пройденные отмечены галочкой, на любой можно вернуться.
export function StepNav({
  steps,
  current,
  onStep,
}: {
  steps: string[];
  current: number;
  onStep: (index: number) => void;
}) {
  return (
    <nav aria-label="Шаги конструктора">
      <ol
        className="grid border-b border-[color:var(--line)]"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((label, index) => {
          const active = index === current;
          const done = index < current;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => onStep(index)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 pb-2 text-[11px] leading-tight transition-colors sm:text-[12px]",
                  active
                    ? "font-semibold text-[var(--foreground)] after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--accent)]"
                    : done
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-[12px] font-semibold tabular-nums",
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                      : done
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[color:var(--line-strong)]",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className="max-w-full truncate px-0.5">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Нижнее меню сайта на телефоне и планшете бывает разным (у витрины до
// 600 px, у старого дизайна до xl): меряем его и ставим цену над ним.
function useBottomDockOffset() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const docks = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          'nav[aria-label="Мобильная навигация"]',
        ),
      ].map((nav) => {
        let element: HTMLElement | null = nav;
        while (element && getComputedStyle(element).position !== "fixed") {
          element = element.parentElement;
        }
        return element;
      });
    const update = () => {
      let height = 0;
      for (const dock of docks()) {
        if (!dock || dock.offsetHeight === 0) continue;
        const rect = dock.getBoundingClientRect();
        if (rect.bottom >= window.innerHeight - 1) {
          height = Math.max(height, window.innerHeight - rect.top);
        }
      }
      bar.style.setProperty("--dock", `${Math.round(height)}px`);
      bar.toggleAttribute("data-dock", height > 0);
    };
    update();
    const observer = new ResizeObserver(update);
    for (const dock of docks()) if (dock) observer.observe(dock);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return ref;
}

// Низ панели: примерная цена и одна кнопка дальше. На телефоне
// прилипает к низу экрана над нижним меню сайта.
export function PriceBar({
  price,
  meta,
  onBack,
  next,
}: {
  price: string;
  meta: string;
  onBack?: () => void;
  next: ReactNode;
}) {
  const barRef = useBottomDockOffset();
  return (
    <div ref={barRef} className={styles.bar}>
      <div className={cn(styles.barInner, "flex items-center gap-3")}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:border-[var(--foreground)]"
          >
            <ArrowLeft className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[22px] leading-none font-medium tracking-[-0.02em] tabular-nums sm:text-[26px]">
            {price}
          </p>
          <p className="mt-1.5 truncate text-[12px] text-[var(--muted)]">
            {meta}
          </p>
        </div>
        <div className="shrink-0">{next}</div>
      </div>
    </div>
  );
}

export const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[15px] font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-strong)] disabled:opacity-40";
export const secondaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--line-strong)] px-5 text-[14px] font-semibold transition-colors hover:border-[var(--foreground)] disabled:opacity-40";

// Заголовок шага и одна строка пояснения.
export function StepHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-[20px] leading-tight font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      {hint ? (
        <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

// Число кнопками − и +: полки, ящики. Без клавиатуры на телефоне.
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-[12px] leading-4 text-[var(--muted)]">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`${label}: меньше`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid size-10 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:border-[var(--foreground)] disabled:opacity-30"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-9 text-center text-[17px] font-medium tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label={`${label}: больше`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid size-10 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:border-[var(--foreground)] disabled:opacity-30"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

// Выбор из нескольких вариантов одной полосой.
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 py-3">
      <p className="text-[15px] font-medium">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-1 rounded-xl bg-[var(--surface)] p-1"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-10 rounded-lg px-2 text-[14px] font-medium transition-colors",
              option.value === value
                ? "bg-[var(--surface-strong)] text-[var(--foreground)] shadow-[0_1px_2px_rgba(21,20,17,0.12)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Размер в миллиметрах крупным полем; в макет уходит после паузы в наборе.
export function SizeField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
}) {
  const input = useNumberInput(value, onChange, { min });
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[13px] text-[var(--muted)]">{label}</span>
      <span className="flex h-12 items-center rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] px-3 transition-colors focus-within:border-[var(--accent)]">
        <input
          {...input}
          className="w-full min-w-0 bg-transparent text-[17px] font-medium tabular-nums outline-none"
        />
        <span className="text-[13px] text-[var(--muted)]">мм</span>
      </span>
    </label>
  );
}

// Быстрые размеры одной строкой: 600, 800, 1000…
export function QuickSizes({
  values,
  value,
  onChange,
}: {
  values: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          className={cn(
            "h-8 rounded-full border px-3 text-[13px] tabular-nums transition-colors",
            size === value
              ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
              : "border-[color:var(--line)] hover:border-[var(--foreground)]",
          )}
        >
          {size}
        </button>
      ))}
    </div>
  );
}

// Строка суммы в итоге: подпись слева, цена справа.
export function CostRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-2",
        strong
          ? "border-t border-[color:var(--line)] pt-3 text-[17px] font-semibold"
          : "text-[14px]",
      )}
    >
      <span className={strong ? "" : "text-[var(--muted)]"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// Варианты списком, когда у каждого есть пояснение: соединение,
// подсветка, готовые схемы купе.
export function OptionList<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 py-3">
      <p className="text-[15px] font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-[var(--foreground)] bg-[var(--surface)]"
                  : "border-[color:var(--line)] hover:border-[var(--foreground)]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                  active
                    ? "border-[var(--foreground)]"
                    : "border-[color:var(--line-strong)]",
                )}
              >
                {active ? (
                  <span className="size-2 rounded-full bg-[var(--foreground)]" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] leading-5 font-medium">
                  {option.label}
                </span>
                {option.hint ? (
                  <span className="mt-0.5 block text-[12px] leading-4 text-[var(--muted)]">
                    {option.hint}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Свёрнутый блок для того, что нужно не всем: свои секции, детали.
export function More({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-t border-[color:var(--line)] py-1"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 pb-3">{children}</div>
    </details>
  );
}

// «1 лист», «3 листа», «5 листов».
export function plural(count: number, forms: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const form =
    mod10 === 1 && mod100 !== 11
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? forms[1]
        : forms[2];
  return `${count} ${form}`;
}

const meters = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

// Из чего складывается примерная цена: плита, распил, кромка, присадка,
// пазы и фурнитура из каталога.
export function EstimateRows({
  estimate,
  fittings,
}: {
  estimate: Estimate;
  fittings: number;
}) {
  return (
    <div>
      <CostRow
        label={`Плита, ${plural(estimate.sheets, ["лист", "листа", "листов"])}`}
        value={formatSom(estimate.material)}
      />
      <CostRow label="Распил" value={formatSom(estimate.cutting)} />
      <CostRow
        label={`Кромка, ${meters.format(Math.ceil(estimate.edgeMeters))} м`}
        value={formatSom(estimate.edge)}
      />
      {estimate.drilling > 0 ? (
        <CostRow label="Присадка" value={formatSom(estimate.drilling)} />
      ) : null}
      {estimate.milling > 0 ? (
        <CostRow
          label="Пазы и фрезеровка"
          value={formatSom(estimate.milling)}
        />
      ) : null}
      {fittings > 0 ? (
        <CostRow label="Фурнитура" value={formatSom(fittings)} />
      ) : null}
      <CostRow
        label="Итого"
        value={formatSom(estimate.total + fittings)}
        strong
      />
    </div>
  );
}
