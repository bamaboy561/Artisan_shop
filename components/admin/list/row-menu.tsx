"use client";

import { MoreHorizontal } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

// Меню «⋯» у строки списка: редкие действия, чтобы строка оставалась
// короткой. Меню висит поверх страницы (position: fixed), иначе таблица с
// прокруткой обрезала бы его.
export function RowMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function toggle() {
    if (style) {
      setStyle(null);
      return;
    }
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const right = Math.max(8, window.innerWidth - rect.right);
    const openUp = window.innerHeight - rect.bottom < 300;
    setStyle(
      openUp
        ? {
            position: "fixed",
            right,
            bottom: window.innerHeight - rect.top + 6,
          }
        : { position: "fixed", right, top: rect.bottom + 6 },
    );
  }

  useEffect(() => {
    if (!style) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !panel.current?.contains(target) &&
        !button.current?.contains(target)
      ) {
        setStyle(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStyle(null);
    };
    const onScroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) setStyle(null);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [style]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={Boolean(style)}
        onClick={toggle}
        className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-[color:var(--line)] bg-white text-[var(--muted)] transition hover:border-[color:var(--line-strong)] hover:text-[var(--foreground)]"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {style ? (
        <div
          ref={panel}
          style={style}
          className="z-50 grid w-64 gap-0.5 rounded-[12px] border border-[color:var(--line)] bg-white p-1.5 text-left shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
        >
          {children}
        </div>
      ) : null}
    </>
  );
}

export const rowMenuItemClass =
  "flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]";
