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
      {promotional.length > 0 && (
        <section className={`${s.section} ${s.container}`}>
          <div className={s.sectionHeading}>
            <h2>Акции</h2>
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
      <section className={`${s.section} ${s.container}`}>
        <div className={s.sectionHeading}>
          <h2>Разделы</h2>
          <Link href="/catalog" className={s.textLink}>
            Весь каталог <ArrowUpRight size={19} />
          </Link>
        </div>
        <ol className={s.indexList}>
          {categories.map((category) => (
            <li key={category.slug}>
              <Link href={`/catalog/${category.slug}`}>
                <strong>{category.name}</strong>
                <span className={s.indexSummary}>{category.summary}</span>
                <span className={s.indexThumb}>
                  <ProductImage
                    src={category.coverImage}
                    alt=""
                    fallbackLabel={category.name}
                    fill
                    sizes="240px"
                    className={s.cover}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      {products.length > 0 && (
        <section className={s.collectionBand}>
          <div className={`${s.container} ${s.section}`}>
            <div className={s.sectionHeading}>
              <h2>Часто берут</h2>
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
      <section id="services" className={`${s.container} ${s.workshop}`}>
        <div>
          <h2>Свой цех на Кулатова</h2>
          <p>
            Распил, кромка и присадка в одном месте. Пришлите размеры деталей
            или файл из Базиса.
          </p>
          <Link href="/calculator" className={s.primaryButton}>
            Рассчитать распил <ArrowRight size={19} />
          </Link>
        </div>
        <table className={s.machineTable}>
          <tbody>
            <tr>
              <th>Распил</th>
              <td>HOMAG S-100, ALTENDORF F45</td>
            </tr>
            <tr>
              <th>Кромка</th>
              <td>HOMAG S-240, клей PUR</td>
            </tr>
            <tr>
              <th>Присадка</th>
              <td>EXCITECH EHSW1228 с ЧПУ</td>
            </tr>
            <tr>
              <th>Фрезеровка</th>
              <td>Нестинг-центр EK-2128</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section id="brands" className={`${s.container} ${s.brandLine}`}>
        <h2>Бренды</h2>
        <p>
          {brands.map((brand, index) => (
            <span key={brand.slug}>
              <Link href={brand.brandPageHref}>{brand.name}</Link>
              {index < brands.length - 1 && " / "}
            </span>
          ))}
        </p>
      </section>
      <section className={`${s.container} ${s.contactBand}`}>
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
