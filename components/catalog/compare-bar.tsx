"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X, GitCompare } from "lucide-react";

const STORAGE_KEY = "artisan-compare-v1";
const MAX_COMPARE = 4;

function readCompareList(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

function writeCompareList(slugs: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
}

export function useCompareList() {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSlugs(readCompareList());
    const onStorage = () => setSlugs(readCompareList());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((slug: string) => {
    setSlugs((prev) => {
      const next = prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug].slice(0, MAX_COMPARE);
      writeCompareList(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSlugs([]);
    writeCompareList([]);
  }, []);

  return { slugs, toggle, clear };
}

export function CompareToggle({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    const list = readCompareList();
    setSelected(list.includes(slug));
    const onStorage = () => setSelected(readCompareList().includes(slug));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [slug]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const list = readCompareList();
    const next = list.includes(slug)
      ? list.filter((s) => s !== slug)
      : [...list, slug].slice(0, MAX_COMPARE);
    writeCompareList(next);
    setSelected(next.includes(slug));
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.12em] uppercase transition ${
        selected
          ? "text-[var(--accent)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      } ${className ?? ""}`}
    >
      <GitCompare className="size-3" />
      {selected ? "В сравнении" : "Сравнить"}
    </button>
  );
}

export function CompareBar() {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSlugs(readCompareList());
    const handler = () => setSlugs(readCompareList());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (slugs.length === 0) return null;

  const compareHref = `/compare?slugs=${slugs.map(encodeURIComponent).join(",")}`;

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 lg:bottom-6">
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--foreground)] px-3 py-2.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <GitCompare className="size-4 text-[var(--accent)]" />
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase">
          {slugs.length} из {MAX_COMPARE}
        </span>
        <Link
          href={compareHref}
          className="rounded-lg bg-white px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:bg-[var(--accent)] hover:text-white"
        >
          Сравнить
        </Link>
        <button
          type="button"
          onClick={() => {
            writeCompareList([]);
            setSlugs([]);
            window.dispatchEvent(new Event("storage"));
          }}
          className="rounded-lg p-1 text-white/50 transition hover:text-white"
          aria-label="Очистить сравнение"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}