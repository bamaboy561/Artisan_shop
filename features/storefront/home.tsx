import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
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
      <section className={s.tsSection} aria-labelledby="offer-title">
        <div className={s.tsWrap}>
          <div className={s.tsHead}>
            <h2 id="offer-title">Что есть на складе</h2>
            <Link href="/catalog" className={s.tsLink}>
              Весь каталог <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className={s.tsCats}>
            {categories.map((category, index) => (
              <Link key={category.slug} href={`/catalog/${category.slug}`}>
                <span className={s.tsPhoto}>
                  <ProductImage
                    src={category.coverImage}
                    alt={category.name}
                    fallbackLabel={category.name}
                    fill
                    sizes="(max-width: 700px) 100vw, 33vw"
                    loading={index < 3 ? "eager" : undefined}
                    className={s.cover}
                  />
                </span>
                <strong>{category.name}</strong>
                <span>{category.summary}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      {(promotional.length > 0 || products.length > 0) && (
        <section className={s.tsSection} aria-labelledby="goods-title">
          <div className={s.tsWrap}>
            <div className={s.tsHead}>
              <h2 id="goods-title">
                {promotional.length > 0 ? "Акции" : "Часто берут"}
              </h2>
              <Link href="/catalog" className={s.tsLink}>
                Смотреть всё <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className={s.homeProducts}>
              {(promotional.length > 0 ? promotional : products).map(
                (product, index) => (
                  <StorefrontCard
                    key={product.slug}
                    product={product}
                    eager={index < 2}
                    isFavorite={favorites.has(product.slug)}
                    next="/"
                  />
                ),
              )}
            </div>
            <p className={s.tsBrands}>
              {brands.map((brand, index) => (
                <span key={brand.slug}>
                  <Link href={brand.brandPageHref}>{brand.name}</Link>
                  {index < brands.length - 1 && ", "}
                </span>
              ))}
            </p>
          </div>
        </section>
      )}
      <section id="services" className={s.tsWorkshop}>
        <div className={s.tsWorkshopPhoto}>
          <Image
            src="/storefront/interior-2.webp"
            alt="Шкаф из ЛДСП с распилом и кромкой Artisan"
            fill
            unoptimized
            sizes="50vw"
            className={s.cover}
          />
        </div>
        <div className={s.tsWorkshopText}>
          <h2>Распил, кромка и присадка в своём цехе</h2>
          <p>
            Пилим на HOMAG и ALTENDORF, кромку клеим на PUR-клей. Пришлите
            размеры деталей или файл из Базиса.
          </p>
          <ul>
            <li>Распил</li>
            <li>Кромление</li>
            <li>Присадка</li>
            <li>Фрезеровка</li>
          </ul>
          <Link href="/calculator" className={s.tsButton}>
            Рассчитать распил <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <section className={s.tsClose}>
        <div className={s.tsWrap}>
          <h2>Не нашли нужный декор? Спросите в WhatsApp</h2>
          <a
            href={companyContacts.whatsapp}
            target="_blank"
            rel="noreferrer"
            className={s.tsButton}
          >
            Написать в WhatsApp <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </>
  );
}
