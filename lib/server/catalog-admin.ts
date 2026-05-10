import { getDb } from "@/lib/db";
import { ensureBrandLogoColumn } from "@/lib/server/brand-schema";

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

  return db.product.findMany({
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
      _count: {
        select: {
          orderItems: true,
          favorites: true,
        },
      },
    },
  });
}

const DEFAULT_CALCULATOR_MATERIALS = [
  { slug: "ldsp-16", label: "ЛДСП 16 мм" },
  { slug: "mdf-16", label: "МДФ 16 мм" },
];

const DEFAULT_CALCULATOR_SHEETS = [
  { slug: "2800x2070", label: "2800 × 2070 мм" },
  { slug: "2750x1830", label: "2750 × 1830 мм" },
  { slug: "2800x1220", label: "2800 × 1220 мм" },
];

export async function getAdminProductFormOptions() {
  const db = getDb();

  const [categories, brands, calculatorMaterials, calculatorSheetFormats] =
    await Promise.all([
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
    ]);

  return {
    categories,
    brands,
    calculatorMaterials:
      calculatorMaterials.length > 0
        ? calculatorMaterials
        : DEFAULT_CALCULATOR_MATERIALS,
    calculatorSheetFormats:
      calculatorSheetFormats.length > 0
        ? calculatorSheetFormats
        : DEFAULT_CALCULATOR_SHEETS,
  };
}
