import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteProductAction } from "@/app/admin/actions";
import {
  NewProductForm,
  type ProductFormDefaults,
} from "@/app/admin/products/new-product-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductOrderMode, ProductStatus } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getAdminProductFormOptions } from "@/lib/server/catalog-admin";

export const dynamic = "force-dynamic";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
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

function formatPrice(value: number | null) {
  if (value === null) return "По запросу";

  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value)} сом`;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  if (!hasDatabaseUrl()) notFound();

  await requireAdminSession("/login?next=/admin/products");

  const { id } = await params;
  const db = getDb();

  const [product, options] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            name: true,
          },
        },
        brand: {
          select: {
            name: true,
          },
        },
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          take: 1,
        },
        attributes: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        _count: {
          select: {
            orderItems: true,
            favorites: true,
          },
        },
      },
    }),
    getAdminProductFormOptions(),
  ]);

  if (!product) notFound();

  const defaults: ProductFormDefaults = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    stockQuantity: product.stockQuantity,
    categoryId: product.categoryId,
    brandId: product.brandId,
    status: product.status,
    orderMode: product.orderMode,
    inventoryStatus: product.inventoryStatus,
    format: product.format,
    thicknessMm: product.thicknessMm,
    imageUrl: product.images[0]?.url ?? null,
    calculatorMaterialId: product.calculatorMaterialId,
    calculatorSheetPresetId: product.calculatorSheetPresetId,
    summary: product.summary,
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    attributesText: product.attributes
      .map((attribute) => `${attribute.name}: ${attribute.value}`)
      .join("\n"),
    isFeatured: product.isFeatured,
  };

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link
              href="/admin/products"
              className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase transition hover:text-[#9d573d]"
            >
              ← К списку товаров
            </Link>
            <SectionHeading
              title={product.name}
              description={`Редактирование карточки товара. SKU: ${product.sku}`}
              titleClassName="mt-2 text-2xl sm:text-3xl"
              descriptionClassName="text-sm leading-7"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={getStatusTone(product.status)}>
                {statusLabels[product.status]}
              </StatusBadge>
              <StatusBadge tone="accent">
                {orderModeLabels[product.orderMode]}
              </StatusBadge>
              <StatusBadge tone="neutral">{product.category.name}</StatusBadge>
              <StatusBadge tone="neutral">
                {product.brand?.name ?? "Без бренда"}
              </StatusBadge>
              {product.isFeatured ? (
                <StatusBadge tone="accent">В подборках</StatusBadge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/product/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center border border-[var(--line-strong)] px-4 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)]"
            >
              Открыть на сайте
            </Link>
            <form action={deleteProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-10 px-4 text-red-600 hover:bg-red-50"
              >
                Удалить товар
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="surface-glow rounded-[20px] border border-[color:var(--line)] bg-white/90 p-4">
          <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
            Цена
          </p>
          <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
            {formatPrice(product.price)}
          </p>
        </div>
        <div className="surface-glow rounded-[20px] border border-[color:var(--line)] bg-white/90 p-4">
          <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
            Остаток
          </p>
          <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
            {product.stockQuantity ?? "Не указан"}
          </p>
        </div>
        <div className="surface-glow rounded-[20px] border border-[color:var(--line)] bg-white/90 p-4">
          <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
            Заказы
          </p>
          <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
            {product._count.orderItems}
          </p>
        </div>
        <div className="surface-glow rounded-[20px] border border-[color:var(--line)] bg-white/90 p-4">
          <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
            Избранное
          </p>
          <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
            {product._count.favorites}
          </p>
        </div>
      </section>

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-6">
        <SectionHeading
          title="Данные товара"
          description="Измените карточку и сохраните. Публичная страница товара обновится автоматически."
          titleClassName="text-xl sm:text-2xl"
          descriptionClassName="text-sm leading-6"
        />

        <NewProductForm
          categories={options.categories}
          brands={options.brands}
          calculatorMaterials={options.calculatorMaterials}
          calculatorSheetFormats={options.calculatorSheetFormats}
          defaults={defaults}
        />
      </section>
    </div>
  );
}
