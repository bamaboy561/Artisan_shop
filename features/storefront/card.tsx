import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProductImage } from "@/components/catalog/product-image";
import { FavoriteToggle } from "@/components/catalog/favorite-toggle";
import { QuickAdd } from "./quick-add";
import type { FeaturedProduct } from "@/features/catalog/types";
import { formatPrice } from "@/lib/commerce";
import s from "./storefront.module.css";

export function StorefrontCard({
  product,
  isFavorite = false,
  next = "/catalog",
}: {
  product: FeaturedProduct;
  isFavorite?: boolean;
  next?: string;
}) {
  return (
    <article className={s.productCard} data-product={product.slug}>
      <div className={s.productVisual}>
        <Link href={`/product/${product.slug}`} aria-label={product.name}>
          <ProductImage
            src={product.image}
            alt={product.name}
            fallbackLabel={product.name}
            fill
            sizes="(max-width: 600px) 50vw, (max-width: 1150px) 40vw, 28vw"
            className={s.contain}
          />
        </Link>
        <FavoriteToggle
          productSlug={product.slug}
          isFavorite={isFavorite}
          next={next}
          className={s.liveFavorite}
        />
        {product.isPromotional && <span className={s.formatTag}>Акция</span>}
      </div>
      <div className={s.productInfo}>
        <div className={s.productBrand}>
          {product.brand}
          <span>{product.categoryName}</span>
        </div>
        <h3>
          <Link href={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        <p className={s.productFormat}>
          {product.format}
          <br />
          Артикул: {product.sku}
        </p>
        <div className={s.productBottom}>
          <div>
            <strong>
              {typeof product.price === "number"
                ? formatPrice(product.price)
                : "По запросу"}
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
            <QuickAdd
              product={{
                slug: product.slug,
                name: product.name,
                sku: product.sku,
                image: product.image,
                price: product.price,
                oldPrice: product.oldPrice,
                stockQuantity: product.stockQuantity,
                inStock: product.inStock,
              }}
            />
          ) : (
            <Link
              className={s.addIcon}
              href={`/product/${product.slug}`}
              aria-label={`Подробнее: ${product.name}`}
              title="Подробнее"
            >
              <ArrowUpRight size={20} />
            </Link>
          )}
        </div>
        <span
          className={`${s.availability} ${product.inStock ? "" : s.unavailable}`}
        >
          <span />
          {product.inStock ? "В наличии" : "По запросу"}
        </span>
      </div>
    </article>
  );
}
