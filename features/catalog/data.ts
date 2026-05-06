import agtPanelsImport from "@/data/imports/agt-panels/catalog.json";
import extravertLdspImport from "@/data/imports/extravert-ldsp/catalog.json";
import swissKronoLdspImport from "@/data/imports/swisskrono-ldsp/catalog.json";

export type CatalogCategory = {
  slug: string;
  name: string;
  summary: string;
  indicator: string;
  scenario: string;
  coverImage: string;
  spotlight: string;
};

export type CatalogSection = {
  slug: string;
  name: string;
  description: string;
  routeHint?: string;
};

export type BrandCatalogAssignment = {
  slug: string;
  name: string;
  sectionSlug: string;
  sectionName: string;
  subcategories: string[];
  contentStatus: "active" | "planned";
};

export type ProductSpecification = {
  key: string;
  value: string;
};

export type CalculatorMaterialId = "ldsp-16" | "mdf-16";

export type CalculatorSheetPresetId =
  | "2800x2070"
  | "2750x1830"
  | "2800x1220";

export type CalculatorProductContext = {
  slug: string;
  name: string;
  brand: string;
  calculatorMaterialId: CalculatorMaterialId;
  sheetPresetId: CalculatorSheetPresetId;
};

export type FeaturedProduct = {
  slug: string;
  name: string;
  brand: string;
  brandSlug: string;
  categorySlug: string;
  categoryName: string;
  image: string;
  gallery: string[];
  price?: number;
  oldPrice?: number;
  sku: string;
  inStock: boolean;
  format: string;
  summary: string;
  description: string;
  action: string;
  purchaseMode: "cart" | "request";
  availabilityText: string;
  specifications: ProductSpecification[];
  decorGroup?: string;
  decorGroupSlug?: string;
  searchText: string;
  sourceUrl?: string;
  calculatorMaterialId?: CalculatorMaterialId;
  sheetPresetId?: CalculatorSheetPresetId;
};

export type Brand = {
  slug: string;
  name: string;
  description: string;
  country: string;
  productCount: number;
  highlight: string;
  categorySlug: string;
};

export type PartnerBrand = {
  slug: string;
  name: string;
  label: string;
  description: string;
  previewLabels: string[];
};

type ImportedExtravertProduct = (typeof extravertLdspImport.products)[number];
type ImportedSwissKronoProduct = (typeof swissKronoLdspImport.products)[number];
type ImportedAgtProduct = (typeof agtPanelsImport.products)[number];

type GroupConfig = {
  label: string;
  slug: string;
};

export const brandDisplayOrder = [
  "agt",
  "swiss-krono",
  "emmax",
  "samet",
  "slotex",
  "extravert",
  "hettich",
  "nuomi",
  "italiana-ferramenta",
];

export const catalogSections: CatalogSection[] = [
  {
    slug: "furniture-panels",
    name: "Мебельные панели",
    description:
      "ЛДСП, декоры и мебельные панели для корпусной мебели и интерьерных решений.",
    routeHint: "/catalog/ldsp",
  },
  {
    slug: "mdf-panels",
    name: "МДФ панели",
    description:
      "Фасадные и интерьерные МДФ панели для кухонь, шкафов и акцентных поверхностей.",
    routeHint: "/catalog/mdf-panels",
  },
  {
    slug: "furniture-fittings",
    name: "Фурнитура",
    description:
      "Петли, направляющие, подъемные механизмы, соединители и мебельные комплектующие.",
  },
  {
    slug: "organization",
    name: "Организация пространства",
    description:
      "Системы хранения и наполнения для кухонь, шкафов и гардеробных.",
  },
  {
    slug: "surfaces",
    name: "Столешницы и поверхности",
    description:
      "Декоративные поверхности, столешницы и связанные материалы для мебели и интерьера.",
  },
];

export const brandCatalogAssignments: BrandCatalogAssignment[] = [
  {
    slug: "agt",
    name: "AGT",
    sectionSlug: "mdf-panels",
    sectionName: "МДФ панели",
    subcategories: ["Trendy", "Supramat"],
    contentStatus: "active",
  },
  {
    slug: "swiss-krono",
    name: "Swiss Krono",
    sectionSlug: "furniture-panels",
    sectionName: "Мебельные панели",
    subcategories: ["Однотонные", "Дизайн", "Древесные"],
    contentStatus: "active",
  },
  {
    slug: "emmax",
    name: "Emmax",
    sectionSlug: "furniture-fittings",
    sectionName: "Фурнитура",
    subcategories: ["Петли", "Опоры", "Комплектующие"],
    contentStatus: "planned",
  },
  {
    slug: "samet",
    name: "Samet",
    sectionSlug: "furniture-fittings",
    sectionName: "Фурнитура",
    subcategories: ["Петли", "Ящики", "Подъемники"],
    contentStatus: "planned",
  },
  {
    slug: "slotex",
    name: "Slotex",
    sectionSlug: "surfaces",
    sectionName: "Столешницы и поверхности",
    subcategories: ["Столешницы", "Панели", "Поверхности"],
    contentStatus: "planned",
  },
  {
    slug: "extravert",
    name: "Extravert",
    sectionSlug: "furniture-panels",
    sectionName: "Мебельные панели",
    subcategories: ["Декоры", "Коллекции"],
    contentStatus: "active",
  },
  {
    slug: "hettich",
    name: "Hettich",
    sectionSlug: "furniture-fittings",
    sectionName: "Фурнитура",
    subcategories: ["Петли", "Направляющие", "Системы"],
    contentStatus: "planned",
  },
  {
    slug: "nuomi",
    name: "Nuomi",
    sectionSlug: "organization",
    sectionName: "Организация пространства",
    subcategories: ["Хранение", "Кухня", "Гардероб"],
    contentStatus: "planned",
  },
  {
    slug: "italiana-ferramenta",
    name: "Italiana Ferramenta",
    sectionSlug: "furniture-fittings",
    sectionName: "Фурнитура",
    subcategories: ["Крепеж", "Подвесы", "Системы"],
    contentStatus: "planned",
  },
];

const furniturePanelsHeroImage =
  extravertLdspImport.products.find((product) => product.images[0])?.images[0]
    ?.sourceUrl ??
  swissKronoLdspImport.products.find((product) => product.previewImageUrl)
    ?.previewImageUrl ??
  swissKronoLdspImport.products.find((product) => product.images[0])?.images[0]
    ?.sourceUrl ??
  "";

const mdfPanelsHeroImage =
  agtPanelsImport.products.find((product) => product.previewImageUrl)
    ?.previewImageUrl ??
  agtPanelsImport.products.find((product) => product.images[0])?.images[0]
    ?.sourceUrl ??
  furniturePanelsHeroImage;

const swissDecorGroupMap: Record<string, GroupConfig> = {
  ОДНОТОННЫЕ: {
    label: "Однотонные",
    slug: "odnotonnye",
  },
  ДИЗАЙН: {
    label: "Дизайн",
    slug: "dizayn",
  },
  ДРЕВЕСНЫЕ: {
    label: "Древесные",
    slug: "drevesnye",
  },
};

const agtSubcategoryMap: Record<string, GroupConfig> = {
  "trendy-panel": {
    label: "Trendy",
    slug: "trendy",
  },
  "supramat-panel": {
    label: "Supramat",
    slug: "supramat",
  },
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyCatalogValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getBrandDisplayIndex(slug: string) {
  const index = brandDisplayOrder.indexOf(slug);
  return index === -1 ? brandDisplayOrder.length : index;
}

export function getBrandCatalogAssignment(slug: string) {
  return brandCatalogAssignments.find((brand) => brand.slug === slug);
}

function getShortDescription(description: string) {
  const normalized = description.trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= 160) {
    return normalized;
  }

  const firstSentence = normalized.match(/^(.{1,180}?[.!?])(\s|$)/)?.[1];

  if (firstSentence) {
    return firstSentence.trim();
  }

  return `${normalized.slice(0, 157).trim()}...`;
}

function formatDimensions(lengthMm?: number | null, widthMm?: number | null) {
  if (!lengthMm || !widthMm) {
    return null;
  }

  return `${lengthMm} x ${widthMm} мм`;
}

function getSwissDecorGroupConfig(group?: string | null) {
  if (!group) {
    return null;
  }

  const normalized = group.trim().toUpperCase();
  return (
    swissDecorGroupMap[normalized] ?? {
      label: normalized.charAt(0) + normalized.slice(1).toLowerCase(),
      slug: slugifyCatalogValue(normalized),
    }
  );
}

function getAgtSubcategoryConfig(
  collectionSlug?: string | null,
  collectionName?: string | null,
) {
  if (collectionSlug && agtSubcategoryMap[collectionSlug]) {
    return agtSubcategoryMap[collectionSlug];
  }

  if (!collectionName) {
    return null;
  }

  const normalized = collectionName.replace(/panel/gi, "").trim();

  return {
    label: normalized || collectionName.trim(),
    slug: slugifyCatalogValue(normalized || collectionName),
  };
}

function buildSearchText(parts: string[]) {
  return normalizeSearchText(parts.filter(Boolean).join(" "));
}

function buildExtravertSummary(product: ImportedExtravertProduct) {
  const detailParts = [
    formatDimensions(product.lengthMm, product.widthMm),
    product.thicknessMm.length > 0
      ? `Толщины ${product.thicknessMm.join(", ")} мм`
      : null,
    product.emissionClasses.length > 0
      ? `Эмиссия ${product.emissionClasses.join(", ")}`
      : null,
  ].filter(Boolean);
  const shortDescription = getShortDescription(product.description);

  return [detailParts.join(" · "), shortDescription].filter(Boolean).join(". ");
}

function buildSwissKronoSummary(product: ImportedSwissKronoProduct) {
  const decorGroup = getSwissDecorGroupConfig(product.decorGroup);
  const detailParts = [
    decorGroup ? `Группа ${decorGroup.label}` : null,
    product.isNew ? "Новинка" : null,
  ].filter(Boolean);
  const shortDescription = getShortDescription(product.description);

  return [detailParts.join(" · "), shortDescription].filter(Boolean).join(". ");
}

function buildAgtSummary(product: ImportedAgtProduct) {
  const subcategory = getAgtSubcategoryConfig(
    product.collectionSlug,
    product.collectionName,
  );
  const detailParts = [
    subcategory ? `Подкатегория ${subcategory.label}` : null,
    ...product.tags.slice(0, 2),
  ].filter(Boolean);
  const shortDescription = getShortDescription(
    product.description || product.collectionTitle,
  );

  return [detailParts.join(" · "), shortDescription].filter(Boolean).join(". ");
}

function mapExtravertProduct(
  product: ImportedExtravertProduct,
): FeaturedProduct {
  const gallery = uniqueStrings(product.images.map((image) => image.sourceUrl));
  const format =
    formatDimensions(product.lengthMm, product.widthMm) ?? "Формат уточняется";

  return {
    slug: product.slug,
    name: product.name,
    brand: product.brandName,
    brandSlug: slugifyCatalogValue(product.brandName),
    categorySlug: "ldsp",
    categoryName: "Мебельные панели",
    image: gallery[0] ?? furniturePanelsHeroImage,
    gallery,
    sku: product.sku,
    inStock: false,
    format,
    summary: buildExtravertSummary(product),
    description: product.description,
    action: "Запросить цену",
    purchaseMode: "request",
    availabilityText:
      "Наличие, формат партии и итоговая стоимость уточняются менеджером после запроса.",
    specifications: [
      { key: "Бренд", value: product.brandName },
      { key: "Артикул", value: product.sku },
      ...Object.entries(product.properties).map(([key, value]) => ({
        key,
        value: String(value),
      })),
    ],
    searchText: buildSearchText([
      product.name,
      product.sku,
      product.brandName,
      "мебельные панели",
      "лдсп",
    ]),
    sourceUrl: product.sourceUrl,
    calculatorMaterialId: "ldsp-16",
    sheetPresetId: "2800x2070",
  };
}

function mapSwissKronoProduct(
  product: ImportedSwissKronoProduct,
): FeaturedProduct {
  const gallery = uniqueStrings([
    product.previewImageUrl,
    ...product.images.map((image) => image.sourceUrl),
  ]);
  const decorGroup = getSwissDecorGroupConfig(product.decorGroup);

  return {
    slug: product.slug,
    name: product.name,
    brand: product.brandName,
    brandSlug: slugifyCatalogValue(product.brandName),
    categorySlug: "ldsp",
    categoryName: "Мебельные панели",
    image: gallery[0] ?? furniturePanelsHeroImage,
    gallery,
    sku: product.sku,
    inStock: false,
    format: decorGroup?.label ?? "Мебельная панель",
    summary: buildSwissKronoSummary(product),
    description: product.description,
    action: "Запросить цену",
    purchaseMode: "request",
    availabilityText:
      "Наличие, актуальная партия и условия поставки уточняются менеджером после запроса.",
    specifications: [
      { key: "Бренд", value: product.brandName },
      { key: "Артикул", value: product.sku },
      ...Object.entries(product.properties).map(([key, value]) => ({
        key,
        value: String(value),
      })),
    ],
    decorGroup: decorGroup?.label,
    decorGroupSlug: decorGroup?.slug,
    searchText: buildSearchText([
      product.name,
      product.sku,
      product.brandName,
      decorGroup?.label ?? "",
      "мебельные панели",
      "лдсп",
    ]),
    sourceUrl: product.sourcePageUrl,
    calculatorMaterialId: "ldsp-16",
    sheetPresetId: "2750x1830",
  };
}

function mapAgtProduct(product: ImportedAgtProduct): FeaturedProduct {
  const gallery = uniqueStrings([
    product.previewImageUrl,
    ...product.images.map((image) => image.sourceUrl),
  ]);
  const subcategory = getAgtSubcategoryConfig(
    product.collectionSlug,
    product.collectionName,
  );
  const specificationHighlights = uniqueStrings(product.tags)
    .slice(0, 2)
    .map((tag, index) => ({
      key: `Особенность ${index + 1}`,
      value: tag,
    }));

  return {
    slug: product.slug,
    name: product.name,
    brand: product.brandName,
    brandSlug: slugifyCatalogValue(product.brandName),
    categorySlug: "mdf-panels",
    categoryName: "МДФ панели",
    image: gallery[0] ?? mdfPanelsHeroImage,
    gallery,
    sku: product.sku,
    inStock: false,
    format: subcategory?.label ?? "МДФ панель",
    summary: buildAgtSummary(product),
    description:
      product.description ||
      product.collectionTitle ||
      "МДФ панель для мебельных и интерьерных решений.",
    action: "Запросить цену",
    purchaseMode: "request",
    availabilityText:
      "Наличие, формат панели и итоговые условия поставки уточняются менеджером после запроса.",
    specifications: [
      { key: "Бренд", value: product.brandName },
      { key: "Артикул", value: product.sku },
      {
        key: "Подкатегория",
        value: subcategory?.label ?? product.collectionName,
      },
      ...specificationHighlights,
    ],
    decorGroup: subcategory?.label,
    decorGroupSlug: subcategory?.slug,
    searchText: buildSearchText([
      product.name,
      product.sku,
      product.brandName,
      product.collectionName,
      subcategory?.label ?? "",
      "мдф панели",
    ]),
    sourceUrl: product.sourceUrl,
    calculatorMaterialId: "mdf-16",
    sheetPresetId: "2800x1220",
  };
}

function buildFeaturedMix(collections: FeaturedProduct[][], limit: number) {
  const mixed: FeaturedProduct[] = [];
  const maxLength = Math.max(
    ...collections.map((collection) => collection.length),
  );

  for (let index = 0; index < maxLength; index += 1) {
    for (const collection of collections) {
      const product = collection[index];

      if (!product) {
        continue;
      }

      mixed.push(product);

      if (mixed.length === limit) {
        return mixed;
      }
    }
  }

  return mixed;
}

export const importedExtravertProducts: FeaturedProduct[] =
  extravertLdspImport.products.map(mapExtravertProduct);

export const importedSwissKronoProducts: FeaturedProduct[] =
  swissKronoLdspImport.products.map(mapSwissKronoProduct);

export const importedAgtProducts: FeaturedProduct[] =
  agtPanelsImport.products.map(mapAgtProduct);

export const catalogProducts: FeaturedProduct[] = [
  ...importedExtravertProducts,
  ...importedSwissKronoProducts,
  ...importedAgtProducts,
];

export const catalogMetrics = {
  decorCount: catalogProducts.length,
  imageCount:
    extravertLdspImport.products.reduce(
      (total, product) => total + product.images.length,
      0,
    ) +
    swissKronoLdspImport.products.reduce(
      (total, product) =>
        total + product.images.length + (product.previewImageUrl ? 1 : 0),
      0,
    ) +
    agtPanelsImport.products.reduce(
      (total, product) =>
        total + product.images.length + (product.previewImageUrl ? 1 : 0),
      0,
    ) +
    swissKronoLdspImport.surfaceStructures.length,
  brandCount: new Set(catalogProducts.map((product) => product.brand)).size,
  surfaceStructureCount: swissKronoLdspImport.surfaceStructures.length,
  decorGroupCount: swissKronoLdspImport.groupCounts.length,
  agtSubcategoryCount: agtPanelsImport.collections.length,
  furniturePanelCount:
    importedExtravertProducts.length + importedSwissKronoProducts.length,
  mdfPanelCount: importedAgtProducts.length,
};

export const catalogCategories: CatalogCategory[] = [
  {
    slug: "ldsp",
    name: "Мебельные панели",
    summary:
      "В разделе собраны реальные коллекции мебельных панелей EXTRAVERT и SWISS KRONO с рабочим сценарием запроса цены и дальнейшим переходом в сервисные услуги.",
    indicator: `${catalogMetrics.furniturePanelCount} позиций · 2 бренда`,
    scenario: "Запрос цены и подбор декора",
    coverImage: furniturePanelsHeroImage,
    spotlight:
      "ЛДСП-панели для корпусной мебели, кухонь, гардеробных и коммерческих проектов с реальными коллекциями, форматами листа и понятным коммерческим маршрутом.",
  },
  {
    slug: "mdf-panels",
    name: "МДФ панели",
    summary:
      "В разделе опубликованы реальные панели AGT с двумя подкатегориями: Trendy и Supramat. Каталог готов для подбора коллекции, консультации и запроса цены.",
    indicator: `${catalogMetrics.mdfPanelCount} позиций · ${catalogMetrics.agtSubcategoryCount} подкатегории`,
    scenario: "Подбор подкатегории и запрос цены",
    coverImage: mdfPanelsHeroImage,
    spotlight:
      "МДФ-панели AGT с импортированными изображениями, рабочими карточками товаров и раздельной навигацией по подкатегориям Trendy и Supramat.",
  },
];

export const featuredProducts: FeaturedProduct[] = buildFeaturedMix(
  [importedExtravertProducts, importedSwissKronoProducts, importedAgtProducts],
  8,
);

export const brands: Brand[] = [
  {
    slug: "extravert",
    name: "Extravert",
    description:
      "Коллекция мебельных панелей ЛДСП с опубликованными форматами листа, толщинами и проектными изображениями для интерьерных и мебельных задач.",
    country: "Россия",
    productCount: importedExtravertProducts.length,
    highlight:
      "Форматы листа, толщины, эмиссия и реальные изображения декоров.",
    categorySlug: "ldsp",
  },
  {
    slug: "swiss-krono",
    name: "Swiss Krono",
    description:
      "Коллекция мебельных панелей ЛДСП с живыми декорами, группами оформления и импортированными изображениями, полученными напрямую с сайта производителя.",
    country: "Россия",
    productCount: importedSwissKronoProducts.length,
    highlight: `${catalogMetrics.surfaceStructureCount} структур поверхности и ${catalogMetrics.decorGroupCount} группы декоров в опубликованном импорте.`,
    categorySlug: "ldsp",
  },
  {
    slug: "agt",
    name: "AGT",
    description:
      "Коллекция МДФ панелей с реальными изображениями и подкатегориями Trendy и Supramat, подготовленными для подбора, консультации и запроса цены.",
    country: "Турция",
    productCount: importedAgtProducts.length,
    highlight: `${catalogMetrics.agtSubcategoryCount} подкатегории и ${importedAgtProducts.length} опубликованных панелей в рабочем каталоге.`,
    categorySlug: "mdf-panels",
  },
];

export const partnerBrands: PartnerBrand[] = [
  {
    slug: "emmax",
    name: "Emmax",
    label: "Мебельная фурнитура",
    description:
      "Фурнитура и комплектующие для корпусной мебели, кухонь и шкафов.",
    previewLabels: ["Петли", "Опоры", "Комплектующие"],
  },
  {
    slug: "samet",
    name: "Samet",
    label: "Мебельная фурнитура",
    description:
      "Фурнитура для кухонь, шкафов, гардеробных и серийных мебельных проектов.",
    previewLabels: ["Петли", "Ящики", "Подъемники"],
  },
  {
    slug: "slotex",
    name: "Slotex",
    label: "Декоративные поверхности",
    description:
      "Материалы и поверхности для мебельных, интерьерных и коммерческих задач.",
    previewLabels: ["Столешницы", "Панели", "Пластики"],
  },
  {
    slug: "hettich",
    name: "Hettich",
    label: "Мебельная фурнитура",
    description:
      "Петли, направляющие и системы для функциональной корпусной мебели.",
    previewLabels: ["Петли", "Направляющие", "Системы"],
  },
  {
    slug: "nuomi",
    name: "Nuomi",
    label: "Организация пространства",
    description:
      "Системы хранения и организация пространства для кухонь, шкафов и гардеробных.",
    previewLabels: ["Хранение", "Кухня", "Гардероб"],
  },
  {
    slug: "italiana-ferramenta",
    name: "Italiana Ferramenta",
    label: "Мебельная фурнитура",
    description:
      "Итальянская фурнитура и комплектующие для аккуратной сборки мебели.",
    previewLabels: ["Крепеж", "Подвесы", "Системы"],
  },
];

export const brandNames = [...brands, ...partnerBrands]
  .sort(
    (brandA, brandB) =>
      getBrandDisplayIndex(brandA.slug) - getBrandDisplayIndex(brandB.slug),
  )
  .map((brand) => brand.name);

export function getCategoryBySlug(slug: string) {
  return catalogCategories.find((category) => category.slug === slug);
}

export function getProductBySlug(slug: string) {
  return catalogProducts.find((product) => product.slug === slug);
}

export function getCalculatorProductContext(
  slug: string,
): CalculatorProductContext | null {
  const product = getProductBySlug(slug);

  if (!product?.calculatorMaterialId || !product.sheetPresetId) {
    return null;
  }

  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    calculatorMaterialId: product.calculatorMaterialId,
    sheetPresetId: product.sheetPresetId,
  };
}

export function getProductsByCategory(categorySlug: string) {
  return catalogProducts.filter(
    (product) => product.categorySlug === categorySlug,
  );
}
