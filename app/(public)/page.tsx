import Image from "next/image";
import Link from "next/link";

import { BrandGallery } from "@/features/brands/brand-gallery";
import { getBrandProfiles } from "@/features/brands/data";
import {
  catalogMetrics,
  importedAgtProducts,
  importedExtravertProducts,
  importedSwissKronoProducts,
  type FeaturedProduct,
} from "@/features/catalog/data";
import {
  HomeHeroCarousel,
  type HomeHeroSlide,
} from "@/features/home/home-hero-carousel";

function productImage(product?: FeaturedProduct) {
  return product?.image || importedExtravertProducts[0]?.image || "";
}

const heroSlides: HomeHeroSlide[] = [
  {
    id: "materials",
    eyebrow: "Материалы",
    title: "Материалы для мебели и интерьера.",
    description: "ЛДСП, МДФ и распил в одной системе.",
    primaryAction: {
      href: "/catalog",
      label: "Открыть каталог",
    },
    secondaryAction: {
      href: "/calculator",
      label: "Рассчитать распил",
    },
    images: [
      {
        src: productImage(importedExtravertProducts[0]),
        alt: "Декор мебельной панели EXTRAVERT",
      },
      {
        src: productImage(importedSwissKronoProducts[0]),
        alt: "Декор мебельной панели SWISS KRONO",
      },
      {
        src: productImage(importedExtravertProducts[1]),
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
        src: productImage(importedAgtProducts[0]),
        alt: "МДФ панель AGT Trendy",
      },
      {
        src: productImage(importedAgtProducts[2]),
        alt: "МДФ панель AGT Supramat",
      },
      {
        src: productImage(importedAgtProducts[3]),
        alt: "МДФ панель AGT",
      },
    ],
  },
  {
    id: "cutting",
    eyebrow: "Распил",
    title: "Распил без лишних шагов.",
    description: "Расчёт, карта и заявка в одном маршруте.",
    primaryAction: {
      href: "/calculator",
      label: "Калькулятор",
    },
    secondaryAction: {
      href: "/services#service-request",
      label: "Оставить заявку",
    },
    images: [
      {
        src: productImage(importedSwissKronoProducts[1]),
        alt: "Материал для распила",
      },
      {
        src: productImage(importedExtravertProducts[3]),
        alt: "Панель для распила",
      },
      {
        src: productImage(importedAgtProducts[1]),
        alt: "МДФ панель для распила",
      },
    ],
  },
];

type CategoryTile = {
  title: string;
  label: string;
  href: string;
  image: string;
};

const categoryTiles: CategoryTile[] = [
  {
    title: "Мебельные панели",
    label: `${catalogMetrics.furniturePanelCount} позиций`,
    href: "/catalog/ldsp",
    image: productImage(importedExtravertProducts[0]),
  },
  {
    title: "МДФ панели",
    label: "AGT Trendy / Supramat",
    href: "/catalog/mdf-panels?brand=agt",
    image: productImage(importedAgtProducts[0]),
  },
  {
    title: "SWISS KRONO",
    label: "Однотонные, дизайн, древесные",
    href: "/catalog?brand=swiss-krono",
    image: productImage(importedSwissKronoProducts[0]),
  },
  {
    title: "Онлайн распил",
    label: "Расчет и заявка",
    href: "/calculator",
    image: productImage(importedSwissKronoProducts[4]),
  },
];

function getBrandGalleryItems() {
  return [...getBrandProfiles()]
    .sort((left, right) => {
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
    }));
}

function BrandStrip() {
  const galleryItems = getBrandGalleryItems();
  const activeItems = galleryItems.filter((item) => item.tone !== "planned");
  const plannedItems = galleryItems.filter((item) => item.tone === "planned");

  return (
    <section className="border-y border-line bg-background px-4 py-8 sm:px-8 lg:px-10 lg:py-14">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 lg:mb-10">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">
              Бренды
            </p>
            <h2 className="mt-2 text-[1.18rem] leading-tight font-semibold tracking-[-0.04em] text-foreground sm:text-[1.6rem] lg:text-[1.85rem]">
              Ключевые бренды.
            </h2>
          </div>
          <Link
            href="/brands"
            className="font-mono text-[11px] tracking-[0.16em] text-foreground/68 uppercase transition hover:text-foreground"
          >
            Все бренды
          </Link>
        </div>
        <BrandGallery items={activeItems} compact />

        {plannedItems.length > 0 ? (
          <div className="mt-9 border-t border-line pt-5 sm:mt-12 sm:pt-7">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
                  Скоро в каталоге
                </p>
                <h3 className="mt-1.5 text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.25rem]">
                  Бренды в наполнении.
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {plannedItems.map((item) => (
                <Link
                  key={item.slug}
                  href={item.href ?? "/brands"}
                  className="group flex min-h-[7rem] flex-col justify-between border border-line bg-white/62 p-3 transition hover:border-foreground hover:bg-white sm:min-h-[8rem] sm:p-4"
                >
                  <p className="font-mono text-[9px] tracking-[0.16em] text-muted uppercase">
                    {item.label}
                  </p>
                  <div>
                    <h4 className="text-[1.05rem] leading-none font-semibold tracking-[-0.04em] text-foreground sm:text-[1.25rem]">
                      {item.name}
                    </h4>
                    <p className="mt-2 text-xs leading-4 text-muted">
                      Направление готовится к публикации.
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CategoryStrip() {
  return (
    <section className="bg-background px-4 py-3.5 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {categoryTiles.map((tile, index) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="view-rise group relative min-h-[10.75rem] overflow-hidden bg-[var(--hero)] text-white sm:min-h-[18rem]"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <Image
              src={tile.image}
              alt={tile.title}
              fill
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
  );
}

export default function HomePage() {
  return (
    <div className="bg-background">
      <HomeHeroCarousel slides={heroSlides} />
      <CategoryStrip />
      <BrandStrip />
    </div>
  );
}
