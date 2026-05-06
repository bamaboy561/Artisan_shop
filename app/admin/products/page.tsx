import Form from "next/form";
import Link from "next/link";

import {
  InventoryStatus,
  ProductOrderMode,
  ProductStatus,
} from "@/generated/prisma";
import {
  bulkUpdateProductsAction,
  createProductAction,
  deleteProductAction,
  updateProductAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { BulkSelectionTools } from "@/components/admin/bulk-selection-tools";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(value);
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
        description="Раздел уже подготовлен под реальную работу с Prisma: можно создавать товары, привязывать их к категориям и брендам, а также управлять режимом заказа."
        steps={[
          "Настройте DATABASE_URL в .env.",
          "Примените схему через prisma db push или prisma migrate dev.",
          "Загрузите стартовые данные командой prisma db seed.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/products");

  const [{ categories, brands }, products, resolvedSearchParams] =
    await Promise.all([
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
          label: categories.find((item) => item.id === state.categoryId)?.name
            ? `Категория: ${
                categories.find((item) => item.id === state.categoryId)?.name
              }`
            : "Категория",
          href: getStateHref(state, { categoryId: "" }),
        }
      : null,
    state.brandId
      ? {
          key: "brandId",
          label: brands.find((item) => item.id === state.brandId)?.name
            ? `Бренд: ${brands.find((item) => item.id === state.brandId)?.name}`
            : "Бренд",
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

  const rows = filteredProducts.map((product) => ({
    select: (
      <input
        type="checkbox"
        name="productIds"
        value={product.id}
        form="bulk-products-form"
        data-product-bulk-checkbox="true"
        className="size-4 rounded border-[color:var(--line-strong)] accent-[var(--accent)]"
        aria-label={`Выбрать ${product.name}`}
      />
    ),
    product: (
      <div className="space-y-1">
        <p className="font-semibold text-[var(--foreground)]">{product.name}</p>
        <p className="text-xs text-[var(--muted)]">
          {product.sku} · {product.slug}
        </p>
      </div>
    ),
    placement: (
      <div className="space-y-1">
        <p>{product.category.name}</p>
        <p className="text-xs text-[var(--muted)]">
          {product.brand?.name ?? "Без бренда"}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Обновлён {formatDate(product.updatedAt)}
        </p>
      </div>
    ),
    commercial: (
      <div className="space-y-2">
        <p className="font-medium text-[var(--foreground)]">
          {formatPrice(product.price)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {product.format ?? "Формат не указан"}
        </p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getStatusTone(product.status)}>
            {statusLabels[product.status]}
          </StatusBadge>
          <StatusBadge tone={getOrderModeTone(product.orderMode)}>
            {orderModeLabels[product.orderMode]}
          </StatusBadge>
          {product.isFeatured ? (
            <StatusBadge tone="accent">В подборках</StatusBadge>
          ) : null}
        </div>
      </div>
    ),
    metrics: (
      <div className="space-y-2">
        <StatusBadge tone={getInventoryTone(product.inventoryStatus)}>
          {inventoryLabels[product.inventoryStatus]}
        </StatusBadge>
        <div className="text-xs leading-5 text-[var(--muted)]">
          <p>Заказов: {product._count.orderItems}</p>
          <p>Избранное: {product._count.favorites}</p>
        </div>
      </div>
    ),
    manage: (
      <form action={updateProductAction} className="grid gap-2">
        <input type="hidden" name="id" value={product.id} />
        <Select
          name="status"
          defaultValue={product.status}
          className="h-9 text-xs"
        >
          {Object.values(ProductStatus).map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </Select>
        <Select
          name="orderMode"
          defaultValue={product.orderMode}
          className="h-9 text-xs"
        >
          {Object.values(ProductOrderMode).map((mode) => (
            <option key={mode} value={mode}>
              {orderModeLabels[mode]}
            </option>
          ))}
        </Select>
        <Select
          name="inventoryStatus"
          defaultValue={product.inventoryStatus}
          className="h-9 text-xs"
        >
          {Object.values(InventoryStatus).map((status) => (
            <option key={status} value={status}>
              {inventoryLabels[status]}
            </option>
          ))}
        </Select>
        <Checkbox
          name="isFeatured"
          value="on"
          defaultChecked={product.isFeatured}
          label="В подборках"
          className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2"
        />
        <div className="flex flex-wrap gap-2">
          <AdminSubmitButton
            type="submit"
            variant="secondary"
            size="sm"
            idleLabel="Сохранить"
            pendingLabel="Сохраняем..."
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            formAction={deleteProductAction}
            className="text-red-600 hover:bg-red-50"
          >
            Удалить
          </Button>
        </div>
      </form>
    ),
  }));

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <SectionHeading
          title="Управление товарами"
          description="Рабочий контур для каталога: фильтруйте позиции, переключайте сценарии заказа, быстро публикуйте товары и управляйте подборками без перехода в отдельные экраны."
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
          detail="Позиции, уже доступные для публичной витрины"
        />
        <MetricCard
          label="Черновики"
          value={draftCount}
          detail="Карточки, которые ещё не выпущены в каталог"
        />
        <MetricCard
          label="Подборки"
          value={featuredCount}
          detail={`${requestPriceCount} товаров работают через запрос цены`}
        />
      </section>

      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              Фильтры
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              Быстрый срез каталога
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Фильтры держатся в URL, поэтому команде удобно возвращаться к
              нужной выборке или делиться рабочим состоянием страницы.
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
              Поиск по названию, SKU или slug
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

          <div className="flex flex-wrap items-end gap-3 xl:col-span-6">
            <Button type="submit" variant="accent">
              Применить
            </Button>
            <Link
              href="/admin/products"
              className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              Сбросить всё
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

      <section className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
        <article className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
          <SectionHeading
            title="Новый товар"
            description="Минимальная форма для запуска новой карточки. После создания товар сразу попадает в рабочий контур справа."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-7"
          />

          <form action={createProductAction} className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Название
                <Input name="name" placeholder="Swiss Krono Кашемир" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Slug
                <Input name="slug" placeholder="swiss-krono-kashmir" required />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                SKU
                <Input name="sku" placeholder="SK-KASHMIR-16" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Цена
                <Input name="price" type="number" min="0" placeholder="3150" />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Категория
                <Select name="categoryId" required defaultValue="">
                  <option value="" disabled>
                    Выберите категорию
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Бренд
                <Select name="brandId" defaultValue="">
                  <option value="">Без бренда</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Статус
                <Select name="status" defaultValue={ProductStatus.ACTIVE}>
                  {Object.values(ProductStatus).map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Режим заказа
                <Select
                  name="orderMode"
                  defaultValue={ProductOrderMode.REQUEST_PRICE}
                >
                  {Object.values(ProductOrderMode).map((mode) => (
                    <option key={mode} value={mode}>
                      {orderModeLabels[mode]}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Наличие
                <Select
                  name="inventoryStatus"
                  defaultValue={InventoryStatus.ON_REQUEST}
                >
                  {Object.values(InventoryStatus).map((status) => (
                    <option key={status} value={status}>
                      {inventoryLabels[status]}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Формат
                <Input name="format" placeholder="2800 x 2070 мм, 16 мм" />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                Изображение
                <Input
                  name="imageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Краткое описание
              <Textarea
                name="summary"
                rows={4}
                placeholder="Короткое коммерческое описание для карточки товара."
              />
            </label>

            <Checkbox
              name="isFeatured"
              value="on"
              label="Показывать в подборках и выделенных блоках"
              description="Используется для внутренних подборок и акцентных блоков витрины."
              className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3"
            />

            <AdminSubmitButton
              type="submit"
              variant="accent"
              className="w-full sm:w-auto"
              idleLabel="Добавить товар"
              pendingLabel="Добавляем..."
            />
          </form>
        </article>

        <article className="space-y-4">
          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                  Массовые действия
                </p>
                <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
                  Работа с текущей выборкой
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Выделите нужные позиции в таблице и быстро переведите их в
                  нужный статус или коммерческий режим.
                </p>
              </div>

              <BulkSelectionTools checkboxSelector="[data-product-bulk-checkbox='true']" />
            </div>

            <form
              id="bulk-products-form"
              action={bulkUpdateProductsAction}
              className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
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
                idleLabel="Применить"
                pendingLabel="Применяем..."
              />
            </form>
          </section>

          <DataTable
            columns={[
              { key: "select", label: "" },
              { key: "product", label: "Товар" },
              { key: "placement", label: "Раздел" },
              { key: "commercial", label: "Коммерция" },
              { key: "metrics", label: "Наличие и метрики" },
              { key: "manage", label: "Быстрое управление" },
            ]}
            rows={rows}
            caption="Товары"
            emptyMessage="По текущим фильтрам ничего не найдено. Измените срез или сбросьте параметры."
          />
        </article>
      </section>
    </div>
  );
}
