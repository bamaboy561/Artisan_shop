import { ProductStatus } from "@/generated/prisma";
import type {
  Brand as PrismaBrand,
  Category as PrismaCategory,
  Product as PrismaProduct,
  ProductAttribute,
  ProductImage,
} from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import type {
  Brand,
  CalculatorMaterialId,
  CalculatorProductContext,
  CalculatorSheetPresetId,
  CatalogCategory,
  FeaturedProduct,
} from "@/features/catalog/types";

type PrismaProductWithRelations = PrismaProduct & {
  category: Pick<PrismaCategory, "slug" | "name">;
  brand: Pick<PrismaBrand, "slug" | "name"> | null;
  images: Pick<ProductImage, "url" | "alt" | "sortOrder">[];
  attributes: Pick<ProductAttribute, "name" | "value" | "sortOrder">[];
};

const PRODUCT_INCLUDE = {
  category: { select: { slug: true, name: true } },
  brand: { select: { slug: true, name: true } },
  images: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: { url: true, alt: true, sortOrder: true },
  },
  attributes: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: { name: true, value: true, sortOrder: true },
  },
};

function isCalculatorMaterialId(value: string): value is CalculatorMaterialId {
  return value === "ldsp-16" || value === "mdf-16";
}

function isCalculatorSheetPresetId(
  value: string,
): value is CalculatorSheetPresetId {
  return (
    value === "2800x2070" || value === "2750x1830" || value === "2800x1220"
  );
}

function buildSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapProduct(product: PrismaProductWithRelations): FeaturedProduct {
  const gallery = product.images.map((image) => image.url);
  const inStock =
    product.inventoryStatus === "IN_STOCK" ||
    product.inventoryStatus === "LIMITED";
  const purchaseMode: FeaturedProduct["purchaseMode"] =
    product.orderMode === "CART" ? "cart" : "request";
  const action =
    product.orderMode === "CART"
      ? "В корзину"
      : product.orderMode === "SERVICE"
        ? "Оставить заявку"
        : "Запросить цену";
  const availabilityText =
    product.inventoryStatus === "IN_STOCK"
      ? "В наличии."
      : product.inventoryStatus === "LIMITED"
        ? "Остаток ограничен — уточните партию у менеджера."
        : product.inventoryStatus === "OUT_OF_STOCK"
          ? "Сейчас нет на складе. Возможна поставка под заказ."
          : "Наличие, формат партии и итоговая стоимость уточняются менеджером после запроса.";

  const calculatorMaterialId =
    product.calculatorMaterialId &&
    isCalculatorMaterialId(product.calculatorMaterialId)
      ? product.calculatorMaterialId
      : undefined;
  const sheetPresetId =
    product.calculatorSheetPresetId &&
    isCalculatorSheetPresetId(product.calculatorSheetPresetId)
      ? product.calculatorSheetPresetId
      : undefined;

  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand?.name ?? "",
    brandSlug: product.brand?.slug ?? "",
    categorySlug: product.category.slug,
    categoryName: product.category.name,
    image: gallery[0] ?? "",
    gallery,
    price: product.price ?? undefined,
    oldPrice: product.compareAtPrice ?? undefined,
    sku: product.sku,
    inStock,
    format: product.format ?? "",
    summary: product.summary ?? "",
    description: product.description ?? "",
    action,
    purchaseMode,
    availabilityText,
    specifications: [
      product.brand?.name
        ? { key: "Бренд", value: product.brand.name }
        : null,
      { key: "Артикул", value: product.sku },
      ...product.attributes.map((attribute) => ({
        key: attribute.name,
        value: attribute.value,
      })),
    ].filter(Boolean) as FeaturedProduct["specifications"],
    searchText: buildSearchText([
      product.name,
      product.sku,
      product.brand?.name,
      product.category.name,
      product.summary,
    ]),
    calculatorMaterialId,
    sheetPresetId,
  };
}

function mapCategory(
  category: PrismaCategory & { _count?: { products: number } },
): CatalogCategory {
  return {
    slug: category.slug,
    name: category.name,
    summary: category.summary ?? "",
    indicator: category.indicator ?? "",
    scenario: category.scenario ?? "",
    coverImage: category.coverImage ?? "",
    spotlight: category.spotlight ?? "",
  };
}

function mapBrand(
  brand: PrismaBrand & { _count?: { products: number } },
  categorySlug: string | null,
): Brand {
  return {
    slug: brand.slug,
    name: brand.name,
    description: brand.description ?? "",
    country: brand.country ?? "",
    logoUrl: brand.logoUrl ?? undefined,
    productCount: brand._count?.products ?? 0,
    highlight: brand.description ?? "",
    categorySlug: categorySlug ?? "",
  };
}

export async function getPublicProducts(): Promise<FeaturedProduct[]> {
  if (!hasDatabaseUrl()) return [];

  const db = getDb();
  const products = await db.product.findMany({
    where: { status: ProductStatus.ACTIVE },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    include: PRODUCT_INCLUDE,
  });

  return products.map(mapProduct);
}

export async function getPublicProductBySlug(
  slug: string,
): Promise<FeaturedProduct | null> {
  if (!hasDatabaseUrl()) return null;

  const db = getDb();
  const product = await db.product.findFirst({
    where: { slug, status: ProductStatus.ACTIVE },
    include: PRODUCT_INCLUDE,
  });

  return product ? mapProduct(product) : null;
}

export async function getPublicProductsByCategory(
  categorySlug: string,
): Promise<FeaturedProduct[]> {
  if (!hasDatabaseUrl()) return [];

  const db = getDb();
  const products = await db.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      category: { slug: categorySlug },
    },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    include: PRODUCT_INCLUDE,
  });

  return products.map(mapProduct);
}

export async function getPublicProductsByBrand(
  brandSlug: string,
): Promise<FeaturedProduct[]> {
  if (!hasDatabaseUrl()) return [];

  const db = getDb();
  const products = await db.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      brand: { slug: brandSlug },
    },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    include: PRODUCT_INCLUDE,
  });

  return products.map(mapProduct);
}

export async function getPublicCategories(): Promise<CatalogCategory[]> {
  if (!hasDatabaseUrl()) return [];

  const db = getDb();
  const categories = await db.category.findMany({
    where: {
      products: {
        some: { status: ProductStatus.ACTIVE },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return categories.map(mapCategory);
}

export async function getPublicCategoryBySlug(
  slug: string,
): Promise<CatalogCategory | null> {
  if (!hasDatabaseUrl()) return null;

  const db = getDb();
  const category = await db.category.findUnique({ where: { slug } });
  return category ? mapCategory(category) : null;
}

export async function getPublicBrands(): Promise<Brand[]> {
  if (!hasDatabaseUrl()) return [];

  const db = getDb();
  const brands = await db.brand.findMany({
    include: {
      _count: { select: { products: true } },
      products: {
        where: { status: ProductStatus.ACTIVE },
        select: { category: { select: { slug: true } } },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return brands.map((brand) =>
    mapBrand(brand, brand.products[0]?.category.slug ?? null),
  );
}

export async function getCalculatorContextBySlug(
  slug: string,
): Promise<CalculatorProductContext | null> {
  if (!hasDatabaseUrl()) return null;

  const product = await getPublicProductBySlug(slug);
  if (!product?.calculatorMaterialId || !product.sheetPresetId) return null;

  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    calculatorMaterialId: product.calculatorMaterialId,
    sheetPresetId: product.sheetPresetId,
  };
}

export async function getFeaturedProducts(
  limit = 8,
): Promise<FeaturedProduct[]> {
  if (!hasDatabaseUrl()) return [];

  const db = getDb();
  const products = await db.product.findMany({
    where: { status: ProductStatus.ACTIVE, isFeatured: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: PRODUCT_INCLUDE,
  });

  return products.map(mapProduct);
}

export async function getCatalogMetrics() {
  if (!hasDatabaseUrl()) {
    return {
      productCount: 0,
      brandCount: 0,
      categoryCount: 0,
      furniturePanelCount: 0,
      mdfPanelCount: 0,
    };
  }

  const db = getDb();
  const [productCount, brandCount, categoryCount, furnitureCategory, mdfCategory] =
    await Promise.all([
      db.product.count({ where: { status: ProductStatus.ACTIVE } }),
      db.brand.count({
        where: { products: { some: { status: ProductStatus.ACTIVE } } },
      }),
      db.category.count({
        where: { products: { some: { status: ProductStatus.ACTIVE } } },
      }),
      db.category.findUnique({
        where: { slug: "ldsp" },
        select: { _count: { select: { products: true } } },
      }),
      db.category.findUnique({
        where: { slug: "mdf-panels" },
        select: { _count: { select: { products: true } } },
      }),
    ]);

  return {
    productCount,
    brandCount,
    categoryCount,
    furniturePanelCount: furnitureCategory?._count.products ?? 0,
    mdfPanelCount: mdfCategory?._count.products ?? 0,
  };
}
