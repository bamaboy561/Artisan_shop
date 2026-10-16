import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProductImage } from "@/components/catalog/product-image";
import { FavoriteToggle } from "@/components/catalog/favorite-toggle";
import { QuickAdd } from "./quick-add";
import type { FeaturedProduct } from "@/features/catalog/types";
import { formatPrice } from "@/lib/commerce";
import s from "./storefront.module.css";

// «2800 × 2070 мм, 16 мм» → площадь листа в м², чтобы сравнивать форматы.
function sheetArea(format: string) {
  const match = format.match(/(\d{3,4})\s*[×xх*]\s*(\d{3,4})/i);
  if (!match) return null;
  const area = (Number(match[1]) * Number(match[2])) / 1_000_000;
  return area >= 1 ? area : null;
}

function formatChips(format: string) {
  return (
    format
      .split(",")
      .map((part) => part.trim())
      // У размера листа «мм» убираем, у толщины оставляем: «2800 × 2070», «16 мм».
      .map((part) =>
        /\d\s*[×xх*]\s*\d/i.test(part) ? part.replace(/\s*мм$/, "") : part,
      )
      .filter(Boolean)
      .slice(0, 3)
  );
}

export function StorefrontCard({
  product,
  isFavorite = false,
  next = "/catalog",
  eager = false,
}: {
  product: FeaturedProduct;
  isFavorite?: boolean;
  next?: string;
  eager?: boolean;
}) {
  const hoverImage = product.gallery.find((image) => image !== product.image);
  const area = sheetArea(product.format);
  const chips = formatChips(product.format);
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
            loading={eager ? "eager" : undefined}
            fetchPriority={eager ? "high" : undefined}
            className={area ? s.cover : s.contain}
          />
          {hoverImage && (
            <ProductImage
              src={hoverImage}
              alt=""
              fallbackLabel={product.name}
              fill
              sizes="(max-width: 600px) 50vw, (max-width: 1150px) 40vw, 28vw"
              className={`${area ? s.cover : s.contain} ${s.hoverImage}`}
            />
          )}
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
        <div className={s.specChips}>
          {chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
          {area && <span>{area.toFixed(2).replace(".", ",")} м²</span>}
        </div>
        <p className={s.productFormat}>Арт. {product.sku}</p>
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
            {area && typeof product.price === "number" && (
              <span className={s.unitPrice}>
                {formatPrice(Math.round(product.price / area))}/м²
              </span>
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
          {product.inStock
            ? "В наличии"
            : typeof product.price === "number"
              ? "Под заказ"
              : "По запросу"}
        </span>
      </div>
    </article>
  );
}
