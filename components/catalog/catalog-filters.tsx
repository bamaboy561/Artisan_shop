"use client";

import { useMemo, useState, useTransition } from "react";
import { Filter, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type CatalogToolbarProps = {
  state: CatalogFilterState;
  options: CatalogFilterOptions;
  resultCount: number;
  totalCount: number;
  className?: string;
};

type CatalogChip = {
  key: string;
  label: string;
  onRemove: () => void;
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

  const pushState = (nextState: CatalogFilterState) => {
    startTransition(() => {
      router.push(buildCatalogHref(pathname, nextState));
    });
  };

  return {
    isPending,
    pushState,
  };
}

function PresetButton({
  label,
  count,
  active,
  disabled,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8.5 items-center gap-2 border px-3 font-mono text-[10px] tracking-[0.12em] uppercase transition sm:h-9 disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
          : "border-[color:var(--line)] bg-white/88 text-[var(--foreground)] hover:border-[color:var(--foreground)]",
      )}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            active
              ? "bg-white/16 text-white"
              : "bg-[var(--surface)] text-[var(--muted)]",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function CatalogOptionGroup({
  title,
  options,
  selectedValues,
  onToggle,
}: {
  title: string;
  options: CatalogFilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        <span className="text-xs text-[var(--muted)]">
          {options.filter((option) => option.count > 0).length}
        </span>
      </div>
      <div className="space-y-2">
        {options.map((option) => (
          <Checkbox
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onChange={() => onToggle(option.value)}
            label={option.label}
            description={`${option.count} позиций`}
            disabled={
              !selectedValues.includes(option.value) && option.count === 0
            }
            className={cn(
              option.count === 0 &&
                !selectedValues.includes(option.value) &&
                "opacity-55",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogSearchForm({
  defaultValue,
  onSubmit,
  disabled,
}: {
  defaultValue: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <form
      key={defaultValue}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onSubmit(String(formData.get("q") ?? "").trim());
      }}
    >
      <div className="space-y-2">
        <label
          htmlFor="catalog-search"
          className="text-sm font-semibold text-[var(--foreground)]"
        >
          Поиск
        </label>
        <Input
          id="catalog-search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Название или артикул"
        />
      </div>
      <Button
        type="submit"
        variant="secondary"
        className="w-full"
        disabled={disabled}
      >
        Показать
      </Button>
    </form>
  );
}

export function CatalogSidebar({
  state,
  options,
  className,
}: CatalogSidebarProps) {
  const { isPending, pushState } = useCatalogNavigation();

  const canReset =
    state.brands.length > 0 ||
    state.groups.length > 0 ||
    state.q.length > 0 ||
    state.sort !== "default";

  return (
    <aside className={cn("hidden lg:block", className)}>
      <div className="sticky top-20 space-y-5 border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 sm:p-5">
        <div className="space-y-2">
          <p className="font-mono text-[11px] tracking-[0.24em] text-[var(--accent)] uppercase">
            Каталог
          </p>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Фильтры
          </h2>
        </div>

        <CatalogSearchForm
          defaultValue={state.q}
          onSubmit={(query) =>
            pushState({
              ...state,
              q: query,
              page: 1,
            })
          }
          disabled={isPending}
        />

        <CatalogOptionGroup
          title="Бренды"
          options={options.brands}
          selectedValues={state.brands}
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
          onToggle={(value) =>
            pushState({
              ...state,
              groups: toggleFilterValue(state.groups, value),
              page: 1,
            })
          }
        />

        <Button
          type="button"
          variant="ghost"
          className="w-full justify-center"
          onClick={() => pushState(emptyCatalogState)}
          disabled={!canReset || isPending}
        >
          Сбросить все
        </Button>
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
  const [draftState, setDraftState] = useState<CatalogFilterState>(state);

  const brandLabelMap = useMemo(
    () => new Map(options.brands.map((option) => [option.value, option.label])),
    [options.brands],
  );
  const groupLabelMap = useMemo(
    () => new Map(options.groups.map((option) => [option.value, option.label])),
    [options.groups],
  );

  const canReset =
    state.brands.length > 0 ||
    state.groups.length > 0 ||
    state.q.length > 0 ||
    state.sort !== "default";

  const activeChipCount =
    state.brands.length + state.groups.length + (state.q ? 1 : 0);

  const chips = useMemo<CatalogChip[]>(
    () => [
      ...state.brands.map((brand) => ({
        key: `brand-${brand}`,
        label: brandLabelMap.get(brand) ?? brand,
        onRemove: () =>
          pushState({
            ...state,
            brands: state.brands.filter((value) => value !== brand),
            page: 1,
          }),
      })),
      ...state.groups.map((group) => ({
        key: `group-${group}`,
        label: groupLabelMap.get(group) ?? group,
        onRemove: () =>
          pushState({
            ...state,
            groups: state.groups.filter((value) => value !== group),
            page: 1,
          }),
      })),
      ...(state.q
        ? [
            {
              key: "search-query",
              label: `Поиск: ${state.q}`,
              onRemove: () =>
                pushState({
                  ...state,
                  q: "",
                  page: 1,
                }),
            },
          ]
        : []),
    ],
    [brandLabelMap, groupLabelMap, pushState, state],
  );

  const brandPresets = useMemo(
    () =>
      options.brands.map((option) => ({
        ...option,
        active:
          state.brands.length === 1 && state.brands.includes(option.value),
      })),
    [options.brands, state.brands],
  );

  const groupPresets = useMemo(
    () =>
      options.groups.map((option) => ({
        ...option,
        active:
          state.groups.length === 1 && state.groups.includes(option.value),
      })),
    [options.groups, state.groups],
  );

  const applyDraftState = () => {
    pushState({
      ...draftState,
      q: draftState.q.trim(),
      page: 1,
    });
    setIsModalOpen(false);
  };

  return (
    <>
      <div className={cn("space-y-3 sm:space-y-4", className)}>
        <div className="lg:hidden">
          <div className="sticky top-[4.1rem] z-20 -mx-4 border-y border-[color:var(--line)] bg-[#f7f4ee]/96 px-4 py-2.5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-[var(--foreground)]">
                  {resultCount} из {totalCount}
                </p>
                <p className="hidden mt-0.5 text-[10px] tracking-[0.02em] text-[var(--muted)]">
                  Товары каталога
                </p>
              </div>
              {canReset ? (
                <button
                  type="button"
                  onClick={() => pushState(emptyCatalogState)}
                  className="inline-flex shrink-0 items-center px-1 py-1 font-mono text-[9px] font-semibold tracking-[0.14em] text-[var(--accent)] uppercase"
                >
                  Сбросить
                </button>
              ) : null}
            </div>

            <form
              key={state.q}
              className="mt-2 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                pushState({
                  ...state,
                  q: String(formData.get("q") ?? "").trim(),
                  page: 1,
                });
              }}
            >
              <Input
                name="q"
                defaultValue={state.q}
                placeholder="Поиск по названию или артикулу"
              />
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 px-3 text-[9px]"
                  onClick={() => {
                    setDraftState(state);
                    setIsModalOpen(true);
                  }}
                >
                  <Filter className="size-4" />
                  {activeChipCount > 0 ? `Фильтры ${activeChipCount}` : "Фильтры"}
                </Button>

                <label className="block">
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
                    className="h-10 text-[13px]"
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

              {chips.length > 0 ? (
                <div className="-mx-4 overflow-x-auto px-4 pt-0.5">
                  <div className="flex w-max items-center gap-1.5">
                    {chips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={chip.onRemove}
                        className="inline-flex items-center gap-1.5 border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)]"
                      >
                        <span>{chip.label}</span>
                        <X className="size-3 text-[var(--muted)]" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </form>
          </div>
        </div>

        <div className="hidden border border-[color:var(--line)] bg-[var(--surface-strong)]/94 p-3.5 backdrop-blur-xl sm:p-4 lg:block">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Найдено {resultCount} из {totalCount} позиций
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="space-y-2 text-sm text-[var(--muted)] sm:min-w-[220px]">
                <span className="block font-medium text-[var(--foreground)]">
                  Сортировка
                </span>
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

          <div className="mt-4 space-y-3 border-t border-[color:var(--line)] pt-4">
            {chips.length > 0 || canReset ? (
              <div className="border border-[color:var(--line)] bg-[var(--surface)]/72 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {chips.length > 0 ? (
                      chips.map((chip) => (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={chip.onRemove}
                          className="inline-flex items-center gap-2 border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[color:var(--foreground)]"
                        >
                          <span>{chip.label}</span>
                          <X className="size-3.5 text-[var(--muted)]" />
                        </button>
                      ))
                    ) : (
                      <span className="inline-flex items-center px-1 text-sm text-[var(--muted)]">
                        Вся выдача
                      </span>
                    )}
                  </div>
                  {canReset ? (
                    <button
                      type="button"
                      onClick={() => pushState(emptyCatalogState)}
                      className="inline-flex items-center px-2 py-2 font-mono text-[10px] font-semibold tracking-[0.14em] text-[var(--accent)] uppercase transition hover:text-[var(--accent-strong)]"
                    >
                      Сбросить все
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
                Бренды
              </p>

              <div className="-mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
                <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                <PresetButton
                  label="Все бренды"
                  active={state.brands.length === 0}
                  onClick={() =>
                    pushState({
                      ...state,
                      brands: [],
                      page: 1,
                    })
                  }
                />
                {brandPresets.map((preset) => (
                  <PresetButton
                    key={preset.value}
                    label={preset.label}
                    count={preset.count}
                    active={preset.active}
                    disabled={!preset.active && preset.count === 0}
                    onClick={() =>
                      pushState({
                        ...state,
                        brands: [preset.value],
                        page: 1,
                      })
                    }
                  />
                ))}
                </div>
              </div>

              {groupPresets.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
                    Подкатегории
                  </p>
                  <div className="-mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
                    <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                  <PresetButton
                    label="Все группы"
                    active={state.groups.length === 0}
                    onClick={() =>
                      pushState({
                        ...state,
                        groups: [],
                        page: 1,
                      })
                    }
                  />
                  {groupPresets.map((preset) => (
                    <PresetButton
                      key={preset.value}
                      label={preset.label}
                      count={preset.count}
                      active={preset.active}
                      disabled={!preset.active && preset.count === 0}
                      onClick={() =>
                        pushState({
                          ...state,
                          groups: [preset.value],
                          page: 1,
                        })
                      }
                    />
                  ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Фильтры каталога"
        description="Бренды, группы и поиск."
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraftState(emptyCatalogState);
                pushState(emptyCatalogState);
                setIsModalOpen(false);
              }}
            >
              Сбросить
            </Button>
            <Button type="button" variant="accent" onClick={applyDraftState}>
              Применить
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="catalog-search-mobile"
              className="block text-sm font-semibold text-[var(--foreground)]"
            >
              Поиск
            </label>
            <Input
              id="catalog-search-mobile"
              value={draftState.q}
              onChange={(event) =>
                setDraftState((currentState) => ({
                  ...currentState,
                  q: event.target.value,
                }))
              }
              placeholder="Название или артикул"
            />
          </div>

          <label className="block space-y-2 text-sm">
            <span className="block font-semibold text-[var(--foreground)]">
              Сортировка
            </span>
            <Select
              value={draftState.sort}
              onChange={(event) =>
                setDraftState((currentState) => ({
                  ...currentState,
                  sort: event.target.value as CatalogSort,
                }))
              }
            >
              {catalogSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <CatalogOptionGroup
            title="Бренды"
            options={options.brands}
            selectedValues={draftState.brands}
            onToggle={(value) =>
              setDraftState((currentState) => ({
                ...currentState,
                brands: toggleFilterValue(currentState.brands, value),
              }))
            }
          />

          <CatalogOptionGroup
            title="Группы"
            options={options.groups}
            selectedValues={draftState.groups}
            onToggle={(value) =>
              setDraftState((currentState) => ({
                ...currentState,
                groups: toggleFilterValue(currentState.groups, value),
              }))
            }
          />
        </div>
      </Modal>
    </>
  );
}
