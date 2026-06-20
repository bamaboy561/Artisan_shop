import { getDb } from "@/lib/db";
import { ensureBrandLogoColumn } from "@/lib/server/brand-schema";
import { getEffectiveProductPrice } from "@/features/catalog/bundle-pricing";
import { ProductStatus } from "@/generated/prisma";
import { ensureProductBundleItemsTable } from "@/lib/server/product-bundle-schema";

export async function getAdminCategories() {
  const db = getDb();

  return db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          products: true,
          promotions: true,
        },
      },
    },
  });
}

export async function getAdminBrands() {
  const db = getDb();
  await ensureBrandLogoColumn(db);

  return db.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
    },
  });
}

export async function getAdminProducts() {
  const db = getDb();
  await ensureProductBundleItemsTable(db);

  const products = await db.product.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      brand: {
        select: {
          id: true,
          name: true,
        },
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: {
          url: true,
          alt: true,
        },
      },
      bundleItems: {
        select: {
          quantity: true,
          componentProduct: {
            select: {
              price: true,
            },
          },
        },
      },
      _count: {
        select: {
          orderItems: true,
          favorites: true,
        },
      },
    },
  });

  return products.map((product) => ({
    ...product,
    price: getEffectiveProductPrice(product),
  }));
}

const DEFAULT_CALCULATOR_MATERIALS = [
  { slug: "ldsp-10", label: "ЛДСП 10 мм" },
  { slug: "ldsp-16", label: "ЛДСП 16 мм" },
  { slug: "ldsp-18", label: "ЛДСП 18 мм" },
  { slug: "mdf-8", label: "МДФ 8 мм" },
  { slug: "mdf-10", label: "МДФ 10 мм" },
  { slug: "mdf-16", label: "МДФ 16 мм" },
  { slug: "mdf-18", label: "МДФ 18 мм" },
  { slug: "countertop-38", label: "Столешница 38 мм" },
  { slug: "countertop-40", label: "Столешница 40 мм" },
  { slug: "hpl-3", label: "HPL panel 3 mm" },
  { slug: "hpl-4", label: "HPL panel 4 mm" },
  { slug: "hpl-6", label: "HPL panel 6 mm" },
  { slug: "hpl-8", label: "HPL panel 8 mm" },
  { slug: "hpl-10", label: "HPL panel 10 mm" },
  { slug: "hpl-12", label: "HPL panel 12 mm" },
];

const DEFAULT_CALCULATOR_SHEETS = [
  { slug: "2440x1220", label: "2440 × 1220 мм" },
  { slug: "2500x1250", label: "2500 × 1250 мм" },
  { slug: "2800x2070", label: "2800 × 2070 мм" },
  { slug: "2750x1830", label: "2750 × 1830 мм" },
  { slug: "2800x1220", label: "2800 × 1220 мм" },
  { slug: "3050x1220", label: "3050 × 1220 мм" },
  { slug: "3660x1830", label: "3660 × 1830 мм" },
  { slug: "4100x600", label: "4100 × 600 мм" },
  { slug: "4100x1200", label: "4100 × 1200 мм" },
  { slug: "4200x600", label: "4200 × 600 мм" },
  { slug: "4200x1200", label: "4200 × 1200 мм" },
  { slug: "3050x1300", label: "3050 × 1300 мм" },
  { slug: "3050x1320", label: "3050 x 1320 mm" },
  { slug: "3660x1320", label: "3660 x 1320 mm" },
  { slug: "4200x1320", label: "4200 x 1320 mm" },
];

function mergeDefaultCalculatorOptions<T extends { slug: string }>(
  rows: T[],
  defaults: T[],
) {
  const existingSlugs = new Set(rows.map((row) => row.slug));

  return [...rows, ...defaults.filter((item) => !existingSlugs.has(item.slug))];
}

export async function getAdminProductFormOptions() {
  const db = getDb();
  await ensureProductBundleItemsTable(db);

  const [
    categories,
    brands,
    calculatorMaterials,
    calculatorSheetFormats,
    bundleProductOptions,
  ] = await Promise.all([
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
      },
    }),
    db.brand.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    db.calculatorMaterial.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        slug: true,
        label: true,
      },
    }),
    db.calculatorSheetFormat.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        slug: true,
        label: true,
      },
    }),
    db.product.findMany({
      where: { status: { not: ProductStatus.ARCHIVED } },
      orderBy: [{ name: "asc" }, { sku: "asc" }],
      take: 1500,
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stockQuantity: true,
        bundleItems: {
          select: {
            quantity: true,
            componentProduct: {
              select: {
                price: true,
              },
            },
          },
        },
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
  ]);

  return {
    categories,
    brands,
    calculatorMaterials:
      calculatorMaterials.length > 0
        ? mergeDefaultCalculatorOptions(
            calculatorMaterials,
            DEFAULT_CALCULATOR_MATERIALS,
          )
        : DEFAULT_CALCULATOR_MATERIALS,
    calculatorSheetFormats:
      calculatorSheetFormats.length > 0
        ? mergeDefaultCalculatorOptions(
            calculatorSheetFormats,
            DEFAULT_CALCULATOR_SHEETS,
          )
        : DEFAULT_CALCULATOR_SHEETS,
    bundleProductOptions: bundleProductOptions.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: getEffectiveProductPrice(product),
      stockQuantity: product.stockQuantity,
      brandName: product.brand?.name ?? "",
      categoryName: product.category.name,
    })),
  };
}
