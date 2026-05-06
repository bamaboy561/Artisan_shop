"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type DropdownItem = {
  id: string;
  label: string;
  description?: string;
};

type DropdownProps = {
  label: string;
  items: DropdownItem[];
  onSelect?: (itemId: string) => void;
  className?: string;
};

export function Dropdown({ label, items, onSelect, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(items[0]?.id);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, []);

  const activeItem = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] px-4 text-sm font-medium text-[var(--foreground)] transition hover:border-[color:var(--line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
        aria-expanded={open}
      >
        <span className="truncate">
          {label}: {activeItem?.label}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-[var(--muted)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="surface-glow absolute top-[calc(100%+0.45rem)] left-0 z-20 w-full rounded-2xl border border-[color:var(--line)] bg-[var(--surface-strong)] p-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "w-full rounded-xl px-3 py-2 text-left transition hover:bg-[var(--surface)]",
                item.id === activeItem?.id && "bg-[var(--surface)]",
              )}
              onClick={() => {
                setActiveId(item.id);
                onSelect?.(item.id);
                setOpen(false);
              }}
            >
              <span className="block text-sm font-medium text-[var(--foreground)]">
                {item.label}
              </span>
              {item.description ? (
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {item.description}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
