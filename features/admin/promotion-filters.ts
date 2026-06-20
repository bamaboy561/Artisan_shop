import {
  DiscountType,
  PromotionStatus,
  PromotionTargetType,
} from "@/generated/prisma";

type SearchParamValue = string | string[] | undefined;
type AdminPromotionSearchParams = Record<string, SearchParamValue>;

export type AdminPromotionSort =
  | "updated-desc"
  | "starts-desc"
  | "discount-desc"
  | "usage-desc";

export type AdminPromotionHighlightFilter = "all" | "highlighted" | "regular";
export type AdminPromotionCodeFilter = "all" | "with-code" | "without-code";

export type AdminPromotionFilterState = {
  q: string;
  status: PromotionStatus | "all";
  targetType: PromotionTargetType | "all";
  highlighted: AdminPromotionHighlightFilter;
  promoCode: AdminPromotionCodeFilter;
  sort: AdminPromotionSort;
};

export type AdminPromotionItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: PromotionStatus;
  targetType: PromotionTargetType;
  discountType: DiscountType;
  discountValue: number;
  promoCode: string | null;
  minOrderTotal: number | null;
  usageLimit: number | null;
  usageCount: number;
  isHighlighted: boolean;
  badgeText: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  updatedAt: Date;
  products: Array<{
    product: {
      name: string;
      sku: string;
    };
  }>;
  categories: Array<{
    category: {
      name: string;
    };
  }>;
  _count: {
    products: number;
    categories: number;
  };
};

export const promotionStatusLabels: Record<PromotionStatus, string> = {
  [PromotionStatus.DRAFT]: "Черновик",
  [PromotionStatus.ACTIVE]: "Активна",
  [PromotionStatus.SCHEDULED]: "Запланирована",
  [PromotionStatus.EXPIRED]: "Завершена",
  [PromotionStatus.ARCHIVED]: "В архиве",
};

export const promotionTargetLabels: Record<PromotionTargetType, string> = {
  [PromotionTargetType.PRODUCT]: "Товар",
  [PromotionTargetType.CATEGORY]: "Категория",
  [PromotionTargetType.ORDER]: "Заказ",
};

export const discountTypeLabels: Record<DiscountType, string> = {
  [DiscountType.PERCENT]: "Процент",
  [DiscountType.FIXED_AMOUNT]: "Фиксированная сумма",
  [DiscountType.FIXED_PRICE]: "Фиксированная цена",
};

const validSorts = new Set<AdminPromotionSort>([
  "updated-desc",
  "starts-desc",
  "discount-desc",
  "usage-desc",
]);

const validHighlightedFilters = new Set<AdminPromotionHighlightFilter>([
  "all",
  "highlighted",
  "regular",
]);

const validCodeFilters = new Set<AdminPromotionCodeFilter>([
  "all",
  "with-code",
  "without-code",
]);

export const adminPromotionSortOptions: Array<{
  value: AdminPromotionSort;
  label: string;
}> = [
  { value: "updated-desc", label: "Сначала обновленные" },
  { value: "starts-desc", label: "Сначала ближайший старт" },
  { value: "discount-desc", label: "Скидка: по убыванию" },
  { value: "usage-desc", label: "Использование: по убыванию" },
];

function getFirstSearchValue(
  searchParams: AdminPromotionSearchParams,
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

export function parseAdminPromotionSearchParams(
  searchParams: AdminPromotionSearchParams,
): AdminPromotionFilterState {
  const statusCandidate = getFirstSearchValue(searchParams, "status");
  const targetCandidate = getFirstSearchValue(searchParams, "targetType");
  const highlightedCandidate = getFirstSearchValue(searchParams, "highlighted");
  const promoCodeCandidate = getFirstSearchValue(searchParams, "promoCode");
  const sortCandidate = getFirstSearchValue(searchParams, "sort");

  return {
    q: getFirstSearchValue(searchParams, "q").trim(),
    status:
      Object.values(PromotionStatus).find((item) => item === statusCandidate) ??
      "all",
    targetType:
      Object.values(PromotionTargetType).find(
        (item) => item === targetCandidate,
      ) ?? "all",
    highlighted: validHighlightedFilters.has(
      highlightedCandidate as AdminPromotionHighlightFilter,
    )
      ? (highlightedCandidate as AdminPromotionHighlightFilter)
      : "all",
    promoCode: validCodeFilters.has(
      promoCodeCandidate as AdminPromotionCodeFilter,
    )
      ? (promoCodeCandidate as AdminPromotionCodeFilter)
      : "all",
    sort: validSorts.has(sortCandidate as AdminPromotionSort)
      ? (sortCandidate as AdminPromotionSort)
      : "updated-desc",
  };
}

export function filterAdminPromotions(
  promotions: AdminPromotionItem[],
  state: AdminPromotionFilterState,
) {
  const query = normalizeSearchValue(state.q);

  return promotions.filter((promotion) => {
    if (state.status !== "all" && promotion.status !== state.status) {
      return false;
    }

    if (
      state.targetType !== "all" &&
      promotion.targetType !== state.targetType
    ) {
      return false;
    }

    if (state.highlighted === "highlighted" && !promotion.isHighlighted) {
      return false;
    }

    if (state.highlighted === "regular" && promotion.isHighlighted) {
      return false;
    }

    if (state.promoCode === "with-code" && !promotion.promoCode) {
      return false;
    }

    if (state.promoCode === "without-code" && promotion.promoCode) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchText = normalizeSearchValue(
      [
        promotion.name,
        promotion.slug,
        promotion.description ?? "",
        promotion.promoCode ?? "",
        promotion.badgeText ?? "",
        promotion.products.map((item) => item.product.name).join(" "),
        promotion.products.map((item) => item.product.sku).join(" "),
        promotion.categories.map((item) => item.category.name).join(" "),
      ].join(" "),
    );

    return searchText.includes(query);
  });
}

export function sortAdminPromotions(
  promotions: AdminPromotionItem[],
  sort: AdminPromotionSort,
) {
  const sorted = [...promotions];

  switch (sort) {
    case "starts-desc":
      return sorted.sort((left, right) => {
        const leftValue = left.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightValue =
          right.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;

        return leftValue - rightValue;
      });
    case "discount-desc":
      return sorted.sort(
        (left, right) => right.discountValue - left.discountValue,
      );
    case "usage-desc":
      return sorted.sort((left, right) => right.usageCount - left.usageCount);
    case "updated-desc":
    default:
      return sorted.sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      );
  }
}

export function buildAdminPromotionsHref(
  basePath: string,
  state: AdminPromotionFilterState,
) {
  const params = new URLSearchParams();

  if (state.q.trim()) {
    params.set("q", state.q.trim());
  }

  if (state.status !== "all") {
    params.set("status", state.status);
  }

  if (state.targetType !== "all") {
    params.set("targetType", state.targetType);
  }

  if (state.highlighted !== "all") {
    params.set("highlighted", state.highlighted);
  }

  if (state.promoCode !== "all") {
    params.set("promoCode", state.promoCode);
  }

  if (state.sort !== "updated-desc") {
    params.set("sort", state.sort);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
