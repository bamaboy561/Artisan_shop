import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Drill, Ruler, Scissors } from "lucide-react";
import { ProductImage } from "@/components/catalog/product-image";
import { getBrandProfiles } from "@/features/brands/data";
import {
  getPublicCategories,
  getFeaturedProducts,
  getPromotionalProducts,
} from "@/lib/server/catalog-public";
import { getCurrentFavoriteProductSlugs } from "@/lib/server/favorites";
import { getPublicHighlightedPromotions } from "@/lib/server/promotions-public";
import { companyContacts } from "@/lib/site-config";
import { StorefrontBento } from "./bento";
import { StorefrontCard } from "./card";
import s from "./storefront.module.css";

export async function StorefrontHome() {
  const [categories, featured, promotional, brands, favorites, promotions] =
    await Promise.all([
      getPublicCategories(),
      getFeaturedProducts(4),
      getPromotionalProducts(4),
      getBrandProfiles(),
      getCurrentFavoriteProductSlugs(),
      getPublicHighlightedPromotions(),
    ]);
  const products = featured.length
    ? featured
    : brands.flatMap((brand) => brand.products.slice(0, 1)).slice(0, 4);
  return (
    <>
      <StorefrontBento promotion={promotions[0]} />
      {promotional.length > 0 && (
        <section className={`${s.section} ${s.container} ${s.reveal}`}>
          <div className={s.sectionHeading}>
            <div>
              <h2>Акции</h2>
            </div>
          </div>
          <div className={s.homeProducts}>
            {promotional.map((product, index) => (
              <StorefrontCard
                key={product.slug}
                product={product}
                eager={index < 2}
                isFavorite={favorites.has(product.slug)}
                next="/"
              />
            ))}
          </div>
        </section>
      )}
      <section className={`${s.section} ${s.container} ${s.reveal}`}>
        <div className={s.sectionHeading}>
          <div>
            <h2>Разделы каталога</h2>
          </div>
          <Link href="/catalog" className={s.textLink}>
            Весь каталог <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className={s.categoryGrid}>
          {categories.map((category, index) => (
            <Link
              key={category.slug}
              href={`/catalog/${category.slug}`}
              className={s.categoryTile}
            >
              <div>
                <ProductImage
                  src={category.coverImage}
                  alt={category.name}
                  fallbackLabel={category.name}
                  fill
                  sizes="(max-width: 600px) 50vw, 25vw"
                  loading={index < 4 ? "eager" : undefined}
                  className={s.cover}
                />
              </div>
              <h3>{category.name}</h3>
              <p>{category.summary}</p>
            </Link>
          ))}
        </div>
      </section>
      {products.length > 0 && (
        <section className={`${s.collectionBand} ${s.reveal}`}>
          <div className={`${s.container} ${s.section}`}>
            <div className={s.sectionHeading}>
              <div>
                <h2>Популярные материалы</h2>
              </div>
              <Link href="/catalog" className={s.textLink}>
                Смотреть всё <ArrowUpRight size={19} />
              </Link>
            </div>
            <div className={s.homeProducts}>
              {products.map((product) => (
                <StorefrontCard
                  key={product.slug}
                  product={product}
                  isFavorite={favorites.has(product.slug)}
                  next="/"
                />
              ))}
            </div>
          </div>
        </section>
      )}
      <section
        id="brands"
        className={`${s.container} ${s.section} ${s.reveal}`}
      >
        <div className={s.sectionHeading}>
          <div>
            <h2>Бренды на складе</h2>
          </div>
          <Link href="/brands" className={s.textLink}>
            Все бренды <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className={s.brandRow}>
          {brands.map((brand) => (
            <Link
              key={brand.slug}
              href={brand.brandPageHref}
              title={`Товары ${brand.name}`}
            >
              <span>{brand.name}</span>
            </Link>
          ))}
        </div>
      </section>
      <section id="services" className={`${s.serviceBand} ${s.reveal}`}>
        <div className={`${s.container} ${s.serviceGrid}`}>
          <div className={s.serviceVisual}>
            <Image
              src="/storefront/interior-2.webp"
              alt="Мебель из декоров Extravert"
              fill
              unoptimized
              sizes="(max-width: 700px) 100vw, 50vw"
              className={s.cover}
            />
          </div>
          <div className={s.serviceText}>
            <h2>Распил, кромление и присадка в своём цехе</h2>
            <p>
              Пилим на немецких HOMAG и ALTENDORF, кромку клеим на PUR-клей.
              Пришлите размеры деталей или файл из Базиса, остальное сделаем мы.
            </p>
            <div className={s.serviceSteps}>
              <span>
                <Scissors size={22} />
                Распил
              </span>
              <span>
                <Ruler size={22} />
                Кромление
              </span>
              <span>
                <Drill size={22} />
                Присадка
              </span>
            </div>
            <Link href="/calculator" className={s.lightButton}>
              Рассчитать распил <ArrowUpRight size={21} />
            </Link>
          </div>
        </div>
      </section>
      <section className={`${s.container} ${s.contactBand} ${s.reveal}`}>
        <div>
          <h2>Не нашли нужный декор?</h2>
          <p>Напишите в WhatsApp, подскажем по наличию и срокам.</p>
        </div>
        <a
          href={companyContacts.whatsapp}
          target="_blank"
          rel="noreferrer"
          className={s.primaryButton}
        >
          Написать в WhatsApp <ArrowRight size={21} />
        </a>
      </section>
    </>
  );
}
