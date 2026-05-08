export type {
  Brand,
  BrandCatalogAssignment,
  CalculatorMaterialId,
  CalculatorProductContext,
  CalculatorSheetPresetId,
  CatalogCategory,
  CatalogSection,
  FeaturedProduct,
  PartnerBrand,
  ProductSpecification,
} from "@/features/catalog/types";

import type {
  BrandCatalogAssignment,
  CatalogSection,
  PartnerBrand,
} from "@/features/catalog/types";

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
    name: "Emaks",
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

export const partnerBrands: PartnerBrand[] = [
  {
    slug: "emmax",
    name: "Emaks",
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

export const brandNames = [...brandCatalogAssignments]
  .sort(
    (a, b) => getBrandDisplayIndex(a.slug) - getBrandDisplayIndex(b.slug),
  )
  .map((brand) => brand.name);

export function getBrandDisplayIndex(slug: string) {
  const index = brandDisplayOrder.indexOf(slug);
  return index === -1 ? brandDisplayOrder.length : index;
}

export function getBrandCatalogAssignment(slug: string) {
  return brandCatalogAssignments.find((brand) => brand.slug === slug);
}
