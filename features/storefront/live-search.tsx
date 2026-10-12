"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Search, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ProductImage } from "@/components/catalog/product-image";
import type { PublicProductSearchItem } from "@/features/catalog/types";
import { formatPrice } from "@/lib/commerce";
import s from "./storefront.module.css";

type SearchResult = {
  query: string;
  products: PublicProductSearchItem[];
  failed: boolean;
};

export function LiveSearch({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [retry, setRetry] = useState(0);
  const query = value.trim();
  const expanded = open && query.length >= 2;
  const current = result?.query === query ? result : null;
  const products = current?.products ?? [];
  const catalogHref = query
    ? `/catalog?${new URLSearchParams({ q: query })}`
    : "/catalog";

  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      timeout = setTimeout(() => {
        controller.abort();
        setResult({ query, products: [], failed: true });
      }, 8000);
      try {
        const response = await fetch(
          `/api/catalog/search?${new URLSearchParams({ q: query })}`,
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json();
        if (!Array.isArray(data.products))
          throw new Error("Invalid search response");
        if (!controller.signal.aborted) {
          setResult({
            query,
            products: data.products.slice(0, 5),
            failed: false,
          });
        }
      } catch {
        if (!controller.signal.aborted)
          setResult({ query, products: [], failed: true });
      } finally {
        clearTimeout(timeout);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [expanded, query, retry]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function navigate(href: string) {
    setOpen(false);
    setActive(-1);
    input.current?.blur();
    onNavigate();
    router.push(href);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(
      expanded && active >= 0 && products[active]
        ? `/product/${products[active].slug}`
        : catalogHref,
    );
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (!products.length) return;
      const next =
        event.key === "ArrowDown"
          ? (active + 1) % products.length
          : active <= 0
            ? products.length - 1
            : active - 1;
      setActive(next);
      document
        .getElementById(`${id}-${next}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  return (
    <div
      ref={root}
      className={`${s.liveSearch} ${mobile ? s.mobileLiveSearch : s.desktopLiveSearch}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <form role="search" className={s.liveSearchField} onSubmit={submit}>
        <Search size={18} aria-hidden="true" />
        <input
          ref={input}
          autoFocus={mobile}
          name="q"
          type="search"
          role="combobox"
          aria-label="Поиск по каталогу"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? `${id}-list` : undefined}
          aria-activedescendant={
            expanded && products[active] ? `${id}-${active}` : undefined
          }
          autoComplete="off"
          maxLength={200}
          placeholder="Название, бренд или артикул"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={keyDown}
        />
        {value && (
          <button
            type="button"
            className={s.iconButton}
            title="Очистить поиск"
            aria-label="Очистить поиск"
            onClick={() => {
              setValue("");
              setActive(-1);
              input.current?.focus();
            }}
          >
            <X size={17} />
          </button>
        )}
        <button
          className={s.iconButton}
          type="submit"
          aria-label="Найти"
          title="Найти"
        >
          <ArrowRight size={19} />
        </button>
      </form>
      {expanded && (
        <div className={s.searchDropdown}>
          <div className={s.searchStatus} role="status" aria-live="polite">
            {!current ? (
              <>
                <LoaderCircle size={16} className="animate-spin" /> Ищем товары…
              </>
            ) : current.failed ? (
              <>
                Поиск временно недоступен{" "}
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setRetry((value) => value + 1);
                  }}
                >
                  Повторить
                </button>
              </>
            ) : products.length ? (
              `Товары: ${products.length}`
            ) : (
              "Товары не найдены"
            )}
          </div>
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Найденные товары"
            className={s.searchOptions}
          >
            {products.map((product, index) => (
              <li key={product.slug} role="presentation">
                <Link
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={active === index}
                  tabIndex={-1}
                  href={`/product/${product.slug}`}
                  prefetch={false}
                  className={s.searchOption}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    setOpen(false);
                    setActive(-1);
                    onNavigate();
                  }}
                >
                  <ProductImage
                    src={product.image}
                    alt=""
                    fallbackLabel={product.brand}
                    width={56}
                    height={56}
                  />
                  <div className={s.searchProductText}>
                    <strong>{product.name}</strong>
                    <span>
                      {product.brand} · {product.categoryName}
                    </span>
                    <span>Артикул: {product.sku}</span>
                    <div className={s.searchProductBottom}>
                      <b>
                        {typeof product.price === "number"
                          ? formatPrice(product.price)
                          : "По запросу"}
                      </b>
                      {typeof product.oldPrice === "number" &&
                        typeof product.price === "number" &&
                        product.oldPrice > product.price && (
                          <del>{formatPrice(product.oldPrice)}</del>
                        )}
                      <span
                        className={
                          product.inStock ? s.searchInStock : undefined
                        }
                      >
                        {product.inStock ? "В наличии" : "Под заказ"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={catalogHref}
            className={s.searchAll}
            onClick={() => {
              setOpen(false);
              onNavigate();
            }}
          >
            Все результаты <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </div>
  );
}
