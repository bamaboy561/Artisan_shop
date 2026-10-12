"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grid2X2, List, Search, SlidersHorizontal, X } from "lucide-react";
import { useState, useTransition, type ReactNode, type FormEvent } from "react";
import {
  catalogSortOptions,
  type CatalogFilterOptions,
} from "@/features/catalog/filters";
import {
  buildStorefrontHref,
  type StorefrontFilterState,
} from "./catalog-state";
import { StorefrontDialog } from "./controls";
import s from "./storefront.module.css";

export function CatalogControls({
  state,
  options,
  thicknesses,
  categories,
  basePath,
  count,
  children,
}: {
  state: StorefrontFilterState;
  options: CatalogFilterOptions;
  thicknesses: string[];
  categories: { slug: string; name: string }[];
  basePath: string;
  count: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(false);
  function update(patch: Partial<StorefrontFilterState>) {
    startTransition(() =>
      router.push(
        buildStorefrontHref(basePath, { ...state, ...patch, page: 1 }),
        { scroll: false },
      ),
    );
  }
  function toggle(key: "brands" | "groups" | "thicknesses", value: string) {
    update({
      [key]: state[key].includes(value)
        ? state[key].filter((item) => item !== value)
        : [...state[key], value],
    });
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({
      q: String(new FormData(event.currentTarget).get("q") ?? "").trim(),
    });
  }
  const hasFilters =
    state.brands.length + state.groups.length + state.thicknesses.length > 0 ||
    state.inStockOnly ||
    !!state.q;
  function filters() {
    return (
      <div className={s.filterContent}>
        <div className={s.categoryLinks}>
          <Link
            href="/catalog"
            aria-current={basePath === "/catalog" ? "page" : undefined}
          >
            Все материалы
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/catalog/${category.slug}`}
              aria-current={
                basePath === `/catalog/${category.slug}` ? "page" : undefined
              }
              onClick={() => setOpen(false)}
            >
              {category.name}
            </Link>
          ))}
        </div>
        {(["brands", "groups"] as const).map(
          (key) =>
            options[key].length > 0 && (
              <fieldset key={key} disabled={pending}>
                <legend>{key === "brands" ? "Бренд" : "Декор"}</legend>
                {options[key].map((option) => (
                  <label key={option.value}>
                    <input
                      type="checkbox"
                      checked={state[key].includes(option.value)}
                      disabled={
                        !option.count && !state[key].includes(option.value)
                      }
                      onChange={() => toggle(key, option.value)}
                    />
                    {option.label}
                    <span>{option.count}</span>
                  </label>
                ))}
              </fieldset>
            ),
        )}
        {thicknesses.length > 0 && (
          <fieldset disabled={pending}>
            <legend>Толщина, мм</legend>
            <div className={s.thicknesses}>
              {thicknesses.map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={state.thicknesses.includes(value)}
                    onChange={() => toggle("thicknesses", value)}
                    aria-label={`${value} мм`}
                  />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className={s.stockFilter}>
          <input
            type="checkbox"
            disabled={pending}
            checked={state.inStockOnly}
            onChange={() => update({ inStockOnly: !state.inStockOnly })}
          />
          Только в наличии
        </label>
        {hasFilters && (
          <button
            type="button"
            className={s.resetFilter}
            disabled={pending}
            onClick={() =>
              update({
                brands: [],
                groups: [],
                thicknesses: [],
                inStockOnly: false,
                q: "",
              })
            }
          >
            <X size={15} />
            Сбросить фильтры
          </button>
        )}
      </div>
    );
  }
  return (
    <div className={s.catalogLayout} aria-busy={pending}>
      <aside className={s.sidebar}>
        <h2>
          <SlidersHorizontal size={17} />
          Фильтры
        </h2>
        {filters()}
      </aside>
      <div className={s.catalogResults}>
        <form onSubmit={search} className={s.catalogSearch} role="search">
          <Search size={18} />
          <input
            key={state.q}
            name="q"
            defaultValue={state.q}
            type="search"
            aria-label="Поиск в разделе"
            placeholder="Название или артикул"
          />
          <button
            className={s.iconButton}
            title="Найти в разделе"
            aria-label="Найти в разделе"
            disabled={pending}
          >
            <Search size={18} />
          </button>
        </form>
        <div className={s.catalogToolbar}>
          <span role="status">
            Найдено: <strong>{count}</strong>
          </span>
          <button
            type="button"
            className={s.mobileFilter}
            onClick={() => setOpen(true)}
          >
            <SlidersHorizontal size={16} />
            Фильтры
          </button>
          <label className={s.sort}>
            <span className={s.srOnly}>Сортировка</span>
            <select
              value={state.sort}
              disabled={pending}
              onChange={(event) =>
                update({
                  sort: event.target.value as StorefrontFilterState["sort"],
                })
              }
            >
              {[
                ...catalogSortOptions,
                { value: "price-asc", label: "Сначала дешевле" },
                { value: "price-desc", label: "Сначала дороже" },
              ].map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className={s.viewSwitch}>
            <button
              type="button"
              aria-label="Плитка"
              title="Плитка"
              aria-pressed={!list}
              onClick={() => setList(false)}
            >
              <Grid2X2 size={17} />
            </button>
            <button
              type="button"
              aria-label="Список"
              title="Список"
              aria-pressed={list}
              onClick={() => setList(true)}
            >
              <List size={18} />
            </button>
          </div>
        </div>
        {hasFilters && (
          <div className={s.filterChips}>
            {state.q && (
              <button
                type="button"
                disabled={pending}
                onClick={() => update({ q: "" })}
              >
                {state.q}
                <X size={14} />
              </button>
            )}
            {(["brands", "groups", "thicknesses"] as const).flatMap((key) =>
              state[key].map((value) => (
                <button
                  type="button"
                  key={key + value}
                  disabled={pending}
                  onClick={() => toggle(key, value)}
                >
                  {key === "thicknesses"
                    ? `${value} мм`
                    : (options[key].find((item) => item.value === value)
                        ?.label ?? value)}
                  <X size={14} />
                </button>
              )),
            )}
            {state.inStockOnly && (
              <button
                type="button"
                disabled={pending}
                onClick={() => update({ inStockOnly: false })}
              >
                В наличии
                <X size={14} />
              </button>
            )}
          </div>
        )}
        <div className={list ? s.resultsList : undefined}>{children}</div>
      </div>
      <StorefrontDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Фильтры каталога"
      >
        {filters()}
        <button
          type="button"
          className={s.primaryButton}
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Показать товары ({count})
        </button>
      </StorefrontDialog>
    </div>
  );
}
