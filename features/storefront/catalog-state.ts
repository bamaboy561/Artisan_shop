import {
  buildCatalogHref,
  filterCatalogProducts,
  getCatalogFacetOptions,
  getCatalogFilterOptions,
  paginateCatalogProducts,
  parseCatalogSearchParams,
  sanitizeCatalogFilterState,
  sortCatalogProducts,
  type CatalogFilterState,
} from "@/features/catalog/filters";
import type { FeaturedProduct } from "@/features/catalog/types";

export type StorefrontFilterState = Omit<CatalogFilterState, "sort"> & {
  sort: CatalogFilterState["sort"] | "price-asc" | "price-desc";
  thicknesses: string[];
  inStockOnly: boolean;
};

function baseState(state: StorefrontFilterState): CatalogFilterState {
  return {
    ...state,
    sort: state.sort.startsWith("price-")
      ? "default"
      : (state.sort as CatalogFilterState["sort"]),
  };
}

export function productThickness(product: FeaturedProduct) {
  const specification = product.specifications.find((spec) =>
    /^(толщина|толщина материала|толщина плиты|толщина панели)(,?\s*мм)?$/i.test(
      spec.key.trim(),
    ),
  );
  const text = specification?.value ?? product.format;
  const match = specification
    ? text.match(/\d+(?:[.,]\d+)?/)
    : text.match(/(?:^|[,;·xх×\s])([\d]+(?:[.,]\d+)?)\s*мм(?:\s|$|[,;])/i);
  if (!match) return "";
  const number = Number(
    (specification ? match[0] : match[1]).replace(",", "."),
  );
  // Sheet dimensions must not become thickness facets.
  return Number.isFinite(number) && number > 0 && number <= 100
    ? String(number)
    : "";
}

export function buildStorefrontHref(
  path: string,
  state: StorefrontFilterState,
) {
  const url = new URL(
    buildCatalogHref(path, baseState(state)),
    "https://artisan.shop.kg",
  );
  if (state.sort.startsWith("price-")) url.searchParams.set("sort", state.sort);
  for (const thickness of new Set(state.thicknesses))
    url.searchParams.append("thickness", thickness);
  if (state.inStockOnly) url.searchParams.set("available", "1");
  return url.pathname + url.search;
}

export function getStorefrontCatalog(
  products: FeaturedProduct[],
  params: Record<string, string | string[] | undefined>,
) {
  const base = sanitizeCatalogFilterState(
    parseCatalogSearchParams(params),
    getCatalogFilterOptions(products),
  );
  const thicknesses = Array.from(
    new Set(products.map(productThickness).filter(Boolean)),
  ).sort((a, b) => Number(a) - Number(b));
  const raw = params.thickness
    ? Array.isArray(params.thickness)
      ? params.thickness
      : [params.thickness]
    : [];
  const sort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const available = Array.isArray(params.available)
    ? params.available[0]
    : params.available;
  const state: StorefrontFilterState = {
    ...base,
    sort: sort === "price-asc" || sort === "price-desc" ? sort : base.sort,
    thicknesses: [...new Set(raw)].filter((item) => thicknesses.includes(item)),
    inStockOnly: available === "1",
  };
  const constrained = products.filter(
    (p) =>
      (!state.inStockOnly || p.inStock) &&
      (!state.thicknesses.length ||
        state.thicknesses.includes(productThickness(p))),
  );
  const constrainedOptions = getCatalogFacetOptions(constrained, baseState(state));
  const allOptions = getCatalogFilterOptions(products);
  const options = {
    brands: allOptions.brands.map((option) => ({ ...option, count: constrainedOptions.brands.find((item) => item.value === option.value)?.count ?? 0 })),
    groups: allOptions.groups.map((option) => ({ ...option, count: constrainedOptions.groups.find((item) => item.value === option.value)?.count ?? 0 })),
  };
  const sorted = sortCatalogProducts(
    filterCatalogProducts(constrained, baseState(state)),
    baseState(state).sort,
  );
  if (state.sort.startsWith("price-"))
    sorted.sort((a, b) => {
      if (typeof a.price !== "number")
        return typeof b.price !== "number" ? 0 : 1;
      if (typeof b.price !== "number") return -1;
      return state.sort === "price-asc" ? a.price - b.price : b.price - a.price;
    });
  const pagination = paginateCatalogProducts(sorted, state.page);
  return {
    state: { ...state, page: pagination.currentPage },
    options,
    thicknesses,
    pagination,
  };
}
