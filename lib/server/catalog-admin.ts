import { getDb } from "@/lib/db";

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
      _count: {
        select: {
          orderItems: true,
          favorites: true,
        },
      },
    },
  });
}

export async function getAdminProductFormOptions() {
  const db = getDb();

  const [categories, brands, calculatorMaterials, calculatorSheetFormats] =
    await Promise.all([
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
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

  return { categories, brands, calculatorMaterials, calculatorSheetFormats };
}
