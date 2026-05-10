import Form from "next/form";
import Link from "next/link";

import {
  InventoryStatus,
  ProductOrderMode,
  ProductStatus,
} from "@/generated/prisma";
import {
  bulkUpdateProductsAction,
  deleteProductAction,
} from "@/app/admin/actions";
import { NewProductForm } from "@/app/admin/products/new-product-form";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { BulkSelectionTools } from "@/components/admin/bulk-selection-tools";
import { MetricCard } from "@/components/admin/metric-card";
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

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Товары появятся после подключения базы данных"
        description="Раздел подготовлен под реальную работу каталога: создание товаров, привязка к категориям и брендам, сценарии заказа, цены, остатки и параметры калькулятора."
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

  const activeCount = products.filter(
    (product) => product.status === ProductStatus.ACTIVE,
  ).length;
  const draftCount = products.filter(
    (product) => product.status === ProductStatus.DRAFT,
  ).length;
  const featuredCount = products.filter((product) => product.isFeatured).length;
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
            state.featured === "featured"
              ? "Только подборки"
              : "Без подборок",
          href: getStateHref(state, { featured: "all" }),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string }>;

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <SectionHeading
          title="Управление товарами"
          description="Рабочий контур каталога: добавляйте реальные позиции, задавайте цены в сомах, сценарии заказа, остатки, изображения и параметры калькулятора."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Всего товаров"
          value={products.length}
          detail={`${filteredProducts.length} позиций видно по текущему срезу`}
        />
        <MetricCard
          label="Опубликовано"
          value={activeCount}
          detail="Позиции, доступные на публичной витрине"
          tone="success"
        />
        <MetricCard
          label="Черновики"
          value={draftCount}
          detail="Карточки, которые еще не выпущены в каталог"
          tone="warning"
        />
        <MetricCard
          label="Запрос цены"
          value={requestPriceCount}
          detail={`${featuredCount} товаров добавлены в подборки`}
          tone="accent"
        />
      </section>

      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              Фильтры
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              Быстрый срез каталога
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Фильтры сохраняются в URL, поэтому можно возвращаться к нужной
              выборке и делиться рабочим состоянием страницы.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={getStateHref(state, { status: "all", featured: "all" })}
              className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--line-strong)]"
            >
              Все товары
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

        <Form action="" scroll={false} className="mt-6 grid gap-4 xl:grid-cols-6">
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm text-[var(--foreground)]">
              Поиск по названию, SKU или адресу
            </span>
            <Input
              name="q"
              defaultValue={state.q}
              placeholder="Например, Swiss Krono D302"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Категория</span>
            <Select name="categoryId" defaultValue={state.categoryId}>
              <option value="">Все категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Бренд</span>
            <Select name="brandId" defaultValue={state.brandId}>
              <option value="">Все бренды</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Статус</span>
            <Select name="status" defaultValue={state.status}>
              <option value="all">Все статусы</option>
              {Object.values(ProductStatus).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Сортировка</span>
            <Select name="sort" defaultValue={state.sort}>
              {adminProductSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Сценарий</span>
            <Select name="orderMode" defaultValue={state.orderMode}>
              <option value="all">Все сценарии</option>
              {Object.values(ProductOrderMode).map((mode) => (
                <option key={mode} value={mode}>
                  {orderModeLabels[mode]}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--foreground)]">Подборки</span>
            <Select name="featured" defaultValue={state.featured}>
              <option value="all">Все позиции</option>
              <option value="featured">Только подборки</option>
              <option value="regular">Без подборок</option>
            </Select>
          </label>

          <div className="flex flex-wrap items-end gap-3 xl:col-span-6">
            <Button type="submit" variant="accent">
              Применить
            </Button>
            <Link
              href="/admin/products"
              className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              Сбросить все
            </Link>
            <span className="text-sm text-[var(--muted)]">
              Найдено {filteredProducts.length} из {products.length} позиций
            </span>
          </div>
        </Form>

        {activeFilters.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--line)] pt-5">
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
      </section>

      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            title="Новый товар"
            description="Создайте карточку товара. После сохранения ее можно сразу открыть в списке и доработать."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-6"
          />

          <p className="max-w-sm text-xs leading-5 text-[var(--muted)]">
            Для плитных материалов важно привязать формат листа и материал
            расчета, чтобы калькулятор открывался с правильными параметрами.
          </p>
        </div>

        <NewProductForm
          categories={categories}
          brands={brands}
          calculatorMaterials={calculatorMaterials}
          calculatorSheetFormats={calculatorSheetFormats}
          canUploadImages={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
        />
      </section>

      <section className="space-y-4">
        <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-5 sm:p-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                Массовые действия
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                Управление выбранными товарами
              </h3>
            </div>

            <BulkSelectionTools checkboxSelector="[data-product-bulk-checkbox='true']" />
          </div>

          <form
            id="bulk-products-form"
            action={bulkUpdateProductsAction}
            className="mt-5 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"
          >
            <Select name="bulkAction" defaultValue="">
              <option value="" disabled>
                Выберите действие для отмеченных товаров
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
              className="w-full lg:w-auto"
              idleLabel="Применить"
              pendingLabel="Применяем..."
            />
          </form>
        </section>

        {filteredProducts.length > 0 ? (
          <div className="grid gap-3">
            {filteredProducts.map((product) => {
              const imageUrl = product.images[0]?.url ?? "";
              const imageStyle = imageUrl
                ? { backgroundImage: `url(${imageUrl})` }
                : undefined;

              return (
                <article
                  key={product.id}
                  className="surface-glow grid gap-4 rounded-[24px] border border-[color:var(--line)] bg-white/88 p-4 sm:p-5 xl:grid-cols-[auto_116px_minmax(0,1fr)_260px]"
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
                    className="flex aspect-[4/3] w-full items-center justify-center rounded-[18px] border border-[color:var(--line)] bg-[#f3efe8] bg-cover bg-center text-2xl font-semibold text-[var(--muted)] xl:w-[116px]"
                    style={imageStyle}
                    aria-label={product.images[0]?.alt ?? product.name}
                  >
                    {imageUrl ? null : product.name.slice(0, 1).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)] transition hover:text-[#9d573d]"
                      >
                        {product.name}
                      </Link>
                      <StatusBadge tone={getStatusTone(product.status)}>
                        {statusLabels[product.status]}
                      </StatusBadge>
                      {product.isFeatured ? (
                        <StatusBadge tone="accent">В подборках</StatusBadge>
                      ) : null}
                    </div>

                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                      SKU: {product.sku} · /product/{product.slug}
                    </p>

                    <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
                      {product.summary ?? "Краткое описание пока не добавлено."}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
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

                  <div className="grid gap-3 xl:justify-items-stretch">
                    <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-4">
                      <p className="text-lg font-semibold text-[var(--foreground)]">
                        {formatPrice(product.price)}
                      </p>
                      {product.compareAtPrice ? (
                        <p className="mt-1 text-xs text-[var(--muted)] line-through">
                          {formatPrice(product.compareAtPrice)}
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                        {product.format ?? "Формат не указан"}
                        {product.thicknessMm ? ` · ${product.thicknessMm} мм` : ""}
                      </p>
                      <p className="text-xs leading-5 text-[var(--muted)]">
                        Остаток: {product.stockQuantity ?? "не указан"}
                      </p>
                      <p className="text-xs leading-5 text-[var(--muted)]">
                        Обновлено: {formatDate(product.updatedAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="inline-flex h-10 flex-1 items-center justify-center border border-[var(--line-strong)] px-4 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
                      >
                        Редактировать
                      </Link>
                      <Link
                        href={`/product/${product.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center justify-center border border-[var(--line-strong)] px-4 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)]"
                      >
                        Сайт
                      </Link>
                    </div>

                    <form action={deleteProductAction}>
                      <input type="hidden" name="id" value={product.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-full text-red-600 hover:bg-red-50"
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
          <div className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/88 p-8 text-center">
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              По текущим фильтрам ничего не найдено
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Измените параметры поиска или сбросьте фильтры, чтобы увидеть
              товары каталога.
            </p>
            <Link
              href="/admin/products"
              className="mt-5 inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              Сбросить фильтры
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
