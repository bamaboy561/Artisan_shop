import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { FavoriteToggle } from "@/components/catalog/favorite-toggle";
import { ProductImage } from "@/components/catalog/product-image";
import { AddBundleItemButton } from "@/components/ecommerce/add-bundle-item-button";
import { PurchaseInfo } from "@/components/ecommerce/purchase-info";
import { StructuredData } from "@/components/seo/structured-data";
import type { FeaturedProduct } from "@/features/catalog/types";
import { formatPrice } from "@/lib/commerce";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
import { companyContacts } from "@/lib/site-config";
import { StorefrontCard } from "./card";
import {
  ProductPurchase,
  ProductSections,
  StorefrontGallery,
} from "./product-controls";
import s from "./storefront.module.css";

export function StorefrontProduct({
  product,
  related,
  favorites,
  categoryHref,
  specifications,
}: {
  product: FeaturedProduct;
  related: FeaturedProduct[];
  favorites: Set<string>;
  categoryHref: string;
  specifications: { key: string; value: string }[];
}) {
  const href = `/product/${product.slug}`;
  const gallery = product.gallery.length ? product.gallery : [product.image];
  return (
    <div className={`${s.container} ${s.productPage}`}>
      <StructuredData
        data={[
          productJsonLd(product),
          breadcrumbJsonLd([
            { name: "Главная", href: "/" },
            { name: "Каталог", href: "/catalog" },
            { name: product.categoryName, href: categoryHref },
            { name: product.name, href },
          ]),
        ]}
      />
      <nav className={s.breadcrumbs} aria-label="Хлебные крошки">
        <Link href="/">Главная</Link>
        <span>/</span>
        <Link href="/catalog">Каталог</Link>
        <span>/</span>
        <Link href={categoryHref}>{product.categoryName}</Link>
      </nav>
      <section className={s.productDetail}>
        <StorefrontGallery images={gallery} name={product.name} />
        <div className={s.detailInfo}>
          <div className={s.detailTop}>
            <Link
              href={`/catalog?brand=${encodeURIComponent(product.brandSlug)}`}
              className={s.detailBrand}
            >
              {product.brand}
              <ArrowUpRight size={17} />
            </Link>
            <FavoriteToggle
              productSlug={product.slug}
              isFavorite={favorites.has(product.slug)}
              next={href}
              variant="inline"
            />
          </div>
          <h1>{product.name}</h1>
          <p className={s.sku}>Артикул: {product.sku}</p>
          <span
            className={`${s.availability} ${product.inStock ? "" : s.unavailable}`}
          >
            <span />
            {product.inStock ? "В наличии" : "По запросу"}
          </span>
          {product.format && (
            <div className={s.formatDetail}>
              <span>Формат и толщина</span>
              <strong>{product.format}</strong>
            </div>
          )}
          <div className={s.detailPrice}>
            <strong>
              {typeof product.price === "number"
                ? formatPrice(product.price)
                : "Цена по запросу"}
            </strong>
            {typeof product.oldPrice === "number" &&
              product.oldPrice > (product.price ?? product.oldPrice) && (
                <del className={s.oldPrice}>
                  {formatPrice(product.oldPrice)}
                </del>
              )}
          </div>
          {product.purchaseMode === "cart" &&
          typeof product.price === "number" ? (
            <ProductPurchase
              key={product.slug}
              slug={product.slug}
              stock={product.stockQuantity}
              inStock={product.inStock}
            />
          ) : (
            <div className={s.buyRow}>
              <Link href="/contacts" className={s.primaryButton}>
                Запросить цену <ArrowUpRight size={18} />
              </Link>
            </div>
          )}
          <Link
            href={`/calculator?product=${encodeURIComponent(product.slug)}`}
            className={s.textLink}
          >
            Рассчитать распил <ArrowUpRight size={17} />
          </Link>
          <Link href="/contacts" className={s.fulfillment}>
            <MapPin size={23} />
            <div>
              <strong>Самовывоз и консультация</strong>
              <p>{companyContacts.address}</p>
            </div>
            <ArrowUpRight size={19} />
          </Link>
          <PurchaseInfo className="mt-5" />
        </div>
      </section>
      {product.bundleItems.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionHeading}>
            <div>
              <p className={s.eyebrow}>Комплектация</p>
              <h2>Рекомендации к комплекту</h2>
            </div>
          </div>
          <div className={s.bundleRows}>
            {product.bundleItems.map((item, index) => (
              <div key={`${item.productSlug}-${index}`}>
                {item.image && (
                  <ProductImage
                    src={item.image}
                    alt={item.label}
                    width={64}
                    height={64}
                    className={s.contain}
                  />
                )}
                <div>
                  {item.productSlug ? (
                    <Link href={`/product/${item.productSlug}`}>
                      {item.label}
                    </Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                  {item.productSku && (
                    <p className={s.sku}>Артикул: {item.productSku}</p>
                  )}
                  {item.quantity && (
                    <p className={s.muted}>Количество: {item.quantity}</p>
                  )}
                </div>
                <AddBundleItemButton
                  productSlug={item.productSlug}
                  quantity={item.quantity}
                  className={s.liveAdd}
                />
              </div>
            ))}
          </div>
        </section>
      )}
      <ProductSections
        specifications={
          <dl className={s.specifications}>
            {specifications
              .filter((row) => row.value)
              .map((row, index) => (
                <div key={`${row.key}-${index}`}>
                  <dt>{row.key}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
          </dl>
        }
        description={
          <div className={s.deliveryText}>
            <p className={s.description}>
              {product.description || product.summary}
            </p>
            <Link href="/contacts" className={s.textLink}>
              Задать вопрос о товаре <ArrowUpRight size={17} />
            </Link>
          </div>
        }
      />
      {related.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionHeading}>
            <h2>Вам также подойдёт</h2>
            <Link href={categoryHref} className={s.textLink}>
              Весь раздел <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className={s.homeProducts}>
            {related.map((item) => (
              <StorefrontCard
                key={item.slug}
                product={item}
                isFavorite={favorites.has(item.slug)}
                next={href}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
