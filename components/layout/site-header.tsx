"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent,
  type SVGProps,
} from "react";
import { usePathname } from "next/navigation";
import {
  Calculator,
  Home,
  LayoutGrid,
  Menu,
  Search,
  Shapes,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";

import { useCart } from "@/components/providers/cart-provider";
import { companyName, primaryNavigation } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const primaryNavigationLeft = primaryNavigation.slice(0, 3);
const primaryNavigationRight = primaryNavigation.slice(3);

type MobileNavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const mobileDockNavigation: MobileNavItem[] = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/catalog", label: "Каталог", icon: LayoutGrid },
  { href: "/calculator", label: "Распил", icon: Calculator },
  { href: "/brands", label: "Бренды", icon: Shapes },
  { href: "/account", label: "Кабинет", icon: UserRound },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function catalogSearchHref(query: string) {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  const queryString = params.toString();
  return queryString ? `/catalog?${queryString}` : "/catalog";
}

function HeaderNavLink({
  href,
  label,
  isHeroMode,
}: {
  href: string;
  label: string;
  isHeroMode: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-mono text-[9px] tracking-[0.12em] whitespace-nowrap uppercase transition 2xl:text-[10px] 2xl:tracking-[0.16em]",
        isHeroMode
          ? "text-white/68 hover:text-white"
          : "text-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {label}
    </Link>
  );
}

function MobileBottomDock({ pathname }: { pathname: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--line)]/70 bg-[color:color-mix(in_srgb,var(--surface-strong)_92%,white)]/95 backdrop-blur-xl xl:hidden">
      <nav
        aria-label="Мобильная навигация"
        className="mx-auto flex w-full max-w-[26rem] items-end justify-between gap-1 px-2 pt-1.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))]"
      >
        {mobileDockNavigation.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1rem] px-1.5 py-2 transition",
                active
                  ? "bg-[var(--foreground)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
              )}
            >
              <Icon className="size-[17px] shrink-0" />
              <span className="max-w-full truncate font-mono text-[8px] tracking-[0.1em] uppercase">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function HeaderSearchForm({ isHeroMode }: { isHeroMode: boolean }) {
  const [query, setQuery] = useState("");

  function navigateToCatalog() {
    window.location.href = catalogSearchHref(query);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateToCatalog();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    navigateToCatalog();
  }

  return (
    <form
      action="/catalog"
      method="get"
      onSubmit={handleSubmit}
      className={cn(
        "flex h-10 min-w-0 items-center overflow-hidden rounded-[6px] border transition",
        isHeroMode
          ? "border-white/24 bg-white/10 text-white"
          : "border-[color:var(--line)] bg-white/78 text-[var(--foreground)]",
      )}
    >
      <input
        name="q"
        type="search"
        placeholder="Поиск"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-current/48",
          isHeroMode ? "text-white" : "text-[var(--foreground)]",
        )}
      />
      <button
        type="button"
        onClick={navigateToCatalog}
        className={cn(
          "inline-flex h-full w-10 shrink-0 items-center justify-center border-l transition",
          isHeroMode
            ? "border-white/18 hover:bg-white/12"
            : "border-[color:var(--line)] hover:bg-[var(--surface)]",
        )}
        aria-label="Найти"
      >
        <Search className="size-4" />
      </button>
    </form>
  );
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const { itemCount } = useCart();
  const isHome = pathname === "/";
  const [isHomeScrolled, setIsHomeScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (!isHome) {
      return;
    }

    const syncScroll = () => {
      setIsHomeScrolled(window.scrollY > 24);
    };

    syncScroll();
    window.addEventListener("scroll", syncScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncScroll);
    };
  }, [isHome]);

  useEffect(() => {
    if (!isMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const isScrolled = !isHome || isHomeScrolled;
  const isHeroMode = isHome && !isScrolled && !isMenuOpen && !isSearchOpen;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition duration-500",
          isHeroMode
            ? "border-b border-white/8 bg-black/8 text-white backdrop-blur-md"
            : "border-b border-[color:var(--line)]/80 bg-[color:color-mix(in_srgb,var(--surface-strong)_95%,white)]/92 text-[var(--foreground)] backdrop-blur-xl",
        )}
      >
        <div className="mx-auto grid h-16 w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-8 xl:h-14 xl:grid-cols-[auto_minmax(8rem,1fr)_auto] xl:gap-5 xl:px-10">
          <nav className="hidden min-w-0 items-center gap-4 xl:flex 2xl:gap-6">
            {primaryNavigationLeft.map((item) => (
              <HeaderNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                isHeroMode={isHeroMode}
              />
            ))}
          </nav>

          <Link
            href="/"
            className={cn(
              "inline-flex min-w-0 items-center gap-2 rounded-[6px] py-1.5 pr-2 xl:justify-center xl:px-3",
              isHeroMode ? "text-white" : "text-[var(--foreground)]",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-black tracking-[0.14em] xl:hidden",
                isHeroMode
                  ? "bg-white text-[#151411]"
                  : "bg-[#151411] text-white",
              )}
            >
              A
            </span>
            <span className="max-w-[54vw] truncate text-[13px] font-black tracking-[0.12em] uppercase sm:max-w-[24rem] xl:max-w-[14rem] xl:text-[14px] xl:tracking-[0.16em] 2xl:max-w-none">
              {companyName}
            </span>
          </Link>

          <div className="hidden min-w-0 items-center justify-end gap-3 xl:flex 2xl:gap-5">
            <nav className="flex min-w-0 items-center justify-end gap-4 2xl:gap-6">
              {primaryNavigationRight.map((item) => (
                <HeaderNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  isHeroMode={isHeroMode}
                />
              ))}
            </nav>

            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <div className="w-[10rem] 2xl:w-[16rem]">
                <HeaderSearchForm isHeroMode={isHeroMode} />
              </div>
              <Link
                href="/account"
                className={cn(
                  "font-mono text-[9px] tracking-[0.12em] whitespace-nowrap uppercase transition 2xl:text-[10px] 2xl:tracking-[0.16em]",
                  isHeroMode
                    ? "text-white/68 hover:text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                Кабинет
              </Link>
              <Link
                href="/cart"
                className={cn(
                  "relative shrink-0 rounded-full p-2 transition",
                  isHeroMode
                    ? "hover:bg-white/10"
                    : "hover:bg-[var(--surface)]",
                )}
                aria-label="Корзина"
              >
                <ShoppingCart
                  className={cn(
                    "size-[18px]",
                    isHeroMode ? "text-white" : "text-[var(--foreground)]",
                  )}
                />
                {itemCount > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 flex size-[1.1rem] items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
                    {itemCount}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 xl:hidden">
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen((current) => !current);
                setIsMenuOpen(false);
              }}
              className={cn(
                "rounded-full p-2.5 transition",
                isHeroMode ? "hover:bg-white/10" : "hover:bg-[var(--surface)]",
              )}
              aria-label="Открыть поиск"
            >
              <Search
                className={cn(
                  "size-[18px]",
                  isHeroMode ? "text-white" : "text-[var(--foreground)]",
                )}
              />
            </button>

            <Link
              href="/cart"
              className={cn(
                "relative rounded-full p-2.5 transition",
                isHeroMode ? "hover:bg-white/10" : "hover:bg-[var(--surface)]",
              )}
              aria-label="Корзина"
            >
              <ShoppingCart
                className={cn(
                  "size-[18px]",
                  isHeroMode ? "text-white" : "text-[var(--foreground)]",
                )}
              />
              {itemCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex size-[1.1rem] items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
                  {itemCount}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(true);
                setIsSearchOpen(false);
              }}
              className={cn(
                "rounded-full p-2.5 transition",
                isHeroMode ? "hover:bg-white/10" : "hover:bg-[var(--surface)]",
              )}
              aria-label="Открыть меню"
            >
              <Menu
                className={cn(
                  "size-[18px]",
                  isHeroMode ? "text-white" : "text-[var(--foreground)]",
                )}
              />
            </button>
          </div>
        </div>

        {isSearchOpen ? (
          <div className="border-t border-[color:var(--line)]/70 px-4 pb-3 sm:px-8 xl:hidden">
            <div className="mx-auto max-w-[1600px]">
              <HeaderSearchForm isHeroMode={isHeroMode} />
            </div>
          </div>
        ) : null}
      </header>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-[70] bg-black/38 backdrop-blur-sm xl:hidden">
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border-t border-[color:var(--line)] bg-[#f6f2eb] px-5 pt-5 shadow-[0_-28px_90px_rgba(12,18,24,0.18)]"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                  Навигация
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                  Быстрый доступ к разделам
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="rounded-full border border-[color:var(--line)] p-2.5 text-[var(--muted)]"
                aria-label="Закрыть меню"
              >
                <X className="size-[18px]" />
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              {primaryNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between rounded-[1.25rem] border px-4 py-4 text-sm font-medium transition",
                    isActivePath(pathname, item.href)
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                      : "border-[color:var(--line)] bg-white/72 text-[var(--foreground)]",
                  )}
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-70">
                    Открыть
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link
                href="/account"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex h-12 items-center justify-center rounded-[1rem] border border-[color:var(--line)] bg-white/72 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase"
              >
                Кабинет
              </Link>
              <Link
                href="/contacts"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex h-12 items-center justify-center rounded-[1rem] border border-[color:var(--line)] bg-white/72 font-mono text-[10px] tracking-[0.14em] text-[var(--foreground)] uppercase"
              >
                Контакты
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Закрыть меню по фону"
            className="absolute inset-0 -z-10"
          />
        </div>
      ) : null}

      <MobileBottomDock pathname={pathname} />
    </>
  );
}
