import {
  brandCatalogAssignments,
  getBrandDisplayIndex,
  partnerBrands,
  type FeaturedProduct,
} from "@/features/catalog/data";
import type { Brand } from "@/features/catalog/types";
import {
  getPublicBrands,
  getPublicProducts,
} from "@/lib/server/catalog-public";

type BrandProfileSeed = {
  headline: string;
  overview: string;
  strengths: string[];
  scenarios: string[];
};

export type BrandProfile = {
  slug: string;
  name: string;
  sectionSlug: string;
  sectionName: string;
  contentStatus: "active" | "planned";
  statusLabel: string;
  description: string;
  headline: string;
  overview: string;
  strengths: string[];
  scenarios: string[];
  subcategories: string[];
  previewLabels: string[];
  products: FeaturedProduct[];
  productCount: number;
  country?: string;
  logoUrl?: string;
  categorySlug?: string;
  catalogHref?: string;
  brandPageHref: string;
};

const statusLabelMap = {
  active: "Уже в каталоге",
  planned: "Наполнение в работе",
} as const;

const brandProfileSeeds: Record<string, BrandProfileSeed> = {
  extravert: {
    headline: "Декоры и форматы для корпусной мебели.",
    overview:
      "Extravert подходит для проектов, где нужен понятный рабочий ассортимент ЛДСП под корпусную мебель, кухни, гардеробные и коммерческие решения.",
    strengths: [
      "Российский ассортимент",
      "ЛДСП для корпуса",
      "Рабочие толщины и форматы",
    ],
    scenarios: [
      "Подбор декора под проект",
      "Запрос партии и наличия",
      "Связка с распилом и кромлением",
    ],
  },
  "swiss-krono": {
    headline: "Декоры с акцентом на структуру и вариативность.",
    overview:
      "Swiss Krono удобно использовать там, где важен выбор между однотонными, древесными и дизайнерскими декорами с понятной логикой подбора.",
    strengths: [
      "Группы декоров",
      "Структуры поверхности",
      "Сценарий запроса цены",
    ],
    scenarios: [
      "Подбор группы декора",
      "Сравнение поверхностей",
      "Запрос цены по проекту",
    ],
  },
  agt: {
    headline: "Фасадные МДФ панели для чистых и выразительных фасадов.",
    overview:
      "AGT в Artisan собран вокруг двух рабочих направлений — Trendy и Supramat, чтобы быстрее выбирать панели для кухни, шкафа и интерьерных акцентов.",
    strengths: ["МДФ панели", "Trendy и Supramat", "Фасадный фокус"],
    scenarios: [
      "Выбор коллекции",
      "Подбор под цвет проекта",
      "Запрос цены и консультация",
    ],
  },
  emmax: {
    headline: "Базовая и серийная фурнитура для комплектации мебели.",
    overview:
      "Бренд Emmax готовим как практичный слой для петель, опор и повседневных комплектующих, которые часто нужны в проектной сборке.",
    strengths: ["Базовая комплектация", "Опоры и петли", "Серийные проекты"],
    scenarios: [
      "Комплектация корпуса",
      "Подбор под бюджет проекта",
      "Консультация по ассортименту",
    ],
  },
  samet: {
    headline: "Фурнитура для плавного открывания и ежедневной эксплуатации.",
    overview:
      "Samet логично развивать в блоке функциональной фурнитуры для кухонь, шкафов и систем хранения, где важны петли, ящики и подъемные механизмы.",
    strengths: ["Петли", "Ящики", "Подъемные механизмы"],
    scenarios: [
      "Комплектация кухни",
      "Системы хранения",
      "Сценарии плавного открывания",
    ],
  },
  slotex: {
    headline: "Поверхности и столешницы для проектной мебели и интерьеров.",
    overview:
      "Slotex держим как акцентный слой на поверхности — для кухонь, рабочих зон и решений с выраженной декоративной функцией.",
    strengths: ["Столешницы", "Поверхности", "Декоративные пластики"],
    scenarios: [
      "Подбор столешницы",
      "Поверхности для проектов",
      "Связка с фасадами",
    ],
  },
  hettich: {
    headline: "Технологичная фурнитура для функциональной мебели.",
    overview:
      "Hettich усиливает блок профессиональной фурнитуры с прицелом на сложные сценарии и долговечную эксплуатацию.",
    strengths: ["Петли с доводчиком", "Направляющие", "Системы трансформации"],
    scenarios: [
      "Сложные шкафы",
      "Кухня и системы хранения",
      "Дизайнерские проекты",
    ],
  },
  nuomi: {
    headline: "Организация пространства, выводящая проекты на новый уровень.",
    overview:
      "Nuomi разовьем в блок наполнения и систем хранения, который дополняет корпусные и фасадные решения.",
    strengths: ["Внутреннее наполнение", "Кухонные акценты", "Гардеробные"],
    scenarios: [
      "Внутреннее устройство шкафов",
      "Зоны хранения",
      "Подбор под проект",
    ],
  },
  "italiana-ferramenta": {
    headline: "Итальянская фурнитура для аккуратных и сложных проектов.",
    overview:
      "Italiana Ferramenta — задел под проектные сценарии, где важны нюанс, материал и подача готовой мебели.",
    strengths: ["Премиальная подача", "Точная сборка", "Дизайнерские решения"],
    scenarios: [
      "Премиальные интерьеры",
      "Комплектация дизайнерской мебели",
      "Согласование с проектной командой",
    ],
  },
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function buildBrandProfilesFrom(
  brands: Brand[],
  products: FeaturedProduct[],
): BrandProfile[] {
  return brandCatalogAssignments
    .reduce<BrandProfile[]>((result, assignment) => {
      const activeBrand = brands.find(
        (brand) => brand.slug === assignment.slug,
      );
      const partnerBrand = partnerBrands.find(
        (brand) => brand.slug === assignment.slug,
      );
      const seed = brandProfileSeeds[assignment.slug];
      const brandProducts = products.filter(
        (product) => product.brandSlug === assignment.slug,
      );

      if (!seed) {
        return result;
      }

      result.push({
        slug: assignment.slug,
        name: assignment.name,
        sectionSlug: assignment.sectionSlug,
        sectionName: assignment.sectionName,
        contentStatus: assignment.contentStatus,
        statusLabel: statusLabelMap[assignment.contentStatus],
        description:
          activeBrand?.description ??
          partnerBrand?.description ??
          seed.overview,
        headline: seed.headline,
        overview: seed.overview,
        strengths: seed.strengths,
        scenarios: seed.scenarios,
        subcategories: assignment.subcategories,
        previewLabels:
          brandProducts.length > 0
            ? uniqueStrings([
                ...assignment.subcategories,
                ...brandProducts.map((product) => product.decorGroup),
              ]).slice(0, 5)
            : (partnerBrand?.previewLabels ?? assignment.subcategories),
        products: brandProducts,
        productCount: brandProducts.length,
        country: activeBrand?.country,
        logoUrl: activeBrand?.logoUrl,
        categorySlug: activeBrand?.categorySlug,
        catalogHref: activeBrand?.categorySlug
          ? `/catalog/${activeBrand.categorySlug}?brand=${activeBrand.slug}`
          : undefined,
        brandPageHref: `/brands/${assignment.slug}`,
      });

      return result;
    }, [])
    .sort(
      (profileA, profileB) =>
        getBrandDisplayIndex(profileA.slug) -
        getBrandDisplayIndex(profileB.slug),
    );
}

export async function getBrandProfiles(): Promise<BrandProfile[]> {
  const [brands, products] = await Promise.all([
    getPublicBrands(),
    getPublicProducts(),
  ]);
  return buildBrandProfilesFrom(brands, products);
}

export async function getBrandProfileBySlug(
  slug: string,
): Promise<BrandProfile | undefined> {
  const profiles = await getBrandProfiles();
  return profiles.find((profile) => profile.slug === slug);
}

export async function getBrandProfilesBySection(
  sectionSlug: string,
): Promise<BrandProfile[]> {
  const profiles = await getBrandProfiles();
  return profiles.filter((profile) => profile.sectionSlug === sectionSlug);
}
