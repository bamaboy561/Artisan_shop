"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  LayoutGrid,
  List,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  brands,
  catalogHref,
  categories,
  liveRoot,
  previewRoot,
  productCountLabel,
  products,
} from "./data";
import { PreviewCard, PreviewDialog } from "./shell";
import s from "./preview.module.css";

export function PreviewCatalog() {
  const params = useSearchParams();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const category = params.get("category") ?? "";
  const brand = params.get("brand") ?? "";
  const thickness = params.get("thickness") ?? "";
  const available = params.get("available") === "1";
  const query = params.get("q")?.trim() ?? "";
  const sort = params.get("sort") ?? "default";
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(catalogHref(Object.fromEntries(next)), { scroll: false });
  }
  const filtered = products
    .filter(
      (p) =>
        (!category || p.category === category) &&
        (!brand || p.brandSlug === brand) &&
        (!thickness || p.format.endsWith(`, ${thickness} мм`)) &&
        (!available || p.available) &&
        query
          .toLocaleLowerCase("ru-RU")
          .split(/\s+/)
          .every((token) =>
            `${p.name} ${p.sku} ${p.brand} ${p.categoryName} ${p.format}`
              .toLocaleLowerCase("ru-RU")
              .includes(token),
          ),
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : sort === "price-desc"
          ? (b.price ?? 0) - (a.price ?? 0)
          : sort === "name"
            ? a.name.localeCompare(b.name, "ru")
            : 0,
    );
  const title =
    categories.find((item) => item.slug === category)?.name ??
    "Каталог материалов";
  const active = [
    category && { key: "category", label: title },
    brand && {
      key: "brand",
      label: brands.find((item) => item.slug === brand)?.name ?? brand,
    },
    thickness && { key: "thickness", label: `${thickness} мм` },
    query && { key: "q", label: query },
    available && { key: "available", label: "В наличии" },
  ].filter((value): value is { key: string; label: string } => Boolean(value));
  const filterControls = (
    <div className={s.filterContent}>
      <fieldset>
        <legend>Категория</legend>
        <label>
          <input
            type="radio"
            name="category"
            checked={!category}
            onChange={() => setFilter("category", "")}
          />
          Все материалы<span>{products.length}</span>
        </label>
        {categories.map((item) => (
          <label key={item.slug}>
            <input
              type="radio"
              name="category"
              checked={category === item.slug}
              onChange={() => setFilter("category", item.slug)}
            />
            {item.name}
            <span>
              {products.filter((p) => p.category === item.slug).length}
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Бренд</legend>
        {brands
          .filter(
            (item) =>
              products.some((p) => p.brandSlug === item.slug) ||
              item.slug === brand,
          )
          .map((item) => (
            <label key={item.slug}>
              <input
                type="checkbox"
                checked={brand === item.slug}
                onChange={() =>
                  setFilter("brand", brand === item.slug ? "" : item.slug)
                }
              />
              {item.name}
            </label>
          ))}
      </fieldset>
      <fieldset>
        <legend>Толщина, мм</legend>
        <div className={s.thicknesses}>
          {[8, 12, 16, 18].map((mm) => (
            <label key={mm}>
              <input
                type="radio"
                name="thickness"
                checked={thickness === String(mm)}
                onClick={() => {
                  if (thickness === String(mm)) setFilter("thickness", "");
                }}
                onChange={() => setFilter("thickness", String(mm))}
              />
              <span>{mm}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className={s.stockFilter}>
        <input
          type="checkbox"
          checked={available}
          onChange={() => setFilter("available", available ? "" : "1")}
        />
        Только в наличии
      </label>
      {active.length ? (
        <Link href={catalogHref()} className={s.resetFilter}>
          Сбросить фильтры <X size={15} />
        </Link>
      ) : null}
    </div>
  );
  return (
    <div className={`${s.container} ${s.catalogPage}`}>
      <div className={s.breadcrumbs}>
        <Link href={previewRoot}>Главная</Link>
        <ChevronRight size={14} />
        <span>Каталог</span>
        {category ? (
          <>
            <ChevronRight size={14} />
            <span>{title}</span>
          </>
        ) : null}
      </div>
      <div className={s.catalogHeading}>
        <div>
          <p className={s.eyebrow}>Коллекция Artisan</p>
          <h1>{title}</h1>
        </div>
        <p>
          Для мебели, в которой
          <br />
          продумана каждая деталь.
        </p>
      </div>
      <div className={s.catalogLayout}>
        <aside className={s.sidebar} aria-label="Фильтры каталога">
          <h2>
            <SlidersHorizontal size={17} />
            Подбор материала
          </h2>
          {!filtersOpen ? filterControls : null}
        </aside>
        <div className={s.catalogResults}>
          <div className={s.catalogToolbar}>
            <span>{productCountLabel(filtered.length)}</span>
            <button
              className={s.mobileFilter}
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal size={18} />
              Фильтры {active.length || ""}
            </button>
            <label className={s.sort}>
              <span className={s.srOnly}>Сортировка</span>
              <select
                aria-label="Сортировка"
                value={sort}
                onChange={(e) => setFilter("sort", e.target.value)}
              >
                <option value="default">По умолчанию</option>
                <option value="price-asc">Сначала дешевле</option>
                <option value="price-desc">Сначала дороже</option>
                <option value="name">По названию</option>
              </select>
            </label>
            <div className={s.viewSwitch}>
              <button
                aria-label="Сетка"
                title="Сетка"
                aria-pressed={layout === "grid"}
                onClick={() => setLayout("grid")}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                aria-label="Список"
                title="Список"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
              >
                <List size={20} />
              </button>
            </div>
          </div>
          {active.length ? (
            <div className={s.filterChips}>
              {active.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key, "")}
                  aria-label={`Убрать фильтр ${item.label}`}
                >
                  {item.label}
                  <X size={14} />
                </button>
              ))}
            </div>
          ) : null}
          {filtered.length ? (
            <div
              className={`${s.catalogProducts} ${layout === "list" ? s.listLayout : ""}`}
            >
              {filtered.map((product) => (
                <PreviewCard key={product.slug} product={product} />
              ))}
            </div>
          ) : (
            <div className={s.empty}>
              <SearchX size={44} strokeWidth={1} />
              <h2>Не нашли подходящих товаров</h2>
              <p>В предпросмотре представлена небольшая часть каталога.</p>
              <Link href={catalogHref()} className={s.primaryButton}>
                Сбросить подбор <ArrowRight size={18} />
              </Link>
              {brand ? (
                <a
                  className={s.textLink}
                  href={`${liveRoot}/brands/${brand}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Бренд на действующем сайте <ArrowRight size={17} />
                </a>
              ) : null}
            </div>
          )}
          <p className={s.catalogNote}>
            Демонстрационная подборка. Актуальные цены и наличие — на
            действующем сайте.
          </p>
        </div>
      </div>
      <PreviewDialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Подбор материала"
      >
        {filtersOpen ? filterControls : null}
        <button
          className={s.primaryButton}
          onClick={() => setFiltersOpen(false)}
        >
          Показать товары · {filtered.length}
          <ArrowRight size={18} />
        </button>
      </PreviewDialog>
    </div>
  );
}
