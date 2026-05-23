import { ProductStatus } from "@/generated/prisma";
import type {
  Brand as PrismaBrand,
  Category as PrismaCategory,
  Product as PrismaProduct,
  ProductAttribute,
  ProductBundleItem as PrismaProductBundleItem,
  ProductImage,
} from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { ensureBrandLogoColumn } from "@/lib/server/brand-schema";
import { ensureProductBundleItemsTable } from "@/lib/server/product-bundle-schema";
import {
  getProductBundleInfo,
  isBundleAttributeName,
} from "@/features/catalog/bundles";
import type {
  Brand,
  CalculatorMaterialId,
  CalculatorProductContext,
  CalculatorSheetPresetId,
  CatalogCategory,
  FeaturedProduct,
  ProductBundleItem,
} from "@/features/catalog/types";

type PrismaProductWithRelations = PrismaProduct & {
  category: Pick<PrismaCategory, "slug" | "name">;
  brand: Pick<PrismaBrand, "slug" | "name"> | null;
  images: Pick<ProductImage, "url" | "alt" | "sortOrder">[];
  attributes: Pick<ProductAttribute, "name" | "value" | "sortOrder">[];
  bundleItems: Array<
    Pick<PrismaProductBundleItem, "quantity" | "sortOrder"> & {
      componentProduct: Pick<
        PrismaProduct,
        "slug" | "name" | "sku" | "price"
      > & {
        brand: Pick<PrismaBrand, "name"> | null;
        images: Pick<ProductImage, "url" | "alt" | "sortOrder">[];
      };
    }
  >;
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
  bundleItems: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: {
      quantity: true,
      sortOrder: true,
      componentProduct: {
        select: {
          slug: true,
          name: true,
          sku: true,
          price: true,
          brand: { select: { name: true } },
          images: {
            orderBy: [
              { sortOrder: "asc" as const },
              { createdAt: "asc" as const },
            ],
            take: 1,
            select: { url: true, alt: true, sortOrder: true },
          },
        },
      },
    },
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

const DECOR_GROUP_SLUGS: Record<string, string> = {
  однотонные: "odnotonnye",
  дизайн: "dizayn",
  древесные: "drevesnye",
  trendy: "trendy",
  "trendy panel": "trendy",
  supramat: "supramat",
  "supramat panel": "supramat",
};

function getAttributeValue(
  attributes: Pick<ProductAttribute, "name" | "value">[],
  names: string[],
) {
  const normalizedNames = new Set(
    names.map((name) => name.trim().toLocaleLowerCase("ru-RU")),
  );

  return attributes.find((attribute) =>
    normalizedNames.has(attribute.name.trim().toLocaleLowerCase("ru-RU")),
  )?.value;
}

function getDecorGroupSlug(value: string) {
  const normalized = value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");

  return (
    DECOR_GROUP_SLUGS[normalized] ??
    normalized.replace(/[^a-zа-я0-9]+/giu, "-").replace(/^-+|-+$/g, "")
  );
}

function getProductDecorGroup(product: PrismaProductWithRelations) {
  const attributeValue = getAttributeValue(product.attributes, [
    "Группа декора",
    "Группа",
    "Коллекция",
    "Серия",
    "Подкатегория",
  ]);
  const inferredFromSku =
    product.brand?.slug === "agt"
      ? product.sku.toLocaleLowerCase("ru-RU").includes("supramat")
        ? "Supramat"
        : product.sku.toLocaleLowerCase("ru-RU").includes("trendy")
          ? "Trendy"
          : null
      : null;
  const group = attributeValue ?? inferredFromSku;

  if (!group) {
    return {};
  }

  const normalizedLabel = group.replace(/\s+panel$/i, "").trim();

  return {
    decorGroup: normalizedLabel,
    decorGroupSlug: getDecorGroupSlug(group),
  };
}

function mapCatalogBundleItems(
  product: PrismaProductWithRelations,
): ProductBundleItem[] {
  const linkedItems = product.bundleItems.map((item) => {
    const component = item.componentProduct;
    const brandPrefix = component.brand?.name ? `${component.brand.name} ` : "";

    return {
      label: `${brandPrefix}${component.name} — ${item.quantity} шт.`,
      productSlug: component.slug,
      productName: component.name,
      productSku: component.sku,
      brand: component.brand?.name ?? undefined,
      image: component.images[0]?.url,
      quantity: item.quantity,
      unitPrice: component.price ?? undefined,
    };
  });
  const legacyInfo = getProductBundleInfo(product.attributes);
  const seen = new Set(linkedItems.map((item) => item.label));
  const legacyItems = legacyInfo.items.filter((item) => {
    if (seen.has(item.label)) {
      return false;
    }

    seen.add(item.label);
    return true;
  });

  return [...linkedItems, ...legacyItems];
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
  const decorGroup = getProductDecorGroup(product);
  const bundleInfo = getProductBundleInfo(product.attributes);
  const bundleItems = mapCatalogBundleItems(product);
  const publicAttributes = product.attributes.filter(
    (attribute) => !isBundleAttributeName(attribute.name),
  );

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
    seoTitle: product.seoTitle ?? undefined,
    seoDescription: product.seoDescription ?? undefined,
    action,
    purchaseMode,
    availabilityText,
    specifications: [
      product.brand?.name ? { key: "Бренд", value: product.brand.name } : null,
      { key: "Артикул", value: product.sku },
      ...publicAttributes.map((attribute) => ({
        key: attribute.name,
        value: attribute.value,
      })),
    ].filter(Boolean) as FeaturedProduct["specifications"],
    isBundle: bundleInfo.isBundle || bundleItems.length > 0,
    bundleItems,
    ...decorGroup,
    searchText: buildSearchText([
      product.name,
      product.sku,
      product.brand?.name,
      product.category.name,
      product.summary,
      ...bundleItems.map((item) => item.label),
    ]),
    calculatorMaterialId,
    sheetPresetId,
    updatedAt: product.updatedAt,
  };
}

function mapCategory(
  category: PrismaCategory & { _count?: { products: number } },
): CatalogCategory {
  return {
    slug: category.slug,
    name: category.name,
    summary: category.summary ?? "",
    description: category.description ?? undefined,
    indicator: category.indicator ?? "",
    scenario: category.scenario ?? "",
    coverImage: category.coverImage ?? "",
    spotlight: category.spotlight ?? "",
    seoTitle: category.seoTitle ?? undefined,
    seoDescription: category.seoDescription ?? undefined,
    updatedAt: category.updatedAt,
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
    updatedAt: brand.updatedAt,
  };
}

const FALLBACK_PUBLIC_CATEGORIES: CatalogCategory[] = [
  {
    slug: "ldsp",
    name: "ЛДСП",
    summary: "Мебельные панели и декоры для корпусной мебели.",
    indicator: "Мебельные панели",
    scenario: "Запрос цены и распил",
    coverImage:
      "https://extravert.ru/wp-content/uploads/2023/11/kromka_D.301.W04.jpg",
    spotlight: "",
  },
  {
    slug: "mdf-panels",
    name: "МДФ панели",
    summary: "Фасадные и интерьерные МДФ панели.",
    indicator: "AGT / МДФ",
    scenario: "Запрос цены и консультация",
    coverImage:
      "https://www.agtwood.com/medium/Product/Image/daf29e0f-9b7b-46e4-babd-eadb915deb80",
    spotlight: "",
  },
  {
    slug: "furniture-fittings",
    name: "Фурнитура",
    summary: "Петли, направляющие, механизмы и комплектующие.",
    indicator: "Фурнитура",
    scenario: "Покупка или запрос цены",
    coverImage: "https://cheapollo.ru/statics/product/56567/6790b706620a4.jpg",
    spotlight: "",
  },
];

const FALLBACK_PUBLIC_BRANDS: Brand[] = [
  {
    slug: "agt",
    name: "AGT",
    description: "МДФ панели Trendy и Supramat.",
    country: "Турция",
    productCount: 0,
    highlight: "МДФ панели Trendy и Supramat.",
    categorySlug: "mdf-panels",
  },
  {
    slug: "swiss-krono",
    name: "Swiss Krono",
    description: "ЛДСП панели и декоры для мебели.",
    country: "Швейцария / Польша",
    productCount: 0,
    highlight: "ЛДСП панели и декоры для мебели.",
    categorySlug: "ldsp",
  },
  {
    slug: "extravert",
    name: "Extravert",
    description: "Мебельные панели ЛДСП для интерьерных задач.",
    country: "Россия",
    productCount: 0,
    highlight: "Мебельные панели ЛДСП для интерьерных задач.",
    categorySlug: "ldsp",
  },
  {
    slug: "hettich",
    name: "Hettich",
    description: "Фурнитура для функциональной корпусной мебели.",
    country: "Германия",
    productCount: 0,
    highlight: "Фурнитура для функциональной корпусной мебели.",
    categorySlug: "furniture-fittings",
  },
  {
    slug: "samet",
    name: "Samet",
    description: "Фурнитура для кухонь, шкафов и серийной мебели.",
    country: "Турция",
    productCount: 0,
    highlight: "Фурнитура для кухонь, шкафов и серийной мебели.",
    categorySlug: "furniture-fittings",
  },
  {
    slug: "emaks",
    name: "Emaks",
    description: "Мебельная фурнитура и комплектующие.",
    country: "",
    productCount: 0,
    highlight: "Мебельная фурнитура и комплектующие.",
    categorySlug: "furniture-fittings",
  },
  {
    slug: "slotex",
    name: "Slotex",
    description: "Столешницы, панели и декоративные поверхности.",
    country: "Россия",
    productCount: 0,
    highlight: "Столешницы, панели и декоративные поверхности.",
    categorySlug: "surfaces",
  },
  {
    slug: "nuomi",
    name: "Nuomi",
    description: "Системы хранения и организация пространства.",
    country: "",
    productCount: 0,
    highlight: "Системы хранения и организация пространства.",
    categorySlug: "organization",
  },
  {
    slug: "italiana-ferramenta",
    name: "Italiana Ferramenta",
    description: "Итальянская мебельная фурнитура и крепеж.",
    country: "Италия",
    productCount: 0,
    highlight: "Итальянская мебельная фурнитура и крепеж.",
    categorySlug: "furniture-fittings",
  },
];

const EMPTY_CATALOG_METRICS = {
  productCount: 0,
  brandCount: 0,
  categoryCount: 0,
  furniturePanelCount: 0,
  mdfPanelCount: 0,
};

let publicDbFallbackActive = false;

export function isPublicCatalogFallbackActive() {
  return publicDbFallbackActive || !hasDatabaseUrl();
}

function logPublicDbFallback(scope: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown database error";

  console.error(`[public-db-fallback] ${scope}: ${message}`);
}

async function withPublicDbFallback<T>(
  scope: string,
  fallback: T,
  loader: () => Promise<T>,
) {
  if (!hasDatabaseUrl()) return fallback;
  if (publicDbFallbackActive) return fallback;

  try {
    return await loader();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    if (
      message.includes("data transfer quota") ||
      message.includes("exceeded") ||
      message.includes("Raw query failed")
    ) {
      publicDbFallbackActive = true;
    }

    logPublicDbFallback(scope, error);
    return fallback;
  }
}

export async function getPublicProducts(): Promise<FeaturedProduct[]> {
  return withPublicDbFallback("getPublicProducts", [], async () => {
    const db = getDb();
    await ensureProductBundleItemsTable(db);
    const products = await db.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      include: PRODUCT_INCLUDE,
    });

    return products.map(mapProduct);
  });
}

export async function getPublicProductBySlug(
  slug: string,
): Promise<FeaturedProduct | null> {
  return withPublicDbFallback("getPublicProductBySlug", null, async () => {
    const db = getDb();
    await ensureProductBundleItemsTable(db);
    const product = await db.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      include: PRODUCT_INCLUDE,
    });

    return product ? mapProduct(product) : null;
  });
}

export async function getPublicProductsByCategory(
  categorySlug: string,
): Promise<FeaturedProduct[]> {
  return withPublicDbFallback("getPublicProductsByCategory", [], async () => {
    const db = getDb();
    await ensureProductBundleItemsTable(db);
    const products = await db.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        category: { slug: categorySlug },
      },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      include: PRODUCT_INCLUDE,
    });

    return products.map(mapProduct);
  });
}

export async function getPublicProductsByBrand(
  brandSlug: string,
): Promise<FeaturedProduct[]> {
  return withPublicDbFallback("getPublicProductsByBrand", [], async () => {
    const db = getDb();
    await ensureProductBundleItemsTable(db);
    const products = await db.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        brand: { slug: brandSlug },
      },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      include: PRODUCT_INCLUDE,
    });

    return products.map(mapProduct);
  });
}

export async function getPublicCategories(): Promise<CatalogCategory[]> {
  return withPublicDbFallback(
    "getPublicCategories",
    FALLBACK_PUBLIC_CATEGORIES,
    async () => {
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
    },
  );
}

export async function getPublicCategoryBySlug(
  slug: string,
): Promise<CatalogCategory | null> {
  return withPublicDbFallback(
    "getPublicCategoryBySlug",
    FALLBACK_PUBLIC_CATEGORIES.find((category) => category.slug === slug) ??
      null,
    async () => {
      const db = getDb();
      const category = await db.category.findUnique({ where: { slug } });
      return category ? mapCategory(category) : null;
    },
  );
}

export async function getPublicBrands(): Promise<Brand[]> {
  return withPublicDbFallback(
    "getPublicBrands",
    FALLBACK_PUBLIC_BRANDS,
    async () => {
      const db = getDb();
      await ensureBrandLogoColumn(db);
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
    },
  );
}

export async function getCalculatorContextBySlug(
  slug: string,
): Promise<CalculatorProductContext | null> {
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
  return withPublicDbFallback("getFeaturedProducts", [], async () => {
    const db = getDb();
    await ensureProductBundleItemsTable(db);
    const products = await db.product.findMany({
      where: { status: ProductStatus.ACTIVE, isFeatured: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: PRODUCT_INCLUDE,
    });

    return products.map(mapProduct);
  });
}

export async function getCatalogMetrics() {
  return withPublicDbFallback(
    "getCatalogMetrics",
    EMPTY_CATALOG_METRICS,
    async () => {
      const db = getDb();
      const [
        productCount,
        brandCount,
        categoryCount,
        furnitureCategory,
        mdfCategory,
      ] = await Promise.all([
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
    },
  );
}
