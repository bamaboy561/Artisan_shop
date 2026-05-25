import {
  brandCatalogAssignments,
  getBrandAliasSlugs,
  getBrandDisplayIndex,
  normalizeBrandSlug,
  partnerBrands,
  type FeaturedProduct,
} from "@/features/catalog/data";
import type { Brand } from "@/features/catalog/types";
import { PromotionStatus, PromotionTargetType } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";
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
  homeBannerImages?: string[];
  promotedProductSlugs: string[];
  categorySlug?: string;
  catalogHref?: string;
  brandPageHref: string;
  updatedAt?: Date;
};

type PromotionLookup = {
  productSlugs: Set<string>;
  categorySlugs: Set<string>;
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
  emaks: {
    headline: "Базовая и серийная фурнитура для комплектации мебели.",
    overview:
      "Бренд Emaks готовим как практичный слой для петель, опор и повседневных комплектующих, которые часто нужны в проектной сборке.",
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

const emptyPromotionLookup: PromotionLookup = {
  productSlugs: new Set<string>(),
  categorySlugs: new Set<string>(),
};

async function getActivePromotionLookup(): Promise<PromotionLookup> {
  if (!hasDatabaseUrl()) {
    return emptyPromotionLookup;
  }

  const now = new Date();

  try {
    const promotions = await getDb().promotion.findMany({
      where: {
        status: PromotionStatus.ACTIVE,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      select: {
        targetType: true,
        products: {
          select: {
            product: { select: { slug: true } },
          },
        },
        categories: {
          select: {
            category: { select: { slug: true } },
          },
        },
      },
    });

    return promotions.reduce<PromotionLookup>(
      (lookup, promotion) => {
        if (promotion.targetType === PromotionTargetType.PRODUCT) {
          promotion.products.forEach((item) => {
            lookup.productSlugs.add(item.product.slug);
          });
        }

        if (promotion.targetType === PromotionTargetType.CATEGORY) {
          promotion.categories.forEach((item) => {
            lookup.categorySlugs.add(item.category.slug);
          });
        }

        return lookup;
      },
      {
        productSlugs: new Set<string>(),
        categorySlugs: new Set<string>(),
      },
    );
  } catch (error) {
    console.warn("Brand promotion lookup failed", error);
    return emptyPromotionLookup;
  }
}

function isPromotionalProduct(
  product: FeaturedProduct,
  promotionLookup: PromotionLookup,
) {
  return (
    promotionLookup.productSlugs.has(product.slug) ||
    promotionLookup.categorySlugs.has(product.categorySlug)
  );
}

function prioritizePromotionalProducts(
  products: FeaturedProduct[],
  promotionLookup: PromotionLookup,
) {
  return [...products].sort((left, right) => {
    const leftPromotional = isPromotionalProduct(left, promotionLookup);
    const rightPromotional = isPromotionalProduct(right, promotionLookup);

    if (leftPromotional === rightPromotional) {
      return 0;
    }

    return leftPromotional ? -1 : 1;
  });
}

function getPromotedProductSlugs(
  products: FeaturedProduct[],
  promotionLookup: PromotionLookup,
) {
  return products
    .filter((product) => isPromotionalProduct(product, promotionLookup))
    .map((product) => product.slug);
}

function buildBrandProfilesFrom(
  brands: Brand[],
  products: FeaturedProduct[],
  promotionLookup: PromotionLookup = emptyPromotionLookup,
): BrandProfile[] {
  const assignedProfiles = brandCatalogAssignments.reduce<BrandProfile[]>(
    (result, assignment) => {
      const aliasSlugs = getBrandAliasSlugs(assignment.slug);
      const activeBrand = brands.find((brand) =>
        aliasSlugs.includes(normalizeBrandSlug(brand.slug)),
      );
      const partnerBrand = partnerBrands.find((brand) =>
        aliasSlugs.includes(normalizeBrandSlug(brand.slug)),
      );
      const seed = brandProfileSeeds[assignment.slug];
      const rawBrandProducts = products.filter((product) =>
        aliasSlugs.includes(normalizeBrandSlug(product.brandSlug)),
      );
      const brandProducts = prioritizePromotionalProducts(
        rawBrandProducts,
        promotionLookup,
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
        homeBannerImages: activeBrand?.homeBannerImages,
        promotedProductSlugs: getPromotedProductSlugs(
          rawBrandProducts,
          promotionLookup,
        ),
        categorySlug: activeBrand?.categorySlug,
        catalogHref: activeBrand?.categorySlug
          ? `/catalog/${activeBrand.categorySlug}?brand=${activeBrand.slug}`
          : undefined,
        brandPageHref: `/brands/${assignment.slug}`,
        updatedAt: activeBrand?.updatedAt,
      });

      return result;
    },
    [],
  );
  const assignedSlugs = new Set(
    assignedProfiles.flatMap((profile) => getBrandAliasSlugs(profile.slug)),
  );
  const dynamicProfiles = brands
    .filter((brand) => !assignedSlugs.has(normalizeBrandSlug(brand.slug)))
    .map<BrandProfile>((brand) => {
      const canonicalSlug = normalizeBrandSlug(brand.slug);
      const rawBrandProducts = products.filter(
        (product) => normalizeBrandSlug(product.brandSlug) === canonicalSlug,
      );
      const brandProducts = prioritizePromotionalProducts(
        rawBrandProducts,
        promotionLookup,
      );
      const categoryNames = uniqueStrings(
        brandProducts.map((product) => product.categoryName),
      );
      const contentStatus = brandProducts.length > 0 ? "active" : "planned";
      const fallbackSectionName = categoryNames[0] ?? "Бренды";

      return {
        slug: canonicalSlug,
        name: brand.name,
        sectionSlug: brand.categorySlug || "brands",
        sectionName: fallbackSectionName,
        contentStatus,
        statusLabel: statusLabelMap[contentStatus],
        description:
          brand.description ||
          `Бренд ${brand.name} добавлен в каталог Artisan и готовится к наполнению товарами.`,
        headline: `Материалы и товары ${brand.name}.`,
        overview:
          brand.description ||
          `Раздел ${brand.name} появится на сайте по мере наполнения каталога.`,
        strengths: categoryNames.length > 0 ? categoryNames : ["Каталог"],
        scenarios: ["Подбор товара", "Запрос цены", "Консультация менеджера"],
        subcategories: categoryNames.length > 0 ? categoryNames : ["Каталог"],
        previewLabels:
          categoryNames.length > 0
            ? categoryNames.slice(0, 5)
            : ["В подготовке"],
        products: brandProducts,
        productCount: brandProducts.length,
        country: brand.country,
        logoUrl: brand.logoUrl,
        homeBannerImages: brand.homeBannerImages,
        promotedProductSlugs: getPromotedProductSlugs(
          rawBrandProducts,
          promotionLookup,
        ),
        categorySlug: brand.categorySlug,
        catalogHref: brand.categorySlug
          ? `/catalog/${brand.categorySlug}?brand=${brand.slug}`
          : undefined,
        brandPageHref: `/brands/${canonicalSlug}`,
        updatedAt: brand.updatedAt,
      };
    });

  return [...assignedProfiles, ...dynamicProfiles].sort(
    (profileA, profileB) =>
      getBrandDisplayIndex(profileA.slug) - getBrandDisplayIndex(profileB.slug),
  );
}

export async function getBrandProfiles(): Promise<BrandProfile[]> {
  const [brands, products, promotionLookup] = await Promise.all([
    getPublicBrands(),
    getPublicProducts(),
    getActivePromotionLookup(),
  ]);
  return buildBrandProfilesFrom(brands, products, promotionLookup);
}

export async function getBrandProfileBySlug(
  slug: string,
): Promise<BrandProfile | undefined> {
  const profiles = await getBrandProfiles();
  const normalizedSlug = normalizeBrandSlug(slug);

  return profiles.find(
    (profile) => normalizeBrandSlug(profile.slug) === normalizedSlug,
  );
}

export async function getBrandProfilesBySection(
  sectionSlug: string,
): Promise<BrandProfile[]> {
  const profiles = await getBrandProfiles();
  return profiles.filter((profile) => profile.sectionSlug === sectionSlug);
}
