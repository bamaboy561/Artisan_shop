"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./storefront.module.css";

export function StorefrontDialog({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${wide ? s.wideDialog : ""}`}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={s.dialogInner}>
          <div className={s.dialogHeading}>
            <h2>{title}</h2>
            <button
              type="button"
              className={s.iconButton}
              title="Закрыть"
              aria-label="Закрыть"
              onClick={onClose}
            >
              <X size={22} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Quantity({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    const parsed = Number(draft ?? value);
    onChange(
      Number.isFinite(parsed)
        ? Math.max(1, Math.min(max, Math.floor(parsed)))
        : value,
    );
    setDraft(null);
  }
  return (
    <div className={s.quantity}>
      <button
        type="button"
        aria-label="Уменьшить количество"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        min={1}
        max={max}
        inputMode="numeric"
        aria-label="Количество"
        value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      <button
        type="button"
        aria-label="Увеличить количество"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
