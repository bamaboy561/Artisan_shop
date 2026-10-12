import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Drill, Ruler, Scissors } from "lucide-react";
import { ProductImage } from "@/components/catalog/product-image";
import { getBrandProfiles } from "@/features/brands/data";
import {
  getPublicCategories,
  getFeaturedProducts,
} from "@/lib/server/catalog-public";
import { getCurrentFavoriteProductSlugs } from "@/lib/server/favorites";
import { companyContacts } from "@/lib/site-config";
import { StorefrontHero } from "./hero";
import { StorefrontCard } from "./card";
import s from "./storefront.module.css";

export async function StorefrontHome() {
  const [categories, featured, brands, favorites] = await Promise.all([
    getPublicCategories(),
    getFeaturedProducts(4),
    getBrandProfiles(),
    getCurrentFavoriteProductSlugs(),
  ]);
  const products = featured.length
    ? featured
    : brands.flatMap((brand) => brand.products.slice(0, 1)).slice(0, 4);
  return (
    <>
      <StorefrontHero />
      <section className={`${s.section} ${s.container}`}>
        <div className={s.sectionHeading}>
          <div>
            <p className={s.eyebrow}>Всё начинается с материала</p>
            <h2>Основа красивой мебели</h2>
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
                  className={s.cover}
                />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3>
                {category.name}
                <ArrowUpRight size={20} />
              </h3>
              <p>{category.summary}</p>
            </Link>
          ))}
        </div>
      </section>
      {products.length > 0 && (
        <section className={s.collectionBand}>
          <div className={`${s.container} ${s.section}`}>
            <div className={s.sectionHeading}>
              <div>
                <p className={s.eyebrow}>Для вашего проекта</p>
                <h2>Материалы и детали</h2>
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
      <section id="brands" className={`${s.container} ${s.section}`}>
        <div className={s.sectionHeading}>
          <div>
            <p className={s.eyebrow}>Партнёры Artisan</p>
            <h2>Имена, за которыми качество</h2>
          </div>
          <Link href="/brands" className={s.textLink}>
            Все бренды <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className={s.brandGrid}>
          {brands.map((brand) => (
            <Link
              key={brand.slug}
              href={brand.brandPageHref}
              title={`Товары ${brand.name}`}
            >
              {brand.logoUrl ? (
                <ProductImage
                  src={
                    brand.slug === "albero" &&
                    brand.logoUrl === "/brands/albero-logo.png"
                      ? "/storefront/albero.webp"
                      : brand.logoUrl
                  }
                  alt={brand.name}
                  fallbackLabel={brand.name}
                  width={180}
                  height={45}
                />
              ) : (
                <span>{brand.name}</span>
              )}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      </section>
      <section id="services" className={s.serviceBand}>
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
            <p className={s.eyebrow}>От замысла к готовой детали</p>
            <h2>
              Ваш материал.
              <br />
              Наша точность.
            </h2>
            <p>Распил, кромление и присадка для вашего проекта.</p>
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
      <section className={`${s.container} ${s.contactBand}`}>
        <div>
          <p className={s.eyebrow}>Вместе найдём нужное</p>
          <h2>Обсудим ваш проект?</h2>
        </div>
        <a
          href={companyContacts.whatsapp}
          target="_blank"
          rel="noreferrer"
          className={s.primaryButton}
        >
          Связаться с нами <ArrowRight size={21} />
        </a>
      </section>
    </>
  );
}
