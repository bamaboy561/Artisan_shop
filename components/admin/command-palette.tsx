"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ClipboardList,
  CornerDownLeft,
  LoaderCircle,
  Plus,
  ReceiptText,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";

// Окно Ctrl+K: найти заказ, заявку, клиента или раздел и сразу открыть.
// Открывается сочетанием клавиш с любой страницы админки или кнопкой
// «Найти…» (событие admin:command).
export const OPEN_COMMAND_EVENT = "admin:command";

type Result = {
  kind: "order" | "request" | "client" | "action" | "page";
  href: string;
  title: string;
  detail?: string;
};

const kindIcon: Record<Result["kind"], LucideIcon> = {
  order: ReceiptText,
  request: ClipboardList,
  client: UserRound,
  action: Plus,
  page: ArrowRight,
};

const actions: Array<Result & { needs: string }> = [
  {
    kind: "action",
    href: "/admin/cutting/new",
    title: "Новый распил",
    needs: "/admin/cutting",
  },
  {
    kind: "action",
    href: "/admin/sales-floor",
    title: "Продажа в зале",
    needs: "/admin/sales-floor",
  },
  {
    kind: "action",
    href: "/admin/products",
    title: "Добавить материал",
    needs: "/admin/products",
  },
];

function normalize(value: string) {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").trim();
}

export function CommandPalette({
  items,
  canSearch,
}: {
  items: NavItem[];
  canSearch: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Результаты помнят, на какой запрос пришли: старые не показываем.
  const [found, setFound] = useState<{ query: string; results: Result[] }>({
    query: "",
    results: [],
  });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setFound({ query: "", results: [] });
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      // В русской раскладке Ctrl+K приходит как «л».
      if ((event.ctrlKey || event.metaKey) && event.key === "л") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    const text = query.trim();
    if (!open || !canSearch || text.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/admin/command-search?q=${encodeURIComponent(text)}`,
          { signal: controller.signal },
        );
        const data = response.ok ? await response.json() : { results: [] };
        setFound({ query: text, results: data.results ?? [] });
      } catch {
        // Отменённый запрос — пользователь печатает дальше; при ошибке
        // показываем «ничего не нашлось», а не старые результаты.
        if (!controller.signal.aborted) setFound({ query: text, results: [] });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open, canSearch]);

  const searching = canSearch && query.trim().length >= 2;
  const shownFound = useMemo(
    () => (searching && found.query === query.trim() ? found.results : []),
    [searching, found, query],
  );
  const groups = useMemo(() => {
    const text = normalize(query);
    const allowed = new Set(items.map((item) => item.href));
    const matches = (title: string, detail?: string) =>
      !text || normalize(`${title} ${detail ?? ""}`).includes(text);
    const doList = actions
      .filter((action) => allowed.has(action.needs))
      .filter((action) => matches(action.title));
    const pages: Result[] = items
      .filter((item) => matches(item.label, item.description))
      .slice(0, text ? 6 : 4)
      .map((item) => ({
        kind: "page",
        href: item.href,
        title: item.label,
        detail: item.description,
      }));
    return [
      { title: "Заказы, заявки и клиенты", rows: shownFound },
      { title: "Сделать", rows: doList },
      { title: "Перейти", rows: pages },
    ].filter((group) => group.rows.length > 0);
  }, [query, items, shownFound]);

  const flat = groups.flatMap((group) => group.rows);
  const current = Math.max(0, Math.min(active, flat.length - 1));

  useEffect(() => {
    list.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function go(result: Result | undefined) {
    if (!result) return;
    close();
    router.push(result.href);
  }

  if (!open) return null;

  let index = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-zinc-950/40 px-3 pt-[10vh] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по админке"
        className="command-pop w-full max-w-[680px] overflow-hidden rounded-[18px] border border-[color:var(--line)] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
      >
        <div className="flex h-16 items-center gap-3 border-b border-[color:var(--line)] px-5">
          {loading && searching ? (
            <LoaderCircle className="size-5 shrink-0 animate-spin text-[var(--accent)]" />
          ) : (
            <Search className="size-5 shrink-0 text-[var(--muted)]" />
          )}
          <input
            ref={input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive(Math.min(flat.length - 1, current + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive(Math.max(0, current - 1));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                go(flat[current]);
              }
            }}
            placeholder={
              canSearch
                ? "Номер заказа, имя, телефон или раздел"
                : "Раздел или действие"
            }
            aria-label="Что найти"
            className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-[var(--muted)]/70"
          />
          <kbd className="rounded-md border border-[color:var(--line)] px-1.5 py-0.5 font-[inherit] text-[11px] font-semibold text-[var(--muted)]">
            Esc
          </kbd>
        </div>
        <div ref={list} className="max-h-[60vh] overflow-y-auto p-2">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">
              {loading && searching ? "Ищем…" : "Ничего не нашлось"}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.title} className="mb-1">
                <p className="px-3 pt-2 pb-1.5 text-xs font-semibold text-[var(--muted)]">
                  {group.title}
                </p>
                {group.rows.map((row) => {
                  index += 1;
                  const rowIndex = index;
                  const Icon = kindIcon[row.kind];
                  return (
                    <button
                      key={`${row.kind}-${row.href}`}
                      type="button"
                      data-index={rowIndex}
                      onMouseMove={() => setActive(rowIndex)}
                      onClick={() => go(row)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left",
                        rowIndex === current && "bg-amber-100/70",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-muted)] text-[var(--muted)]",
                          rowIndex === current &&
                            "bg-white text-[var(--accent)]",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {row.title}
                        </span>
                        {row.detail ? (
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {row.detail}
                          </span>
                        ) : null}
                      </span>
                      {rowIndex === current ? (
                        <CornerDownLeft className="size-4 shrink-0 text-[var(--muted)]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-[color:var(--line)] bg-[var(--surface)] px-5 py-2.5 text-xs text-[var(--muted)] sm:flex">
          <span>↑ ↓ выбрать</span>
          <span>Enter открыть</span>
          <span className="ml-auto">Ctrl K — с любой страницы</span>
        </div>
      </div>
    </div>
  );
}

// Кнопка, которая открывает окно поиска.
export function CommandTrigger({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_EVENT))}
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-[var(--radius-control)] px-3 text-sm whitespace-nowrap transition",
        variant === "dark"
          ? "border border-[color:var(--sidebar-border)] bg-[#18181b] text-[var(--sidebar-muted)] hover:text-[var(--sidebar-fg)]"
          : "rounded-full border border-[color:var(--line)] bg-white text-[var(--muted)] hover:border-[color:var(--line-strong)]",
        className,
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">
        {variant === "dark" ? "Найти…" : "Найти заказ, клиента или раздел"}
      </span>
      <kbd
        className={cn(
          "rounded-md border px-1.5 py-0.5 font-[inherit] text-[11px] font-semibold",
          variant === "dark"
            ? "border-zinc-700 text-zinc-300"
            : "border-[color:var(--line)] text-[var(--muted)]",
        )}
      >
        Ctrl K
      </kbd>
    </button>
  );
}
