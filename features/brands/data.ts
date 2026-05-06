import {
  brandCatalogAssignments,
  brands,
  catalogProducts,
  getBrandDisplayIndex,
  partnerBrands,
  type FeaturedProduct,
} from "@/features/catalog/data";

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
    strengths: ["Петли и ящики", "Подъемные механизмы", "Кухонные проекты"],
    scenarios: [
      "Подбор механизма открывания",
      "Комплектация кухни",
      "Согласование набора с менеджером",
    ],
  },
  slotex: {
    headline: "Поверхности и столешницы для кухни и общественных зон.",
    overview:
      "Slotex планируем как отдельный слой под столешницы и декоративные поверхности, где важны практичность, визуальный ритм и совместимость с остальными материалами.",
    strengths: [
      "Столешницы",
      "Декоративные поверхности",
      "Кухни и общественные зоны",
    ],
    scenarios: [
      "Подбор поверхности",
      "Связка со стеновыми решениями",
      "Запрос партии под проект",
    ],
  },
  hettich: {
    headline: "Функциональная фурнитура для системного мебельного проекта.",
    overview:
      "Hettich в структуре Artisan займет роль технологичного бренда для направляющих, петель и внутренних систем, когда требуется аккуратная механика и понятная логика комплектации.",
    strengths: ["Направляющие", "Петли", "Системные решения"],
    scenarios: [
      "Подбор механики шкафа",
      "Фурнитура под кухонный проект",
      "Консультация по линейкам",
    ],
  },
  nuomi: {
    headline: "Организация пространства для кухни, шкафа и гардеробной.",
    overview:
      "Nuomi готовим как отдельное направление по внутреннему наполнению: хранение, выдвижные системы и решения, которые повышают удобство готовой мебели.",
    strengths: [
      "Хранение и наполнение",
      "Кухня и гардероб",
      "Функциональные системы",
    ],
    scenarios: [
      "Подбор наполнения",
      "Оснащение кухни",
      "Комплектация гардеробной",
    ],
  },
  "italiana-ferramenta": {
    headline: "Аккуратная фурнитура и скрытые системы для чистой сборки.",
    overview:
      "Italiana Ferramenta логично раскрывать как премиальный блок комплектующих и скрытых систем, где важна точность, аккуратный монтаж и современная подача проекта.",
    strengths: [
      "Скрытые системы",
      "Крепеж и подвесы",
      "Премиальная комплектация",
    ],
    scenarios: [
      "Подбор скрытых решений",
      "Комплектация дизайнерской мебели",
      "Согласование с проектной командой",
    ],
  },
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function buildBrandProfiles() {
  return brandCatalogAssignments
    .reduce<BrandProfile[]>((result, assignment) => {
      const activeBrand = brands.find(
        (brand) => brand.slug === assignment.slug,
      );
      const partnerBrand = partnerBrands.find(
        (brand) => brand.slug === assignment.slug,
      );
      const seed = brandProfileSeeds[assignment.slug];
      const products = catalogProducts.filter(
        (product) => product.brandSlug === assignment.slug,
      );

      if (!seed || (!activeBrand && !partnerBrand)) {
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
          products.length > 0
            ? uniqueStrings([
                ...assignment.subcategories,
                ...products.map((product) => product.decorGroup),
              ]).slice(0, 5)
            : (partnerBrand?.previewLabels ?? assignment.subcategories),
        products,
        productCount: products.length,
        country: activeBrand?.country,
        categorySlug: activeBrand?.categorySlug,
        catalogHref: activeBrand
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

const brandProfiles = buildBrandProfiles();

export function getBrandProfiles() {
  return brandProfiles;
}

export function getBrandProfileBySlug(slug: string) {
  return getBrandProfiles().find((profile) => profile.slug === slug);
}

export function getBrandProfilesBySection(sectionSlug: string) {
  return getBrandProfiles().filter(
    (profile) => profile.sectionSlug === sectionSlug,
  );
}
