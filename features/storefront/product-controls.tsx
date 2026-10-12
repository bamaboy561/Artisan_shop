"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { ProductImage } from "@/components/catalog/product-image";
import { AddToCartButton } from "@/components/ecommerce/add-to-cart-button";
import { useCart } from "@/components/providers/cart-provider";
import { MAX_CART_ITEM_QUANTITY } from "@/features/cart/state";
import { Quantity, StorefrontDialog } from "./controls";
import s from "./storefront.module.css";

export function StorefrontGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const active = images[index] ?? images[0];
  function step(delta: number) {
    setIndex((current) => (current + delta + images.length) % images.length);
  }
  return (
    <div className={s.gallery}>
      <div className={s.mainImage}>
        <button
          type="button"
          className={s.imageOpen}
          aria-label="Увеличить фото"
          onClick={() => setZoom(true)}
        >
          <ProductImage
            src={active}
            alt={name}
            fallbackLabel={name}
            fill
            priority
            sizes="(max-width: 850px) 100vw, 55vw"
            className={s.contain}
          />
          <Maximize2 size={20} />
        </button>
        {images.length > 1 && (
          <>
            <button
              type="button"
              className={`${s.galleryArrow} ${s.galleryPrev}`}
              aria-label="Предыдущее фото"
              onClick={() => step(-1)}
            >
              <ChevronLeft size={21} />
            </button>
            <button
              type="button"
              className={`${s.galleryArrow} ${s.galleryNext}`}
              aria-label="Следующее фото"
              onClick={() => step(1)}
            >
              <ChevronRight size={21} />
            </button>
          </>
        )}
        <span className={s.imageCount}>
          {index + 1} / {images.length}
        </span>
      </div>
      {images.length > 1 && (
        <div className={s.thumbnails}>
          {images.map((src, itemIndex) => (
            <button
              type="button"
              key={`${src}-${itemIndex}`}
              aria-label={`Фото ${itemIndex + 1}`}
              aria-pressed={index === itemIndex}
              onClick={() => setIndex(itemIndex)}
            >
              <ProductImage
                src={src}
                alt={`${name}, фото ${itemIndex + 1}`}
                width={72}
                height={72}
              />
            </button>
          ))}
        </div>
      )}
      <StorefrontDialog
        open={zoom}
        onClose={() => setZoom(false)}
        title={name}
        wide
      >
        <div
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") step(-1);
            if (event.key === "ArrowRight") step(1);
          }}
        >
          <div className={s.zoomImage}>
            <ProductImage
              src={active}
              alt={name}
              fallbackLabel={name}
              fill
              sizes="95vw"
              unoptimized
              className={s.contain}
            />
          </div>
          {images.length > 1 && (
            <div className={s.zoomControls}>
              <button
                type="button"
                className={s.iconButton}
                aria-label="Предыдущее фото в полном размере"
                onClick={() => step(-1)}
              >
                <ChevronLeft size={22} />
              </button>
              <span>
                {index + 1} / {images.length}
              </span>
              <button
                type="button"
                className={s.iconButton}
                aria-label="Следующее фото в полном размере"
                onClick={() => step(1)}
              >
                <ChevronRight size={22} />
              </button>
            </div>
          )}
        </div>
      </StorefrontDialog>
    </div>
  );
}

export function ProductPurchase({
  slug,
  stock,
  inStock,
}: {
  slug: string;
  stock: number | null;
  inStock: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const { items } = useCart();
  const inCart = items.find((item) => item.productSlug === slug)?.quantity ?? 0;
  const remaining = Math.max(
    0,
    Math.min(MAX_CART_ITEM_QUANTITY, stock ?? MAX_CART_ITEM_QUANTITY) - inCart,
  );
  const value = Math.max(1, Math.min(quantity, remaining));
  return (
    <>
      <div className={s.buyRow}>
        <Quantity
          value={value}
          max={Math.max(1, remaining)}
          onChange={setQuantity}
        />
        <AddToCartButton
          productSlug={slug}
          quantity={value}
          disabled={!inStock || remaining < 1}
          className={s.purchaseButton}
        />
      </div>
      {inCart > 0 && <p className={s.inCart}>В корзине: {inCart}</p>}
    </>
  );
}

export function ProductSections({
  specifications,
  description,
}: {
  specifications: ReactNode;
  description: ReactNode;
}) {
  const [tab, setTab] = useState(0);
  return (
    <section className={s.detailTabs}>
      <div role="tablist" aria-label="Информация о товаре">
        {["Характеристики", "Описание"].map((label, index) => (
          <button
            type="button"
            key={label}
            id={`product-tab-${index}`}
            role="tab"
            aria-selected={tab === index}
            aria-controls={`product-panel-${index}`}
            tabIndex={tab === index ? 0 : -1}
            onClick={() => setTab(index)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - tab;
                setTab(next);
                document.getElementById(`product-tab-${next}`)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`product-panel-${tab}`}
        aria-labelledby={`product-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 0 ? specifications : description}
      </div>
    </section>
  );
}
