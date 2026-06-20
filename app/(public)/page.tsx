import type { Metadata } from "next";
import Link from "next/link";

import { ProductImage } from "@/components/catalog/product-image";
import { BrandGallery } from "@/features/brands/brand-gallery";
import { getBrandProfiles } from "@/features/brands/data";
import {
  HomeHeroCarousel,
  type HomeHeroSlide,
} from "@/features/home/home-hero-carousel";
import { HomeCatalogSearch } from "@/features/home/home-catalog-search";
import {
  getCatalogMetrics,
  getPublicProducts,
  getPublicProductsByBrand,
  getPublicProductsByCategory,
} from "@/lib/server/catalog-public";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "ЛДСП, МДФ, распил и мебельная фурнитура в Бишкеке",
  description:
    "Artisan — купить ЛДСП, МДФ панели, кромку и мебельную фурнитуру в Бишкеке. Распил, кромление, онлайн-заявки и подбор материалов.",
  path: "/",
});

type CategoryTile = {
  title: string;
  label: string;
  href: string;
  image: string;
};

const fallbackVisuals = {
  extravert:
    "https://extravert.ru/wp-content/uploads/2023/11/kromka_D.301.W04.jpg",
  swissKrono: "https://swisskrono.ru/ldsp_files/2077_331554_82c7bd10.jpg",
  agt: "https://www.agtwood.com/medium/Product/Image/daf29e0f-9b7b-46e4-babd-eadb915deb80",
  cutting: "https://swisskrono.ru/ldsp_files/4080_347346_82c7bd10.jpg",
  fittings: "https://cheapollo.ru/statics/product/56567/6790b706620a4.jpg",
  nuomi:
    "https://nuomihome.com/wp-content/uploads/2023/06/Champagne-Rose-Series-Double-Layer-Lifting-Unit-2.jpg",
  italiana:
    "https://img.edilportale.com/product-thumbs/b_elefant-italiana-ferramenta-561898-rel93c39c1b.jpg",
  hettich:
    "https://images.unsplash.com/photo-1582582429416-47f57f66a8cf?auto=format&fit=crop&w=1200&q=80",
};

const homeBrandPriority = new Map([
  ["italiana-ferramenta", 0],
  ["nuomi", 1],
  ["hettich", 2],
]);

function pickImage(images: Array<string | undefined>, fallback: string) {
  return images.find((image) => image && image.length > 0) ?? fallback;
}

export default async function HomePage() {
  const [
    catalogMetrics,
    extravertProducts,
    swissKronoProducts,
    agtProducts,
    hettichProducts,
    ldspProducts,
    mdfProducts,
    allProducts,
    profiles,
  ] = await Promise.all([
    getCatalogMetrics(),
    getPublicProductsByBrand("extravert"),
    getPublicProductsByBrand("swiss-krono"),
    getPublicProductsByBrand("agt"),
    getPublicProductsByBrand("hettich"),
    getPublicProductsByCategory("ldsp"),
    getPublicProductsByCategory("mdf-panels"),
    getPublicProducts(),
    getBrandProfiles(),
  ]);

  const fallbackImage = allProducts[0]?.image ?? fallbackVisuals.extravert;
  const searchProducts = allProducts.map((product) => ({
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    brand: product.brand,
    categoryName: product.categoryName,
    searchText: product.searchText,
  }));

  const heroSlides: HomeHeroSlide[] = [
    {
      id: "materials",
      eyebrow: "Материалы",
      title: "Материалы для мебели и интерьера.",
      description: "ЛДСП, МДФ и распил в одной системе.",
      primaryAction: { href: "/catalog", label: "Открыть каталог" },
      secondaryAction: { href: "/calculator", label: "Рассчитать распил" },
      images: [
        {
          src: pickImage([extravertProducts[0]?.image], fallbackImage),
          alt: "Декор мебельной панели EXTRAVERT",
        },
        {
          src: pickImage([swissKronoProducts[0]?.image], fallbackImage),
          alt: "Декор мебельной панели SWISS KRONO",
        },
        {
          src: pickImage([extravertProducts[1]?.image], fallbackImage),
          alt: "Декор мебельной панели Artisan",
        },
      ],
    },
    {
      id: "agt",
      eyebrow: "AGT / МДФ",
      title: "AGT Trendy и Supramat.",
      description: "Фасадные панели для кухни, шкафов и интерьера.",
      primaryAction: {
        href: "/catalog/mdf-panels?brand=agt",
        label: "Смотреть AGT",
      },
      secondaryAction: {
        href: "/catalog/mdf-panels?brand=agt&group=supramat",
        label: "Supramat",
      },
      images: [
        {
          src: pickImage([agtProducts[0]?.image], fallbackVisuals.agt),
          alt: "МДФ панель AGT Trendy",
        },
        {
          src: pickImage([agtProducts[2]?.image], fallbackVisuals.agt),
          alt: "МДФ панель AGT Supramat",
        },
        {
          src: pickImage([agtProducts[3]?.image], fallbackVisuals.agt),
          alt: "МДФ панель AGT",
        },
      ],
    },
    {
      id: "cutting",
      eyebrow: "Распил",
      title: "Распил без лишних шагов.",
      description: "Расчёт, карта и заявка в одном маршруте.",
      primaryAction: { href: "/calculator", label: "Калькулятор" },
      secondaryAction: {
        href: "/services#service-request",
        label: "Оставить заявку",
      },
      images: [
        {
          src: pickImage(
            [swissKronoProducts[1]?.image],
            fallbackVisuals.cutting,
          ),
          alt: "Материал для распила",
        },
        {
          src: pickImage(
            [extravertProducts[3]?.image],
            fallbackVisuals.extravert,
          ),
          alt: "Панель для распила",
        },
        {
          src: pickImage([agtProducts[1]?.image], fallbackVisuals.agt),
          alt: "МДФ панель для распила",
        },
      ],
    },
  ];

  const italianaProfile = profiles.find(
    (profile) => profile.slug === "italiana-ferramenta",
  );
  const nuomiProfile = profiles.find((profile) => profile.slug === "nuomi");
  const hettichProfile = profiles.find((profile) => profile.slug === "hettich");

  const categoryTiles: CategoryTile[] = [
    {
      title: "Мебельные панели",
      label: `${catalogMetrics.furniturePanelCount} позиций`,
      href: "/catalog/ldsp",
      image: pickImage([ldspProducts[0]?.image], fallbackVisuals.extravert),
    },
    {
      title: "МДФ панели",
      label: "AGT Trendy / Supramat",
      href: "/catalog/mdf-panels?brand=agt",
      image: pickImage([mdfProducts[0]?.image], fallbackVisuals.agt),
    },
    {
      title: "SWISS KRONO",
      label: "Однотонные, дизайн, древесные",
      href: "/catalog?brand=swiss-krono",
      image: pickImage(
        [swissKronoProducts[0]?.image],
        fallbackVisuals.swissKrono,
      ),
    },
    {
      title: "Hettich",
      label: "Петли и направляющие",
      href: "/brands/hettich",
      image: pickImage(
        [
          hettichProfile?.homeBannerImages?.[0],
          hettichProducts[0]?.image,
          hettichProfile?.logoUrl,
        ],
        fallbackVisuals.hettich,
      ),
    },
    {
      title: "Онлайн распил",
      label: "Расчет и заявка",
      href: "/calculator",
      image: pickImage([swissKronoProducts[4]?.image], fallbackVisuals.cutting),
    },
    {
      title: "Nuomi",
      label: "Системы хранения",
      href: "/brands/nuomi",
      image: pickImage(
        [
          nuomiProfile?.homeBannerImages?.[0],
          nuomiProfile?.products[0]?.image,
          nuomiProfile?.logoUrl,
        ],
        fallbackVisuals.nuomi,
      ),
    },
    {
      title: "Italiana Ferramenta",
      label: "Итальянская фурнитура",
      href: "/brands/italiana-ferramenta",
      image: pickImage(
        [italianaProfile?.homeBannerImages?.[0], italianaProfile?.logoUrl],
        fallbackVisuals.italiana,
      ),
    },
  ];

  const galleryItems = [...profiles]
    .sort((left, right) => {
      const leftPriority =
        homeBrandPriority.get(left.slug) ?? Number.POSITIVE_INFINITY;
      const rightPriority =
        homeBrandPriority.get(right.slug) ?? Number.POSITIVE_INFINITY;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      if (left.contentStatus === right.contentStatus) {
        return 0;
      }
      return left.contentStatus === "active" ? -1 : 1;
    })
    .map((profile) => ({
      slug: profile.slug,
      name: profile.name,
      label: profile.sectionName,
      description: profile.description,
      tone: profile.contentStatus,
      href: profile.brandPageHref,
      products: profile.products.slice(0, 5),
      previewLabels: profile.previewLabels,
      statusLabel: profile.statusLabel,
      tags: profile.subcategories,
      logoUrl: profile.logoUrl,
      bannerImages: profile.homeBannerImages,
      promotedProductSlugs: profile.promotedProductSlugs,
    }));

  return (
    <div className="bg-background">
      <HomeHeroCarousel slides={heroSlides} />
      <HomeCatalogSearch products={searchProducts} />

      <section className="bg-background px-4 py-3.5 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-7">
          {categoryTiles.map((tile, index) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="view-rise group relative min-h-[10.75rem] overflow-hidden bg-[var(--hero)] text-white sm:min-h-[18rem]"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <ProductImage
                src={tile.image}
                alt={tile.title}
                fill
                fallbackLabel={tile.title}
                className="object-cover opacity-78 transition duration-700 group-hover:scale-[1.045] group-hover:opacity-92"
                sizes="(max-width: 1024px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.2)_45%,rgba(0,0,0,0.72)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <p className="font-mono text-[10px] tracking-[0.18em] text-white/58 uppercase">
                  {tile.label}
                </p>
                <h3 className="mt-1.5 text-[1.02rem] leading-tight font-semibold tracking-[-0.035em] sm:mt-2 sm:text-[1.35rem]">
                  {tile.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-line bg-background border-y px-4 py-8 sm:px-8 lg:px-10 lg:py-14">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 lg:mb-10">
            <div>
              <p className="text-accent font-mono text-[10px] tracking-[0.22em] uppercase">
                Бренды
              </p>
              <h2 className="text-foreground mt-2 text-[1.18rem] leading-tight font-semibold tracking-[-0.04em] sm:text-[1.6rem] lg:text-[1.85rem]">
                Все бренды Artisan.
              </h2>
            </div>
            <Link
              href="/brands"
              className="text-foreground/68 hover:text-foreground font-mono text-[11px] tracking-[0.16em] uppercase transition"
            >
              Каталог брендов
            </Link>
          </div>
          <BrandGallery items={galleryItems} compact />
        </div>
      </section>
    </div>
  );
}
