"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Heart,
  Home,
  LayoutGrid,
  MapPin,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  catalogHref,
  categories,
  liveRoot,
  maximumQuantity,
  previewRoot,
  priceLabel,
  productCountLabel,
  productHref,
  products,
  unitLabel,
  type PreviewProductData,
} from "./data";
import s from "./preview.module.css";

type PreviewState = {
  cart: Record<string, number>;
  favorites: string[];
  add: (product: PreviewProductData, quantity?: number) => void;
  change: (product: PreviewProductData, quantity: number) => void;
  favorite: (slug: string) => void;
  openCart: () => void;
};
const PreviewContext = createContext<PreviewState | null>(null);
export function usePreview() {
  const state = useContext(PreviewContext);
  if (!state) throw new Error("Preview controls require PreviewShell");
  return state;
}

export function PreviewDialog({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${wide ? s.wideDialog : ""}`}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={s.dialogInner}>
        <div className={s.dialogHeading}>
          <h2>{title}</h2>
          <button
            type="button"
            className={s.iconButton}
            title="Закрыть"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Quantity({
  value,
  max,
  onChange,
  label = "Количество",
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    const parsed = Number(draft ?? value);
    const quantity = Number.isFinite(parsed)
      ? Math.max(1, Math.min(max, Math.floor(parsed)))
      : value;
    setDraft(null);
    onChange(quantity);
  }
  return (
    <div className={s.quantity}>
      <button
        type="button"
        aria-label="Уменьшить количество"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        min={1}
        max={max}
        inputMode="numeric"
        aria-label={label}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
      <button
        type="button"
        aria-label="Увеличить количество"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

export function PreviewCard({ product }: { product: PreviewProductData }) {
  const { favorites, favorite, cart, add } = usePreview();
  const selected = favorites.includes(product.slug);
  const remaining = maximumQuantity(product) - (cart[product.slug] ?? 0);
  return (
    <article className={s.productCard}>
      <div className={s.productVisual}>
        <Link href={productHref(product.slug)} aria-label={product.name}>
          <Image
            src={product.gallery[0]}
            alt={product.name}
            fill
            unoptimized
            sizes="(max-width: 600px) 50vw, 30vw"
            className={
              product.category === "furnitura" ||
              product.category === "organizaciya-kuhni"
                ? s.contain
                : s.cover
            }
          />
        </Link>
        <button
          className={`${s.favoriteButton} ${selected ? s.isFavorite : ""}`}
          type="button"
          aria-label={selected ? "Удалить из избранного" : "В избранное"}
          aria-pressed={selected}
          title={selected ? "Удалить из избранного" : "В избранное"}
          onClick={() => favorite(product.slug)}
        >
          <Heart size={18} fill={selected ? "currentColor" : "none"} />
        </button>
        {product.format ? (
          <span className={s.formatTag}>
            {product.format.split(", ").at(-1)}
          </span>
        ) : null}
      </div>
      <div className={s.productInfo}>
        <div className={s.productBrand}>
          {product.brand}
          <span>{product.categoryName}</span>
        </div>
        <h3>
          <Link href={productHref(product.slug)}>{product.name}</Link>
        </h3>
        <p className={s.productFormat}>
          {product.format || `Артикул: ${product.sku}`}
        </p>
        <div className={s.productBottom}>
          <div>
            <strong>
              {product.price === null
                ? "По запросу"
                : priceLabel(product.price)}
            </strong>
            <span>за {unitLabel(product)}</span>
          </div>
          <button
            type="button"
            className={s.addIcon}
            title={
              remaining > 0
                ? "Добавить в пробную корзину"
                : "Нет доступного остатка"
            }
            aria-label={`В корзину: ${product.name}`}
            disabled={remaining <= 0 || product.price === null}
            onClick={() => add(product)}
          >
            {cart[product.slug] ? <Check size={19} /> : <Plus size={21} />}
          </button>
        </div>
        <span
          className={`${s.availability} ${product.available ? "" : s.unavailable}`}
        >
          <span />
          {product.available ? "В наличии" : "Под заказ"}
        </span>
      </div>
    </article>
  );
}

export function PreviewShell({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [panel, setPanel] = useState<"cart" | "favorites" | "menu" | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );
  function add(product: PreviewProductData, quantity = 1) {
    setCart((current) => ({
      ...current,
      [product.slug]: Math.min(
        maximumQuantity(product),
        (current[product.slug] ?? 0) + quantity,
      ),
    }));
    setNotice("Добавлено в пробную корзину");
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2800);
  }
  function change(product: PreviewProductData, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[product.slug];
      else
        next[product.slug] = Math.max(
          1,
          Math.min(maximumQuantity(product), Math.floor(quantity)),
        );
      return next;
    });
  }
  const favorite = (slug: string) =>
    setFavorites((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const rows = products.filter((item) => cart[item.slug]);
  const total = rows.reduce(
    (sum, item) => sum + (item.price ?? 0) * cart[item.slug],
    0,
  );
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    setSearchOpen(false);
    setPanel(null);
    router.push(catalogHref({ q }));
  }
  return (
    <PreviewContext.Provider
      value={{
        cart,
        favorites,
        add,
        change,
        favorite,
        openCart: () => setPanel("cart"),
      }}
    >
      <div className={s.root} data-premium-preview>
        <div className={s.previewBar}>
          <span>
            <i /> Предпросмотр · концепция 01
          </span>
          <a href={liveRoot} target="_blank" rel="noreferrer">
            Текущий сайт <ArrowUpRight size={14} />
          </a>
        </div>
        <header className={s.header}>
          <div className={`${s.container} ${s.headerMain}`}>
            <Link
              href={previewRoot}
              className={s.wordmark}
              aria-label="Artisan, главная"
            >
              ARTISAN<span>МАТЕРИАЛЫ ДЛЯ МЕБЕЛИ</span>
            </Link>
            <form className={s.desktopSearch} onSubmit={search}>
              <Search size={19} />
              <input
                name="q"
                type="search"
                aria-label="Поиск по каталогу"
                placeholder="Название, бренд или артикул"
              />
              <button aria-label="Найти" title="Найти">
                <ArrowRight size={19} />
              </button>
            </form>
            <div className={s.headerActions}>
              <button
                className={`${s.iconButton} ${s.mobileOnly}`}
                aria-label="Открыть поиск"
                title="Поиск"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Search size={23} />
              </button>
              <button
                className={`${s.iconButton} ${s.desktopOnly}`}
                aria-label="Избранное"
                title="Избранное"
                onClick={() => setPanel("favorites")}
              >
                <Heart size={22} />
                {favorites.length ? <b>{favorites.length}</b> : null}
              </button>
              <a
                className={`${s.iconButton} ${s.desktopOnly}`}
                href={`${liveRoot}/account`}
                target="_blank"
                rel="noreferrer"
                aria-label="Личный кабинет на действующем сайте"
                title="Личный кабинет на действующем сайте"
              >
                <UserRound size={22} />
              </a>
              <button
                className={s.iconButton}
                aria-label={`Корзина, ${productCountLabel(count)}`}
                title="Пробная корзина"
                onClick={() => setPanel("cart")}
              >
                <ShoppingBag size={23} />
                {count ? <b>{count}</b> : null}
              </button>
              <button
                className={`${s.iconButton} ${s.mobileOnly}`}
                aria-label="Открыть меню"
                title="Меню"
                onClick={() => setPanel("menu")}
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
          {searchOpen ? (
            <form
              className={`${s.mobileSearch} ${s.container}`}
              onSubmit={search}
            >
              <input
                autoFocus
                type="search"
                name="q"
                aria-label="Найти товар"
                placeholder="Название или артикул"
              />
              <button className={s.iconButton} aria-label="Найти">
                <ArrowRight size={20} />
              </button>
            </form>
          ) : null}
          <nav className={s.nav} aria-label="Основная навигация">
            <div className={s.container}>
              <Link href={catalogHref()} className={s.catalogNav}>
                <LayoutGrid size={17} /> Каталог
              </Link>
              <Link href={catalogHref({ category: "mdf" })}>МДФ</Link>
              <Link href={catalogHref({ category: "ldsp" })}>ЛДСП</Link>
              <Link href={catalogHref({ category: "furnitura" })}>
                Фурнитура
              </Link>
              <Link href={`${previewRoot}#brands`}>Бренды</Link>
              <Link href={`${previewRoot}#services`}>Распил и услуги</Link>
              <a href="tel:+996553432131" className={s.phone}>
                +996 553 432 131
              </a>
            </div>
          </nav>
        </header>
        <main id="main-content">{children}</main>
        <footer className={s.footer}>
          <div className={s.container}>
            <div>
              <Link href={previewRoot} className={s.wordmark}>
                ARTISAN
              </Link>
              <p>Материалы. Фурнитура. Возможности.</p>
            </div>
            <div>
              <p>
                <MapPin size={16} /> Бишкек, Кыргызстан
              </p>
              <a href="tel:+996553432131">+996 553 432 131</a>
            </div>
            <a
              href="https://wa.me/996553432131"
              target="_blank"
              rel="noreferrer"
              className={s.textLink}
            >
              Написать в WhatsApp <ArrowUpRight size={18} />
            </a>
          </div>
        </footer>
        <nav className={s.mobileDock} aria-label="Мобильная навигация">
          <Link
            href={previewRoot}
            aria-current={pathname === previewRoot ? "page" : undefined}
          >
            <Home size={21} />
            Главная
          </Link>
          <Link
            href={catalogHref()}
            aria-current={pathname.endsWith("catalog") ? "page" : undefined}
          >
            <LayoutGrid size={21} />
            Каталог
          </Link>
          <button onClick={() => setPanel("favorites")}>
            <Heart size={21} />
            Избранное
          </button>
          <button onClick={() => setPanel("cart")}>
            <ShoppingBag size={21} />
            Корзина {count || ""}
          </button>
        </nav>
        <div
          role="status"
          className={`${s.toast} ${notice ? s.toastVisible : ""}`}
        >
          {notice ? (
            <>
              <Check size={18} />
              {notice}
              <button
                onClick={() => setPanel("cart")}
                aria-label="Открыть пробную корзину"
              >
                <ArrowRight size={20} />
              </button>
            </>
          ) : null}
        </div>
        <PreviewDialog
          open={panel === "cart"}
          onClose={() => setPanel(null)}
          title={`Корзина${count ? ` · ${count}` : ""}`}
        >
          {rows.length ? (
            <>
              <div className={s.cartRows}>
                {rows.map((product) => (
                  <div key={product.slug} className={s.cartRow}>
                    <Link
                      href={productHref(product.slug)}
                      onClick={() => setPanel(null)}
                    >
                      <Image
                        src={product.gallery[0]}
                        alt={product.name}
                        width={80}
                        height={80}
                        unoptimized
                      />
                    </Link>
                    <div>
                      <span className={s.eyebrow}>{product.brand}</span>
                      <Link
                        href={productHref(product.slug)}
                        onClick={() => setPanel(null)}
                      >
                        {product.name}
                      </Link>
                      <div className={s.cartRowBottom}>
                        <Quantity
                          value={cart[product.slug]}
                          max={maximumQuantity(product)}
                          onChange={(q) => change(product, q)}
                        />
                        <strong>
                          {priceLabel(
                            (product.price ?? 0) * cart[product.slug],
                          )}
                        </strong>
                      </div>
                    </div>
                    <button
                      className={s.iconButton}
                      aria-label={`Удалить ${product.name}`}
                      title="Удалить"
                      onClick={() => change(product, 0)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <div className={s.cartTotal}>
                <span>Итого</span>
                <strong>{priceLabel(total)}</strong>
              </div>
              <p className={s.disclaimer}>
                Пробная корзина. Заказ не создаётся, оплата не производится.
              </p>
              <button
                className={s.primaryButton}
                onClick={() => setPanel(null)}
              >
                Продолжить подбор <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <div className={s.empty}>
              <ShoppingBag size={40} strokeWidth={1} />
              <h3>Здесь будут ваши материалы</h3>
              <Link
                href={catalogHref()}
                onClick={() => setPanel(null)}
                className={s.primaryButton}
              >
                Перейти в каталог <ArrowRight size={18} />
              </Link>
            </div>
          )}
        </PreviewDialog>
        <PreviewDialog
          open={panel === "favorites"}
          onClose={() => setPanel(null)}
          title="Избранное"
        >
          {favorites.length ? (
            <div className={s.favoriteRows}>
              {products
                .filter((p) => favorites.includes(p.slug))
                .map((p) => (
                  <div key={p.slug}>
                    <Image
                      src={p.gallery[0]}
                      alt={p.name}
                      width={72}
                      height={72}
                      unoptimized
                    />
                    <Link
                      href={productHref(p.slug)}
                      onClick={() => setPanel(null)}
                    >
                      {p.name}
                    </Link>
                    <button
                      className={s.iconButton}
                      onClick={() => favorite(p.slug)}
                      aria-label={`Убрать ${p.name}`}
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div className={s.empty}>
              <Heart size={40} strokeWidth={1} />
              <h3>Ваша подборка материалов</h3>
              <p>Избранных товаров пока нет.</p>
            </div>
          )}
        </PreviewDialog>
        <PreviewDialog
          open={panel === "menu"}
          onClose={() => setPanel(null)}
          title="Каталог Artisan"
        >
          <div className={s.menuLinks}>
            <Link href={catalogHref()} onClick={() => setPanel(null)}>
              Весь каталог <ArrowRight size={18} />
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={catalogHref({ category: c.slug })}
                onClick={() => setPanel(null)}
              >
                {c.name}
                <ArrowRight size={18} />
              </Link>
            ))}
            <Link href={`${previewRoot}#brands`} onClick={() => setPanel(null)}>
              Бренды
              <ArrowDown size={18} />
            </Link>
            <Link
              href={`${previewRoot}#services`}
              onClick={() => setPanel(null)}
            >
              Распил и услуги
              <ArrowDown size={18} />
            </Link>
          </div>
        </PreviewDialog>
      </div>
    </PreviewContext.Provider>
  );
}
