import type { FeaturedProduct } from "@/features/catalog/data";

export const CATALOG_PAGE_SIZE = 12;

export type CatalogSort = "default" | "name-asc" | "name-desc" | "brand-asc";

export type CatalogFilterState = {
  brands: string[];
  groups: string[];
  q: string;
  sort: CatalogSort;
  page: number;
};

export type CatalogFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type CatalogFilterOptions = {
  brands: CatalogFilterOption[];
  groups: CatalogFilterOption[];
};

export type CatalogPaginationResult<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
};

type SearchParamValue = string | string[] | undefined;
type CatalogSearchParams = Record<string, SearchParamValue>;

const validSorts = new Set<CatalogSort>([
  "default",
  "name-asc",
  "name-desc",
  "brand-asc",
]);

export const catalogSortOptions: Array<{
  value: CatalogSort;
  label: string;
}> = [
  { value: "default", label: "По умолчанию" },
  { value: "name-asc", label: "Название: А-Я" },
  { value: "name-desc", label: "Название: Я-А" },
  { value: "brand-asc", label: "Бренд: А-Я" },
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFilterValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSearchParamValues(
  searchParams: CatalogSearchParams,
  key: string,
): string[] {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function getOptionCountMap(
  products: FeaturedProduct[],
  key: "brandSlug" | "decorGroupSlug",
) {
  const countMap = new Map<string, number>();

  for (const product of products) {
    const value = product[key];

    if (!value) {
      continue;
    }

    countMap.set(value, (countMap.get(value) ?? 0) + 1);
  }

  return countMap;
}

export function getCatalogFilterOptions(products: FeaturedProduct[]) {
  const brandMap = new Map<string, CatalogFilterOption>();
  const groupMap = new Map<string, CatalogFilterOption>();

  for (const product of products) {
    const existingBrand = brandMap.get(product.brandSlug);

    brandMap.set(product.brandSlug, {
      value: product.brandSlug,
      label: product.brand,
      count: (existingBrand?.count ?? 0) + 1,
    });

    if (!product.decorGroup || !product.decorGroupSlug) {
      continue;
    }

    const existingGroup = groupMap.get(product.decorGroupSlug);

    groupMap.set(product.decorGroupSlug, {
      value: product.decorGroupSlug,
      label: product.decorGroup,
      count: (existingGroup?.count ?? 0) + 1,
    });
  }

  return {
    brands: Array.from(brandMap.values()),
    groups: Array.from(groupMap.values()),
  } satisfies CatalogFilterOptions;
}

export function getCatalogFacetOptions(
  products: FeaturedProduct[],
  state: CatalogFilterState,
) {
  const baseOptions = getCatalogFilterOptions(products);
  const productsForBrandCounts = filterCatalogProducts(products, {
    ...state,
    brands: [],
    page: 1,
  });
  const productsForGroupCounts = filterCatalogProducts(products, {
    ...state,
    groups: [],
    page: 1,
  });
  const brandCountMap = getOptionCountMap(productsForBrandCounts, "brandSlug");
  const groupCountMap = getOptionCountMap(
    productsForGroupCounts,
    "decorGroupSlug",
  );

  return {
    brands: baseOptions.brands.map((option) => ({
      ...option,
      count: brandCountMap.get(option.value) ?? 0,
    })),
    groups: baseOptions.groups.map((option) => ({
      ...option,
      count: groupCountMap.get(option.value) ?? 0,
    })),
  } satisfies CatalogFilterOptions;
}

export function parseCatalogSearchParams(
  searchParams: CatalogSearchParams,
): CatalogFilterState {
  const brands = uniqueValues(
    getSearchParamValues(searchParams, "brand")
      .map(normalizeFilterValue)
      .filter(Boolean),
  );

  const groups = uniqueValues(
    getSearchParamValues(searchParams, "group")
      .map(normalizeFilterValue)
      .filter(Boolean),
  );

  const q = getSearchParamValues(searchParams, "q")[0]?.trim() ?? "";
  const sortCandidate = getSearchParamValues(searchParams, "sort")[0];
  const sort = validSorts.has(sortCandidate as CatalogSort)
    ? (sortCandidate as CatalogSort)
    : "default";
  const pageCandidate = Number.parseInt(
    getSearchParamValues(searchParams, "page")[0] ?? "1",
    10,
  );

  return {
    brands,
    groups,
    q,
    sort,
    page:
      Number.isFinite(pageCandidate) && pageCandidate > 0 ? pageCandidate : 1,
  };
}

export function sanitizeCatalogFilterState(
  state: CatalogFilterState,
  options: CatalogFilterOptions,
): CatalogFilterState {
  const validBrands = new Set(options.brands.map((option) => option.value));
  const validGroups = new Set(options.groups.map((option) => option.value));

  return {
    ...state,
    brands: state.brands.filter((brand) => validBrands.has(brand)),
    groups: state.groups.filter((group) => validGroups.has(group)),
  };
}

export function filterCatalogProducts(
  products: FeaturedProduct[],
  state: CatalogFilterState,
) {
  const query = normalizeSearchValue(state.q);

  return products.filter((product) => {
    if (state.brands.length > 0 && !state.brands.includes(product.brandSlug)) {
      return false;
    }

    if (state.groups.length > 0) {
      if (!product.decorGroupSlug) {
        return false;
      }

      if (!state.groups.includes(product.decorGroupSlug)) {
        return false;
      }
    }

    if (query && !product.searchText.includes(query)) {
      return false;
    }

    return true;
  });
}

export function sortCatalogProducts(
  products: FeaturedProduct[],
  sort: CatalogSort,
) {
  const sorted = [...products];

  switch (sort) {
    case "name-asc":
      return sorted.sort((left, right) =>
        left.name.localeCompare(right.name, "ru", { sensitivity: "base" }),
      );
    case "name-desc":
      return sorted.sort((left, right) =>
        right.name.localeCompare(left.name, "ru", { sensitivity: "base" }),
      );
    case "brand-asc":
      return sorted.sort((left, right) => {
        const brandComparison = left.brand.localeCompare(right.brand, "ru", {
          sensitivity: "base",
        });

        if (brandComparison !== 0) {
          return brandComparison;
        }

        return left.name.localeCompare(right.name, "ru", {
          sensitivity: "base",
        });
      });
    case "default":
    default:
      return sorted;
  }
}

export function paginateCatalogProducts<T>(
  products: T[],
  page: number,
  pageSize = CATALOG_PAGE_SIZE,
): CatalogPaginationResult<T> {
  const totalItems = products.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage =
    Number.isFinite(page) && page > 0 ? Math.min(page, totalPages) : 1;
  const startIndex = (currentPage - 1) * pageSize;

  return {
    items: products.slice(startIndex, startIndex + pageSize),
    currentPage,
    totalPages,
    totalItems,
    pageSize,
  };
}

export function buildCatalogHref(basePath: string, state: CatalogFilterState) {
  const params = new URLSearchParams();

  for (const brand of uniqueValues(state.brands)) {
    params.append("brand", brand);
  }

  for (const group of uniqueValues(state.groups)) {
    params.append("group", group);
  }

  if (state.q.trim()) {
    params.set("q", state.q.trim());
  }

  if (state.sort !== "default") {
    params.set("sort", state.sort);
  }

  if (state.page > 1) {
    params.set("page", String(state.page));
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
