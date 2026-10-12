"use client";

import { useState, useTransition } from "react";
import { Filter, LoaderCircle, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  buildCatalogHref,
  catalogSortOptions,
  type CatalogFilterOption,
  type CatalogFilterOptions,
  type CatalogFilterState,
  type CatalogSort,
} from "@/features/catalog/filters";
import { cn } from "@/lib/utils";

type CatalogSidebarProps = {
  state: CatalogFilterState;
  options: CatalogFilterOptions;
  className?: string;
};
type CatalogToolbarProps = CatalogSidebarProps & {
  resultCount: number;
  totalCount: number;
};
const emptyCatalogState: CatalogFilterState = {
  brands: [],
  groups: [],
  q: "",
  sort: "default",
  page: 1,
};

function toggleFilterValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function useCatalogNavigation() {
  const router = useRouter();
  const pathname = usePathname() || "/catalog";
  const [isPending, startTransition] = useTransition();
  function pushState(next: CatalogFilterState) {
    startTransition(() =>
      router.push(buildCatalogHref(pathname, next), { scroll: false }),
    );
  }
  return { isPending, pushState };
}

function CatalogOptionGroup({
  title,
  options,
  selectedValues,
  onToggle,
  disabled,
}: {
  title: string;
  options: CatalogFilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
}) {
  if (!options.length) return null;
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      <div className="max-h-80 overflow-y-auto">
        {options.map((option) => {
          const selected = selectedValues.includes(option.value);
          const unavailable = !selected && option.count === 0;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-3 py-2 text-sm",
                unavailable && "cursor-not-allowed opacity-45",
              )}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(option.value)}
                disabled={unavailable}
                className="size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="min-w-0 flex-1 break-words">{option.label}</span>
              <span className="text-xs text-[var(--muted)] tabular-nums">
                {option.count}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function CatalogSidebar({
  state,
  options,
  className,
}: CatalogSidebarProps) {
  const { isPending, pushState } = useCatalogNavigation();
  return (
    <aside className={cn("hidden lg:block", className)}>
      <div
        className="sticky top-24 space-y-6 pr-5 text-[var(--foreground)]"
        aria-busy={isPending}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
          <h2 className="text-base font-semibold">Фильтры</h2>
          {isPending ? (
            <LoaderCircle
              className="size-4 animate-spin"
              aria-label="Обновляем товары"
            />
          ) : null}
        </div>
        <CatalogOptionGroup
          title="Бренды"
          options={options.brands}
          selectedValues={state.brands}
          disabled={isPending}
          onToggle={(value) =>
            pushState({
              ...state,
              brands: toggleFilterValue(state.brands, value),
              page: 1,
            })
          }
        />
        <CatalogOptionGroup
          title="Группы"
          options={options.groups}
          selectedValues={state.groups}
          disabled={isPending}
          onToggle={(value) =>
            pushState({
              ...state,
              groups: toggleFilterValue(state.groups, value),
              page: 1,
            })
          }
        />
      </div>
    </aside>
  );
}

export function CatalogToolbar({
  state,
  options,
  resultCount,
  totalCount,
  className,
}: CatalogToolbarProps) {
  const { isPending, pushState } = useCatalogNavigation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftState, setDraftState] = useState(state);
  const activeCount = state.brands.length + state.groups.length;
  const chips = [
    ...state.brands.map((value) => ({
      key: `brand-${value}`,
      label:
        options.brands.find((option) => option.value === value)?.label ?? value,
      remove: () =>
        pushState({
          ...state,
          brands: state.brands.filter((brand) => brand !== value),
          page: 1,
        }),
    })),
    ...state.groups.map((value) => ({
      key: `group-${value}`,
      label:
        options.groups.find((option) => option.value === value)?.label ?? value,
      remove: () =>
        pushState({
          ...state,
          groups: state.groups.filter((group) => group !== value),
          page: 1,
        }),
    })),
    ...(state.q
      ? [
          {
            key: "query",
            label: state.q,
            remove: () => pushState({ ...state, q: "", page: 1 }),
          },
        ]
      : []),
  ];
  return (
    <>
      <div
        className={cn(
          "space-y-3 border-b border-[color:var(--line)] pb-4",
          className,
        )}
        aria-busy={isPending}
      >
        <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_220px]">
          <form
            key={state.q}
            className="flex min-w-0 overflow-hidden rounded-md border border-[color:var(--line)] bg-white focus-within:border-[var(--accent)]"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              pushState({
                ...state,
                q: String(data.get("q") ?? "").trim(),
                page: 1,
              });
            }}
          >
            <input
              name="q"
              type="search"
              defaultValue={state.q}
              placeholder="Название или артикул"
              aria-label="Поиск по каталогу"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
            />
            <button
              type="submit"
              aria-label="Найти в каталоге"
              title="Найти в каталоге"
              disabled={isPending}
              className="flex size-11 shrink-0 items-center justify-center bg-[var(--foreground)] text-white disabled:opacity-60"
            >
              {isPending ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Search className="size-5" />
              )}
            </button>
          </form>
          <div className="flex min-w-0 gap-2">
            <Button
              variant="secondary"
              className="h-11 shrink-0 gap-2 px-3 text-xs lg:hidden"
              onClick={() => {
                setDraftState(state);
                setIsModalOpen(true);
              }}
            >
              <Filter className="size-4" />
              Фильтры{activeCount ? ` (${activeCount})` : ""}
            </Button>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Сортировка</span>
              <Select
                value={state.sort}
                onChange={(event) =>
                  pushState({
                    ...state,
                    sort: event.target.value as CatalogSort,
                    page: 1,
                  })
                }
                disabled={isPending}
                className="h-11 text-sm"
                wrapperClassName="w-full"
              >
                {catalogSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
        <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <p role="status">
            {isPending
              ? "Обновляем товары…"
              : `Найдено ${resultCount} из ${totalCount}`}
          </p>
          {chips.length > 0 || state.sort !== "default" ? (
            <button
              type="button"
              onClick={() => pushState(emptyCatalogState)}
              disabled={isPending}
              className="py-1 text-[var(--accent)] hover:underline"
            >
              Сбросить всё
            </button>
          ) : null}
        </div>
        {chips.length ? (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                type="button"
                key={chip.key}
                onClick={chip.remove}
                disabled={isPending}
                aria-label={`Убрать фильтр: ${chip.label}`}
                className="inline-flex max-w-full items-center gap-2 rounded border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-xs"
              >
                <span className="min-w-0 break-words">{chip.label}</span>
                <X className="size-3.5 shrink-0" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Фильтры каталога"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setDraftState(emptyCatalogState)}
            >
              Сбросить
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                pushState({ ...draftState, q: draftState.q.trim(), page: 1 });
                setIsModalOpen(false);
              }}
            >
              Применить
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <label className="grid gap-2 text-sm font-semibold">
            Поиск
            <Input
              value={draftState.q}
              onChange={(event) =>
                setDraftState((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="Название или артикул"
            />
          </label>
          <CatalogOptionGroup
            title="Бренды"
            options={options.brands}
            selectedValues={draftState.brands}
            onToggle={(value) =>
              setDraftState((current) => ({
                ...current,
                brands: toggleFilterValue(current.brands, value),
              }))
            }
          />
          <CatalogOptionGroup
            title="Группы"
            options={options.groups}
            selectedValues={draftState.groups}
            onToggle={(value) =>
              setDraftState((current) => ({
                ...current,
                groups: toggleFilterValue(current.groups, value),
              }))
            }
          />
        </div>
      </Modal>
    </>
  );
}
