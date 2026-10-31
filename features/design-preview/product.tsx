"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Maximize2,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  catalogHref,
  liveRoot,
  maximumQuantity,
  previewRoot,
  priceLabel,
  products,
  unitLabel,
  type PreviewProductData,
} from "./data";
import { PreviewCard, PreviewDialog, Quantity, usePreview } from "./shell";
import s from "./preview.module.css";

export function PreviewProduct({ product }: { product: PreviewProductData }) {
  const [image, setImage] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<"specifications" | "delivery">(
    "specifications",
  );
  const touchStart = useRef<number | null>(null);
  const { cart, favorites, add, favorite } = usePreview();
  const selected = favorites.includes(product.slug);
  const remaining = Math.max(
    0,
    maximumQuantity(product) - (cart[product.slug] ?? 0),
  );
  const related = products
    .filter(
      (item) =>
        item.category === product.category && item.slug !== product.slug,
    )
    .slice(0, 4);
  const next = (delta: number) =>
    setImage((image + delta + product.gallery.length) % product.gallery.length);
  const technical = product.specifications.length
    ? product.specifications
    : [
        { key: "Бренд", value: product.brand },
        { key: "Артикул", value: product.sku },
        ...(product.format ? [{ key: "Формат", value: product.format }] : []),
      ];
  return (
    <div className={`${s.container} ${s.productPage}`}>
      <div className={s.breadcrumbs}>
        <Link href={previewRoot}>Главная</Link>
        <ChevronRight size={14} />
        <Link href={catalogHref()}>Каталог</Link>
        <ChevronRight size={14} />
        <Link href={catalogHref({ category: product.category })}>
          {product.categoryName}
        </Link>
      </div>
      <div className={s.productDetail}>
        <div className={s.gallery}>
          <div
            className={s.mainImage}
            onTouchStart={(e) => {
              touchStart.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStart.current !== null) {
                const delta = e.changedTouches[0].clientX - touchStart.current;
                if (Math.abs(delta) > 45) next(delta > 0 ? -1 : 1);
                touchStart.current = null;
              }
            }}
          >
            <button
              className={s.imageOpen}
              onClick={() => setZoom(true)}
              aria-label="Открыть фото в полном размере"
            >
              <Image
                src={product.gallery[image]}
                alt={`${product.name}, фото ${image + 1}`}
                fill
                unoptimized
                priority
                sizes="(max-width: 900px) 100vw, 55vw"
                className={s.contain}
              />
              <Maximize2 size={20} />
            </button>
            {product.gallery.length > 1 ? (
              <>
                <button
                  className={`${s.galleryArrow} ${s.galleryPrev}`}
                  aria-label="Предыдущее фото"
                  onClick={() => next(-1)}
                >
                  <ChevronLeft size={21} />
                </button>
                <button
                  className={`${s.galleryArrow} ${s.galleryNext}`}
                  aria-label="Следующее фото"
                  onClick={() => next(1)}
                >
                  <ChevronRight size={21} />
                </button>
              </>
            ) : null}
            <span className={s.imageCount}>
              {image + 1} / {product.gallery.length}
            </span>
          </div>
          <div className={s.thumbnails}>
            {product.gallery.map((src, index) => (
              <button
                key={src}
                onClick={() => setImage(index)}
                aria-label={`Фото ${index + 1}`}
                aria-pressed={image === index}
              >
                <Image src={src} alt="" width={80} height={80} unoptimized />
              </button>
            ))}
            <p>
              Цвет на экране может отличаться
              <br />
              от реального образца материала.
            </p>
          </div>
        </div>
        <div className={s.detailInfo}>
          <Link
            className={s.detailBrand}
            href={catalogHref({ brand: product.brandSlug })}
          >
            {product.brand} <ArrowUpRight size={16} />
          </Link>
          <h1>{product.name}</h1>
          <p className={s.sku}>Артикул: {product.sku}</p>
          <span
            className={`${s.availability} ${product.available ? "" : s.unavailable}`}
          >
            <span />
            {product.available ? "В наличии" : "Под заказ"}
            {product.stock !== null
              ? ` · ${product.stock} ${unitLabel(product) === "лист" ? "л." : "шт."}`
              : ""}
          </span>
          {product.format ? (
            <div className={s.formatDetail}>
              <span>Формат и толщина</span>
              <strong>{product.format}</strong>
            </div>
          ) : null}
          <div className={s.detailPrice}>
            <strong>
              {product.price === null
                ? "Цена по запросу"
                : priceLabel(product.price)}
            </strong>
            <span>за {unitLabel(product)}</span>
          </div>
          <div className={s.buyRow}>
            <Quantity
              value={Math.min(quantity, Math.max(1, remaining))}
              max={Math.max(1, remaining)}
              onChange={setQuantity}
            />
            <button
              className={s.primaryButton}
              disabled={remaining <= 0 || product.price === null}
              onClick={() => add(product, Math.min(quantity, remaining))}
            >
              <ShoppingBag size={20} />
              {remaining > 0 ? "В корзину" : "Недоступно"}
            </button>
            <button
              className={`${s.iconButton} ${selected ? s.isFavorite : ""}`}
              aria-label="Добавить товар в избранное"
              title="Избранное"
              aria-pressed={selected}
              onClick={() => favorite(product.slug)}
            >
              <Heart size={22} fill={selected ? "currentColor" : "none"} />
            </button>
          </div>
          {cart[product.slug] ? (
            <p className={s.inCart}>
              <Check size={16} />В пробной корзине: {cart[product.slug]}{" "}
              {unitLabel(product) === "лист" ? "л." : "шт."}
            </p>
          ) : null}
          <div className={s.fulfillment}>
            <PackageCheck size={23} strokeWidth={1.5} />
            <div>
              <strong>Самовывоз в Бишкеке</strong>
              <p>Уточните наличие в выбранном магазине</p>
            </div>
            <ArrowUpRight size={18} />
          </div>
          <a
            className={s.liveProduct}
            href={`${liveRoot}/product/${product.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Товар на действующем сайте <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      <section className={s.detailTabs}>
        <div role="tablist" aria-label="Информация о товаре">
          <button
            id="preview-spec-tab"
            role="tab"
            aria-controls="preview-detail-panel"
            aria-selected={tab === "specifications"}
            onClick={() => setTab("specifications")}
          >
            Характеристики
          </button>
          <button
            id="preview-delivery-tab"
            role="tab"
            aria-controls="preview-detail-panel"
            aria-selected={tab === "delivery"}
            onClick={() => setTab("delivery")}
          >
            Получение товара
          </button>
        </div>
        <div
          id="preview-detail-panel"
          role="tabpanel"
          aria-labelledby={
            tab === "specifications"
              ? "preview-spec-tab"
              : "preview-delivery-tab"
          }
        >
          {tab === "specifications" ? (
            <dl className={s.specifications}>
              {technical.map((item, index) => (
                <div key={`${item.key}-${index}`}>
                  <dt>{item.key}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className={s.deliveryText}>
              <h3>Подготовим материалы к вашему проекту</h3>
              <p>
                Способ получения, наличие и услуги распила можно согласовать с
                менеджером Artisan.
              </p>
              <a
                href="https://wa.me/996502788118"
                target="_blank"
                rel="noreferrer"
                className={s.textLink}
              >
                Связаться с менеджером <ArrowRight size={18} />
              </a>
            </div>
          )}
        </div>
      </section>
      {related.length ? (
        <section className={s.section}>
          <div className={s.sectionHeading}>
            <div>
              <p className={s.eyebrow}>Продолжить подбор</p>
              <h2>В той же коллекции</h2>
            </div>
            <Link
              className={s.textLink}
              href={catalogHref({ category: product.category })}
            >
              Смотреть всё <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className={s.homeProducts}>
            {related.map((p) => (
              <PreviewCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      ) : (
        <Link href={catalogHref()} className={s.textLink}>
          <ArrowLeft size={18} />
          Вернуться в каталог
        </Link>
      )}
      <PreviewDialog
        open={zoom}
        onClose={() => setZoom(false)}
        title="Фотографии товара"
        wide
      >
        <div className={s.zoomImage}>
          <Image
            src={product.gallery[image]}
            alt={product.name}
            fill
            unoptimized
            sizes="90vw"
            className={s.contain}
          />
        </div>
        <div className={s.zoomControls}>
          <button
            className={s.iconButton}
            aria-label="Предыдущее увеличенное фото"
            disabled={product.gallery.length < 2}
            onClick={() => next(-1)}
          >
            <ChevronLeft size={24} />
          </button>
          <span>
            {image + 1} / {product.gallery.length}
          </span>
          <button
            className={s.iconButton}
            aria-label="Следующее увеличенное фото"
            disabled={product.gallery.length < 2}
            onClick={() => next(1)}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </PreviewDialog>
    </div>
  );
}
