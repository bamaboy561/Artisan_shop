import {
  ProductOrderMode,
  ProductStatus,
  type InventoryStatus,
} from "@/generated/prisma";

type SearchParamValue = string | string[] | undefined;
type AdminProductSearchParams = Record<string, SearchParamValue>;

export type AdminProductSort =
  | "updated-desc"
  | "name-asc"
  | "name-desc"
  | "sku-asc";

export type AdminProductFeaturedFilter = "all" | "featured" | "regular";

export type AdminProductFilterState = {
  q: string;
  categoryId: string;
  brandId: string;
  status: ProductStatus | "all";
  orderMode: ProductOrderMode | "all";
  featured: AdminProductFeaturedFilter;
  sort: AdminProductSort;
};

export type AdminProductItem = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  summary: string | null;
  categoryId: string;
  brandId: string | null;
  status: ProductStatus;
  orderMode: ProductOrderMode;
  inventoryStatus: InventoryStatus;
  price: number | null;
  format: string | null;
  isFeatured: boolean;
  updatedAt: Date;
  category: {
    name: string;
  };
  brand: {
    name: string;
  } | null;
  _count: {
    orderItems: number;
    favorites: number;
  };
};

const validSorts = new Set<AdminProductSort>([
  "updated-desc",
  "name-asc",
  "name-desc",
  "sku-asc",
]);

const validFeaturedFilters = new Set<AdminProductFeaturedFilter>([
  "all",
  "featured",
  "regular",
]);

export const adminProductSortOptions: Array<{
  value: AdminProductSort;
  label: string;
}> = [
  { value: "updated-desc", label: "Сначала новые" },
  { value: "name-asc", label: "Название: А-Я" },
  { value: "name-desc", label: "Название: Я-А" },
  { value: "sku-asc", label: "SKU: по возрастанию" },
];

function getFirstSearchValue(
  searchParams: AdminProductSearchParams,
  key: string,
) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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

export function parseAdminProductSearchParams(
  searchParams: AdminProductSearchParams,
): AdminProductFilterState {
  const statusCandidate = getFirstSearchValue(searchParams, "status");
  const orderModeCandidate = getFirstSearchValue(searchParams, "orderMode");
  const featuredCandidate = getFirstSearchValue(searchParams, "featured");
  const sortCandidate = getFirstSearchValue(searchParams, "sort");

  return {
    q: getFirstSearchValue(searchParams, "q").trim(),
    categoryId: getFirstSearchValue(searchParams, "categoryId").trim(),
    brandId: getFirstSearchValue(searchParams, "brandId").trim(),
    status:
      Object.values(ProductStatus).find((item) => item === statusCandidate) ??
      "all",
    orderMode:
      Object.values(ProductOrderMode).find((item) => item === orderModeCandidate) ??
      "all",
    featured: validFeaturedFilters.has(
      featuredCandidate as AdminProductFeaturedFilter,
    )
      ? (featuredCandidate as AdminProductFeaturedFilter)
      : "all",
    sort: validSorts.has(sortCandidate as AdminProductSort)
      ? (sortCandidate as AdminProductSort)
      : "updated-desc",
  };
}

export function sanitizeAdminProductFilterState(
  state: AdminProductFilterState,
  options: {
    categories: Array<{ id: string }>;
    brands: Array<{ id: string }>;
  },
): AdminProductFilterState {
  const validCategoryIds = new Set(options.categories.map((item) => item.id));
  const validBrandIds = new Set(options.brands.map((item) => item.id));

  return {
    ...state,
    categoryId: validCategoryIds.has(state.categoryId) ? state.categoryId : "",
    brandId: validBrandIds.has(state.brandId) ? state.brandId : "",
  };
}

export function filterAdminProducts(
  products: AdminProductItem[],
  state: AdminProductFilterState,
) {
  const query = normalizeSearchValue(state.q);

  return products.filter((product) => {
    if (state.categoryId && product.categoryId !== state.categoryId) {
      return false;
    }

    if (state.brandId && product.brandId !== state.brandId) {
      return false;
    }

    if (state.status !== "all" && product.status !== state.status) {
      return false;
    }

    if (state.orderMode !== "all" && product.orderMode !== state.orderMode) {
      return false;
    }

    if (state.featured === "featured" && !product.isFeatured) {
      return false;
    }

    if (state.featured === "regular" && product.isFeatured) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchText = normalizeSearchValue(
      [
        product.name,
        product.sku,
        product.slug,
        product.brand?.name ?? "",
        product.category.name,
        product.summary ?? "",
      ].join(" "),
    );

    return searchText.includes(query);
  });
}

export function sortAdminProducts(
  products: AdminProductItem[],
  sort: AdminProductSort,
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
    case "sku-asc":
      return sorted.sort((left, right) =>
        left.sku.localeCompare(right.sku, "en", { sensitivity: "base" }),
      );
    case "updated-desc":
    default:
      return sorted.sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      );
  }
}

export function buildAdminProductsHref(
  basePath: string,
  state: AdminProductFilterState,
) {
  const params = new URLSearchParams();

  if (state.q.trim()) {
    params.set("q", state.q.trim());
  }

  if (state.categoryId) {
    params.set("categoryId", state.categoryId);
  }

  if (state.brandId) {
    params.set("brandId", state.brandId);
  }

  if (state.status !== "all") {
    params.set("status", state.status);
  }

  if (state.orderMode !== "all") {
    params.set("orderMode", state.orderMode);
  }

  if (state.featured !== "all") {
    params.set("featured", state.featured);
  }

  if (state.sort !== "updated-desc") {
    params.set("sort", state.sort);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
