"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Поле числа, которое не перестраивает макет на каждую цифру: значение
// уходит после паузы в наборе, по Enter или уходу с поля. Пока человек
// набирает «1200», шкаф не собирается на 1, 12 и 120 мм.
export function useNumberInput(
  value: number,
  onChange: (value: number) => void,
  { min = 0, delay = 450 }: { min?: number; delay?: number } = {},
) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const latest = useRef({ value, onChange, min });
  useEffect(() => {
    latest.current = { value, onChange, min };
  });

  const commit = useCallback((raw: string) => {
    window.clearTimeout(timer.current);
    pending.current = null;
    const { value: current, onChange: change, min: least } = latest.current;
    const parsed = Number(raw.replace(",", "."));
    if (raw.trim() !== "" && Number.isFinite(parsed) && parsed >= least) {
      if (parsed !== current) change(parsed);
    } else {
      setText(String(current));
    }
  }, []);

  // Ушли со страницы шага, не дождавшись паузы, — набранное не теряем.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (pending.current !== null) commit(pending.current);
    },
    [commit],
  );

  return {
    value: text,
    inputMode: "numeric" as const,
    enterKeyHint: "done" as const,
    onChange: (event: { target: { value: string } }) => {
      const next = event.target.value.replace(/[^\d.,]/g, "");
      setText(next);
      pending.current = next;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => commit(next), delay);
    },
    onBlur: (event: { target: { value: string } }) =>
      commit(event.target.value),
    onKeyDown: (event: { key: string; currentTarget: { value: string } }) => {
      if (event.key === "Enter") commit(event.currentTarget.value);
    },
  };
}
