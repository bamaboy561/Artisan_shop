import Form from "next/form";
import Link from "next/link";
import { ListFilter, PackagePlus, UploadCloud } from "lucide-react";

import {
  InventoryStatus,
  ProductOrderMode,
  ProductStatus,
} from "@/generated/prisma";
import {
  bulkUpdateProductsAction,
  deleteProductAction,
} from "@/app/admin/actions";
import { ProductImportForm } from "@/app/admin/products/product-import-form";
import { NewProductForm } from "@/app/admin/products/new-product-form";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { BulkSelectionTools } from "@/components/admin/bulk-selection-tools";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import {
  getAdminProductFormOptions,
  getAdminProducts,
} from "@/lib/server/catalog-admin";
import {
  adminProductSortOptions,
  buildAdminProductsHref,
  filterAdminProducts,
  parseAdminProductSearchParams,
  sanitizeAdminProductFilterState,
  sortAdminProducts,
  type AdminProductFilterState,
} from "@/features/admin/product-filters";

export const dynamic = "force-dynamic";

type AdminProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<ProductStatus, string> = {
  [ProductStatus.DRAFT]: "Черновик",
  [ProductStatus.ACTIVE]: "Опубликован",
  [ProductStatus.ARCHIVED]: "Архив",
};

const orderModeLabels: Record<ProductOrderMode, string> = {
  [ProductOrderMode.CART]: "В корзину",
  [ProductOrderMode.REQUEST_PRICE]: "Запрос цены",
  [ProductOrderMode.SERVICE]: "Сервисная заявка",
};

const inventoryLabels: Record<InventoryStatus, string> = {
  [InventoryStatus.IN_STOCK]: "В наличии",
  [InventoryStatus.LIMITED]: "Остаток ограничен",
  [InventoryStatus.OUT_OF_STOCK]: "Нет в наличии",
  [InventoryStatus.ON_REQUEST]: "Под запрос",
};

const bulkActionOptions = [
  { value: "publish", label: "Опубликовать выбранные" },
  { value: "move-to-draft", label: "Перевести в черновики" },
  { value: "archive", label: "Архивировать" },
  { value: "feature", label: "Добавить в подборки" },
  { value: "unfeature", label: "Убрать из подборок" },
  { value: "set-cart", label: "Режим: в корзину" },
  { value: "set-request-price", label: "Режим: запрос цены" },
  { value: "set-service", label: "Режим: сервисная заявка" },
] as const;

function formatPrice(value: number | null) {
  if (value === null) {
    return "По запросу";
  }

  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value)} сом`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getStatusTone(status: ProductStatus) {
  switch (status) {
    case ProductStatus.ACTIVE:
      return "success" as const;
    case ProductStatus.DRAFT:
      return "warning" as const;
    case ProductStatus.ARCHIVED:
    default:
      return "neutral" as const;
  }
}

function getOrderModeTone(mode: ProductOrderMode) {
  switch (mode) {
    case ProductOrderMode.CART:
      return "success" as const;
    case ProductOrderMode.SERVICE:
      return "warning" as const;
    case ProductOrderMode.REQUEST_PRICE:
    default:
      return "accent" as const;
  }
}

function getInventoryTone(status: InventoryStatus) {
  switch (status) {
    case InventoryStatus.IN_STOCK:
      return "success" as const;
    case InventoryStatus.LIMITED:
      return "warning" as const;
    case InventoryStatus.OUT_OF_STOCK:
      return "neutral" as const;
    case InventoryStatus.ON_REQUEST:
    default:
      return "accent" as const;
  }
}

function getStateHref(
  state: AdminProductFilterState,
  overrides: Partial<AdminProductFilterState>,
) {
  return buildAdminProductsHref("/admin/products", {
    ...state,
    ...overrides,
  });
}

function getImportNumber(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "", 10);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getImportText(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning" | "accent";
}) {
  const toneClass = {
    neutral: "bg-[#f7f4ef] text-[var(--foreground)]",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
    accent: "bg-[#f4e7df] text-[#9d573d]",
  }[tone];

  return (
    <div className={`rounded-2xl px-3 py-2 ${toneClass}`}>
      <p className="text-lg leading-none font-semibold">{value}</p>
      <p className="mt-1 text-[10px] tracking-[0.14em] uppercase">{label}</p>
    </div>
  );
}

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Товары появятся после подключения базы данных"
        description="Раздел подготовлен под реальную работу каталога: создание товаров, импорт, цены, остатки, изображения и параметры калькулятора."
        steps={[
          "Настройте DATABASE_URL в окружении.",
          "Примените схему через prisma db push или миграции.",
          "Создайте реальные товары вручную или через импорт.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/products");

  const [
    { categories, brands, calculatorMaterials, calculatorSheetFormats },
    products,
    resolvedSearchParams,
  ] = await Promise.all([
    getAdminProductFormOptions(),
    getAdminProducts(),
    searchParams,
  ]);

  const parsedState = parseAdminProductSearchParams(resolvedSearchParams);
  const state = sanitizeAdminProductFilterState(parsedState, {
    categories,
    brands,
  });
  const filteredProducts = sortAdminProducts(
    filterAdminProducts(products, state),
    state.sort,
  );
  const importSummary = {
    created: getImportNumber(resolvedSearchParams, "importCreated"),
    updated: getImportNumber(resolvedSearchParams, "importUpdated"),
    skipped: getImportNumber(resolvedSearchParams, "importSkipped"),
    errors: getImportNumber(resolvedSearchParams, "importErrors"),
    warnings: getImportNumber(resolvedSearchParams, "importWarnings"),
    mapped: getImportNumber(resolvedSearchParams, "importMapped"),
    message: getImportText(resolvedSearchParams, "importMessage"),
  };
  const hasImportSummary =
    importSummary.created > 0 ||
    importSummary.updated > 0 ||
    importSummary.skipped > 0 ||
    importSummary.errors > 0 ||
    importSummary.warnings > 0 ||
    importSummary.mapped > 0 ||
    Boolean(importSummary.message);

  const activeCount = products.filter(
    (product) => product.status === ProductStatus.ACTIVE,
  ).length;
  const draftCount = products.filter(
    (product) => product.status === ProductStatus.DRAFT,
  ).length;
  const requestPriceCount = products.filter(
    (product) => product.orderMode === ProductOrderMode.REQUEST_PRICE,
  ).length;

  const activeFilters = [
    state.q
      ? {
          key: "q",
          label: `Поиск: ${state.q}`,
          href: getStateHref(state, { q: "" }),
        }
      : null,
    state.categoryId
      ? {
          key: "categoryId",
          label: `Категория: ${
            categories.find((item) => item.id === state.categoryId)?.name ??
            "выбрана"
          }`,
          href: getStateHref(state, { categoryId: "" }),
        }
      : null,
    state.brandId
      ? {
          key: "brandId",
          label: `Бренд: ${
            brands.find((item) => item.id === state.brandId)?.name ?? "выбран"
          }`,
          href: getStateHref(state, { brandId: "" }),
        }
      : null,
    state.status !== "all"
      ? {
          key: "status",
          label: `Статус: ${statusLabels[state.status]}`,
          href: getStateHref(state, { status: "all" }),
        }
      : null,
    state.orderMode !== "all"
      ? {
          key: "orderMode",
          label: `Сценарий: ${orderModeLabels[state.orderMode]}`,
          href: getStateHref(state, { orderMode: "all" }),
        }
      : null,
    state.featured !== "all"
      ? {
          key: "featured",
          label:
            state.featured === "featured" ? "Только подборки" : "Без подборок",
          href: getStateHref(state, { featured: "all" }),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string }>;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-[#24231f] bg-[#141411] text-white shadow-[0_22px_70px_rgba(20,20,17,0.18)]">
        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.24em] text-white/42 uppercase">
              Рабочее место каталога
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              Материалы и товары
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
              Создание карточек, черновики, импорт и быстрый контроль витрины
              без лишнего шума.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[560px]">
            <MiniStat label="всего" value={products.length} />
            <MiniStat label="на сайте" value={activeCount} tone="success" />
            <MiniStat label="черновики" value={draftCount} tone="warning" />
            <MiniStat
              label="запрос цены"
              value={requestPriceCount}
              tone="accent"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/8 px-4 py-3 sm:px-5">
          <Link
            href="#new-product"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-xs font-semibold text-[#151513] transition hover:bg-[#f2ece3]"
          >
            <PackagePlus className="size-4" strokeWidth={1.8} />
            Новый товар
          </Link>
          <Link
            href="#catalog-list"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/12 px-3.5 text-xs font-semibold text-white/76 transition hover:border-white/28 hover:text-white"
          >
            <ListFilter className="size-4" strokeWidth={1.8} />
            Список
          </Link>
          <Link
            href="#import-products"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/12 px-3.5 text-xs font-semibold text-white/76 transition hover:border-white/28 hover:text-white"
          >
            <UploadCloud className="size-4" strokeWidth={1.8} />
            Импорт Excel
          </Link>
        </div>
      </section>

      {hasImportSummary ? (
        <section
          className={`rounded-[20px] border p-4 ${
            importSummary.errors > 0
              ? "border-red-200 bg-red-50 text-red-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-950"
          }`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-70">
                Импорт Excel / 1С
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                {importSummary.message || "Импорт товаров завершен"}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-white/70 px-3 py-1">
                Создано: {importSummary.created}
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1">
                Обновлено: {importSummary.updated}
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1">
                Пропущено: {importSummary.skipped}
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1">
                Ошибки: {importSummary.errors}
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1">
                Колонки: {importSummary.mapped}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="new-product"
        className="surface-glow overflow-hidden rounded-[26px] border border-[color:var(--line)] bg-white/92"
      >
        <div className="flex flex-col gap-3 border-b border-[color:var(--line)] bg-[#fbfaf7] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#171613] text-white">
              <PackagePlus className="size-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-[-0.035em] text-[var(--foreground)] sm:text-2xl">
                Новый товар
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Основные поля помещаются в одном рабочем блоке. Дополнительные
                данные раскрываются ниже.
              </p>
            </div>
          </div>
          <Link
            href="#catalog-list"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] px-4 font-mono text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--foreground)] hover:text-[var(--foreground)]"
          >
            К списку
          </Link>
        </div>

        <div className="p-3 sm:p-4">
          <NewProductForm
            categories={categories}
            brands={brands}
            calculatorMaterials={calculatorMaterials}
            calculatorSheetFormats={calculatorSheetFormats}
            canUploadImages={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
            compact
          />
        </div>
      </section>

      <details
        id="import-products"
        className="surface-glow rounded-[22px] border border-[color:var(--line)] bg-white/88 p-3 sm:p-4"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4e7df] text-[#9d573d]">
              <UploadCloud className="size-5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Импорт Excel
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">
                Загрузка прайса или выгрузки 1С. Новые позиции попадут в
                черновики.
              </span>
            </span>
          </span>
          <span className="rounded-full border border-[color:var(--line)] px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
            Открыть
          </span>
        </summary>

        <ProductImportForm
          categories={categories}
          brands={brands}
          calculatorMaterials={calculatorMaterials}
          calculatorSheetFormats={calculatorSheetFormats}
        />
      </details>

      <section id="catalog-list" className="min-w-0 space-y-3">
        <section className="surface-glow rounded-[22px] border border-[color:var(--line)] bg-white/88 p-3 sm:p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <SectionHeading
              title="Список товаров"
              description={`Найдено ${filteredProducts.length} из ${products.length} позиций.`}
              titleClassName="text-xl sm:text-2xl"
              descriptionClassName="text-sm leading-6"
            />

            <div className="flex flex-wrap gap-2">
              <Link
                href={getStateHref(state, { status: "all", featured: "all" })}
                className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
              >
                Все
              </Link>
              <Link
                href={getStateHref(state, { status: ProductStatus.ACTIVE })}
                className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
              >
                Опубликованные
              </Link>
              <Link
                href={getStateHref(state, { status: ProductStatus.DRAFT })}
                className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
              >
                Черновики
              </Link>
              <Link
                href={getStateHref(state, { featured: "featured" })}
                className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
              >
                Подборки
              </Link>
            </div>
          </div>

          <Form
            action=""
            scroll={false}
            className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6"
          >
            <label className="grid gap-1.5 xl:col-span-2">
              <span className="text-xs font-medium text-[var(--foreground)]">
                Поиск
              </span>
              <Input
                name="q"
                defaultValue={state.q}
                placeholder="Название, SKU или адрес"
                className="h-9 sm:h-9"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[var(--foreground)]">
                Категория
              </span>
              <Select
                name="categoryId"
                defaultValue={state.categoryId}
                className="h-9 sm:h-9"
              >
                <option value="">Все категории</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[var(--foreground)]">
                Бренд
              </span>
              <Select
                name="brandId"
                defaultValue={state.brandId}
                className="h-9 sm:h-9"
              >
                <option value="">Все бренды</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[var(--foreground)]">
                Статус
              </span>
              <Select
                name="status"
                defaultValue={state.status}
                className="h-9 sm:h-9"
              >
                <option value="all">Все статусы</option>
                {Object.values(ProductStatus).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[var(--foreground)]">
                Сортировка
              </span>
              <Select
                name="sort"
                defaultValue={state.sort}
                className="h-9 sm:h-9"
              >
                {adminProductSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[var(--foreground)]">
                Сценарий
              </span>
              <Select
                name="orderMode"
                defaultValue={state.orderMode}
                className="h-9 sm:h-9"
              >
                <option value="all">Все сценарии</option>
                {Object.values(ProductOrderMode).map((mode) => (
                  <option key={mode} value={mode}>
                    {orderModeLabels[mode]}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[var(--foreground)]">
                Подборки
              </span>
              <Select
                name="featured"
                defaultValue={state.featured}
                className="h-9 sm:h-9"
              >
                <option value="all">Все позиции</option>
                <option value="featured">Только подборки</option>
                <option value="regular">Без подборок</option>
              </Select>
            </label>

            <div className="flex flex-wrap items-end gap-2 xl:col-span-6">
              <Button type="submit" variant="accent" size="sm" className="h-9">
                Применить
              </Button>
              <Link
                href="/admin/products"
                className="inline-flex h-9 items-center justify-center border border-[color:var(--line-strong)] px-4 font-mono text-[10px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
              >
                Сбросить
              </Link>
            </div>
          </Form>

          {activeFilters.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--line)] pt-3">
              {activeFilters.map((filter) => (
                <Link
                  key={filter.key}
                  href={filter.href}
                  className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] transition hover:border-[color:var(--line-strong)]"
                >
                  {filter.label} ×
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-3 grid gap-2 border-t border-[color:var(--line)] pt-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
            <BulkSelectionTools checkboxSelector="[data-product-bulk-checkbox='true']" />

            <form
              id="bulk-products-form"
              action={bulkUpdateProductsAction}
              className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <Select name="bulkAction" defaultValue="" className="h-9 sm:h-9">
                <option value="" disabled>
                  Действие для выбранных товаров
                </option>
                {bulkActionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <AdminSubmitButton
                type="submit"
                variant="secondary"
                className="h-9 w-full lg:w-auto"
                idleLabel="Применить"
                pendingLabel="Применяем..."
              />
            </form>
          </div>
        </section>

        {filteredProducts.length > 0 ? (
          <div className="grid gap-2">
            {filteredProducts.map((product) => {
              const imageUrl = product.images[0]?.url ?? "";
              const imageStyle = imageUrl
                ? { backgroundImage: `url(${imageUrl})` }
                : undefined;

              return (
                <article
                  key={product.id}
                  className="surface-glow group grid gap-3 rounded-[18px] border border-[color:var(--line)] bg-white/90 p-2.5 transition hover:border-[color:var(--line-strong)] sm:grid-cols-[auto_64px_minmax(0,1fr)] xl:grid-cols-[auto_68px_minmax(0,1fr)_180px_190px] xl:items-center"
                >
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      name="productIds"
                      value={product.id}
                      form="bulk-products-form"
                      data-product-bulk-checkbox="true"
                      className="mt-1 size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
                      aria-label={`Выбрать ${product.name}`}
                    />
                  </div>

                  <div
                    className="flex aspect-square w-full items-center justify-center rounded-[14px] border border-[color:var(--line)] bg-[#f3efe8] bg-cover bg-center text-xl font-semibold text-[var(--muted)] sm:w-[64px] xl:w-[68px]"
                    style={imageStyle}
                    aria-label={product.images[0]?.alt ?? product.name}
                  >
                    {imageUrl ? null : product.name.slice(0, 1).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-base font-semibold tracking-[-0.02em] text-[var(--foreground)] transition hover:text-[#9d573d]"
                      >
                        {product.name}
                      </Link>
                      <StatusBadge tone={getStatusTone(product.status)}>
                        {statusLabels[product.status]}
                      </StatusBadge>
                      {product.isFeatured ? (
                        <StatusBadge tone="accent">Подборка</StatusBadge>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      SKU: {product.sku} · /product/{product.slug}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge tone="neutral">
                        {product.category.name}
                      </StatusBadge>
                      <StatusBadge tone="neutral">
                        {product.brand?.name ?? "Без бренда"}
                      </StatusBadge>
                      <StatusBadge tone={getOrderModeTone(product.orderMode)}>
                        {orderModeLabels[product.orderMode]}
                      </StatusBadge>
                      <StatusBadge
                        tone={getInventoryTone(product.inventoryStatus)}
                      >
                        {inventoryLabels[product.inventoryStatus]}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-2.5">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {formatPrice(product.price)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      {product.format ?? "Формат не указан"}
                      {product.thicknessMm
                        ? ` · ${product.thicknessMm} мм`
                        : ""}
                    </p>
                    <p className="text-xs leading-5 text-[var(--muted)]">
                      Остаток: {product.stockQuantity ?? "не указан"}
                    </p>
                    <p className="text-xs leading-5 text-[var(--muted)]">
                      Обновлено: {formatDate(product.updatedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="inline-flex h-9 flex-1 items-center justify-center border border-[var(--line-strong)] px-3 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white xl:flex-none"
                    >
                      Править
                    </Link>
                    <Link
                      href={`/product/${product.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center border border-[var(--line-strong)] px-3 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)]"
                    >
                      Сайт
                    </Link>
                    <form action={deleteProductAction}>
                      <input type="hidden" name="id" value={product.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-9 text-red-600 hover:bg-red-50"
                      >
                        Удалить
                      </Button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="surface-glow rounded-[22px] border border-[color:var(--line)] bg-white/88 p-8 text-center">
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              По текущим фильтрам ничего не найдено
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Измените параметры поиска или сбросьте фильтры.
            </p>
            <Link
              href="/admin/products"
              className="mt-5 inline-flex h-10 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              Сбросить фильтры
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
