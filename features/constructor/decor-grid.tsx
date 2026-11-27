"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

import { guessDecorColor } from "@/features/bazis/decor-color";
import { cn } from "@/lib/utils";

import { Segmented, StepHead } from "./constructor-shell";
import type { ConstructorDecor } from "@/lib/server/constructor-decors";

const FALLBACK = [214, 206, 192];
const PAGE = 36;

// Декоры плитками сразу на экране: фото декора, название, поиск.
// Выбранный стоит первым, фото грузятся, только когда видны.
export function DecorGrid({
  decors,
  value,
  onChange,
}: {
  decors: ConstructorDecor[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const deferredQuery = useDeferredValue(query);
  const shown = useMemo(() => {
    const words = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const found = decors.filter((decor) => {
      const text =
        `${decor.label} ${decor.brand} ${decor.category} ${decor.thickness}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
    if (words.length) return found;
    const selected = found.find((decor) => decor.id === value);
    return selected
      ? [selected, ...found.filter((decor) => decor !== selected)]
      : found;
  }, [decors, deferredQuery, value]);

  return (
    <div className="grid gap-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(PAGE);
          }}
          placeholder="Белый, дуб, графит, Egger…"
          enterKeyHint="search"
          className="h-11 w-full rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] pr-3 pl-9 text-[15px] outline-none focus:border-[var(--accent)]"
        />
      </label>
      <div className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4 lg:grid-cols-3">
        {shown.slice(0, limit).map((decor) => {
          const active = decor.id === value;
          const [r, g, b] = guessDecorColor(decor.name) ?? FALLBACK;
          return (
            <button
              key={decor.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(decor.id)}
              className="grid content-start gap-1.5 text-left"
            >
              <span
                className={cn(
                  "relative block aspect-[4/3] overflow-hidden rounded-xl border",
                  active
                    ? "border-[var(--foreground)] ring-2 ring-[var(--foreground)] ring-offset-2 ring-offset-[var(--surface-strong)]"
                    : "border-[color:var(--line)]",
                )}
                style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
              >
                {decor.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={decor.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
                {active ? (
                  <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-[var(--foreground)] text-[var(--background)]">
                    <Check className="size-3" />
                  </span>
                ) : null}
              </span>
              <span className="line-clamp-2 text-[12px] leading-4">
                {decor.name}
                {/\d\s*мм/.test(decor.name) ? null : (
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {decor.thickness} мм
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <p className="py-4 text-center text-[14px] text-[var(--muted)]">
          Ничего не нашли. Попробуйте другое слово.
        </p>
      ) : null}
      {shown.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit((current) => current + PAGE)}
          className="h-10 rounded-full border border-[color:var(--line)] text-[14px] font-medium transition-colors hover:border-[var(--foreground)]"
        >
          Показать ещё {Math.min(PAGE, shown.length - limit)}
        </button>
      ) : null}
    </div>
  );
}

// Шаг «Цвет»: один декор на всё или фасады другим цветом. Фасады режем
// из плиты той же толщины, что и корпус: присадка считается по ней.
export function DecorStep({
  decors,
  bodyId,
  facadeId,
  onBody,
  onFacade,
  hasFronts,
  facadeLabel = "Фасадов",
}: {
  decors: ConstructorDecor[];
  bodyId: string;
  facadeId: string;
  onBody: (id: string) => void;
  onFacade: (id: string) => void;
  hasFronts: boolean;
  facadeLabel?: string;
}) {
  const [paintFacade, setPaintFacade] = useState(false);
  const body = decors.find((decor) => decor.id === bodyId);
  const thickness = body?.thickness ?? 16;
  const sameDecor = !hasFronts || !facadeId || facadeId === bodyId;
  return (
    <>
      <StepHead
        title="Цвет"
        hint="Декоры ЛДСП, которые есть у нас на складе."
      />
      {hasFronts ? (
        <Segmented
          label="Фасады"
          value={sameDecor ? "same" : "other"}
          options={[
            { value: "same", label: "Как корпус" },
            { value: "other", label: "Другого цвета" },
          ]}
          onChange={(mode) => {
            if (mode === "same") {
              onFacade(bodyId);
              setPaintFacade(false);
              return;
            }
            const other = decors.find(
              (decor) => decor.thickness === thickness && decor.id !== bodyId,
            );
            if (other) {
              onFacade(other.id);
              setPaintFacade(true);
            }
          }}
        />
      ) : null}
      {!sameDecor ? (
        <Segmented
          label="Меняем цвет"
          value={paintFacade ? "facade" : "body"}
          options={[
            { value: "body", label: "Корпуса" },
            { value: "facade", label: facadeLabel },
          ]}
          onChange={(which) => setPaintFacade(which === "facade")}
        />
      ) : null}
      {!sameDecor && paintFacade ? (
        <DecorGrid
          decors={decors.filter((decor) => decor.thickness === thickness)}
          value={facadeId}
          onChange={onFacade}
        />
      ) : (
        <DecorGrid
          decors={decors}
          value={bodyId}
          onChange={(id) => {
            // Другая толщина сбрасывает фасады на декор корпуса.
            const next = decors.find((decor) => decor.id === id);
            const facade = decors.find((decor) => decor.id === facadeId);
            if (sameDecor || facade?.thickness !== next?.thickness) {
              onFacade(id);
            }
            onBody(id);
          }}
        />
      )}
    </>
  );
}
