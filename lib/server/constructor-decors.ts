import "server-only";

import { CategoryKind, ProductStatus } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getCalculatorBundle } from "@/lib/server/calculator-config";

// Плита для конструктора мебели: декор из каталога с фото и толщиной.
// id — тот же, что у плиты в калькуляторе распила (slug товара), чтобы
// калькулятор сразу подставил её.
export type ConstructorDecor = {
  id: string;
  label: string;
  name: string;
  brand: string;
  category: string;
  thickness: number;
  imageUrl: string | null;
  slug: string | null;
};

async function loadImages(slugs: string[]) {
  const images = new Map<string, { url: string | null; category: string }>();
  if (!hasDatabaseUrl() || slugs.length === 0) return images;

  try {
    const rows = await getDb().product.findMany({
      where: {
        slug: { in: slugs },
        status: ProductStatus.ACTIVE,
        category: { kind: CategoryKind.PLATE },
      },
      select: {
        slug: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { url: true },
        },
      },
    });
    for (const row of rows) {
      images.set(row.slug, {
        url: row.images[0]?.url ?? null,
        category: row.category.name,
      });
    }
  } catch (error) {
    console.error("[constructor-decors] images", error);
  }
  return images;
}

export async function getConstructorDecors(): Promise<ConstructorDecor[]> {
  const bundle = await getCalculatorBundle();
  const thicknessById = new Map(
    bundle.materials.map((material) => [material.id, material.thicknessMm]),
  );
  const catalog = bundle.presets.filter(
    (preset) => !preset.id.startsWith("manual:"),
  );
  const images = await loadImages(catalog.map((preset) => preset.id));
  const seen = new Set<string>();

  // Без каталога (нет базы) показываем обычные материалы калькулятора.
  const source = catalog.length > 0 ? catalog : bundle.presets;

  return source.flatMap((preset) => {
    const thickness = thicknessById.get(preset.materialId) ?? null;
    // Корпус и фасады — из плиты от 10 мм; ХДФ и тонкие плиты не подходят.
    if (!thickness || thickness < 10) return [];
    if (seen.has(preset.label)) return [];
    seen.add(preset.label);
    const isCatalog = !preset.id.startsWith("manual:");
    const extra = images.get(preset.id);
    return [
      {
        id: preset.id,
        label: preset.label,
        name: preset.materialName,
        brand: preset.brand,
        category: extra?.category ?? "",
        thickness,
        imageUrl: extra?.url ?? null,
        slug: isCatalog ? preset.id : null,
      },
    ];
  });
}

// Товар фурнитуры для подбора к списку конструктора.
export type ConstructorFittingProduct = {
  slug: string;
  name: string;
  // Название категории: по нему тоже ищем («Петли» у товара «Hettich Sensys»).
  category: string;
  // Бренд из карточки товара: по нему клиент выбирает фурнитуру
  // (Hettich, Italiana Ferramenta…).
  brand: string | null;
  price: number | null;
  imageUrl: string | null;
};

export async function getConstructorFittingProducts(): Promise<
  ConstructorFittingProduct[]
> {
  if (!hasDatabaseUrl()) return [];
  try {
    const rows = await getDb().product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        category: { kind: CategoryKind.FITTINGS },
      },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      take: 1500,
      select: {
        slug: true,
        name: true,
        price: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { url: true },
        },
      },
    });
    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      category: row.category.name,
      brand: row.brand?.name.trim() || null,
      price: row.price,
      imageUrl: row.images[0]?.url ?? null,
    }));
  } catch (error) {
    console.error("[constructor-decors] fittings", error);
    return [];
  }
}
