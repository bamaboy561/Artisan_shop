import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteProductAction } from "@/app/admin/actions";
import {
  NewProductForm,
  type ProductFormDefaults,
} from "@/app/admin/products/new-product-form";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireAdminSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getAdminProductFormOptions } from "@/lib/server/catalog-admin";

export const dynamic = "force-dynamic";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  if (!hasDatabaseUrl()) notFound();

  await requireAdminSession("/login?next=/admin/products");

  const { id } = await params;
  const db = getDb();

  const [product, options] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          take: 1,
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
    isFeatured: product.isFeatured,
  };

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/products"
              className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase transition hover:text-[#9d573d]"
            >
              ← К списку товаров
            </Link>
            <SectionHeading
              title={product.name}
              description={`Редактирование карточки. SKU: ${product.sku}`}
              titleClassName="mt-2 text-2xl sm:text-3xl"
              descriptionClassName="text-sm leading-7"
            />
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

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
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
