"use client";

import { useNumberInput } from "./use-number-input";

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-[color:var(--line)] bg-[var(--surface-strong)] px-2.5 text-[14px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";

// Небольшое поле числа с подписью: размеры секций и зон, ширины блоков.
export function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const input = useNumberInput(value, onChange);
  return (
    <label className="grid gap-1 text-[12px] text-[var(--muted)]">
      {label}
      <input className={inputClass} {...input} />
    </label>
  );
}
