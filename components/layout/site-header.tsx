"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { usePathname } from "next/navigation";
import {
  Calculator,
  Home,
  LayoutGrid,
  Menu,
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
  { href: "/calculator", label: "Раскрой", icon: Calculator },
  { href: "/brands", label: "Бренды", icon: Shapes },
  { href: "/cart", label: "Корзина", icon: ShoppingCart },
  { href: "/account", label: "Кабинет", icon: UserRound },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function MobileBottomDock({
  pathname,
  itemCount = 0,
}: {
  pathname: string;
  itemCount?: number;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--line)]/70 bg-[color:color-mix(in_srgb,var(--surface-strong)_92%,white)]/95 backdrop-blur-xl lg:hidden">
      <nav
        aria-label="Мобильная навигация"
        className="mx-auto flex w-full max-w-[28rem] items-end justify-between gap-0.5 px-1.5 pt-1 pb-[calc(0.45rem+env(safe-area-inset-bottom))]"
      >
        {mobileDockNavigation.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-[1rem] px-0.5 py-1.5 transition",
                active
                  ? "bg-[var(--foreground)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
              )}
            >
              <span className="relative">
                <Icon className="size-[17px]" />
                {item.href === "/cart" && itemCount > 0 ? (
                  <span className="absolute -top-1 -right-1.5 flex size-[14px] items-center justify-center rounded-full bg-[var(--accent)] text-[8px] font-bold text-white">
                    {itemCount}
                  </span>
                ) : null}
              </span>
              <span className="truncate font-mono text-[8px] tracking-[0.1em] uppercase">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const { itemCount } = useCart();
  const isHome = pathname === "/";
  const [isHomeScrolled, setIsHomeScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
  const isHeroMode = isHome && !isScrolled && !isMenuOpen;

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
        <div className="relative mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-8 lg:h-14 lg:px-10">
          <nav className="hidden flex-1 items-center gap-7 lg:flex">
            {primaryNavigationLeft.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "font-mono text-[10px] tracking-[0.18em] uppercase transition",
                  isHeroMode
                    ? "text-white/62 hover:text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/"
            className="absolute left-1/2 hidden -translate-x-1/2 px-3 py-1.5 text-[14px] font-black tracking-[0.16em] uppercase lg:block"
          >
            <span
              className={cn(
                "transition",
                isHeroMode ? "text-white" : "text-[var(--foreground)]",
              )}
            >
              {companyName}
            </span>
          </Link>

          <div className="hidden flex-1 items-center justify-end gap-7 lg:flex">
            <nav className="flex items-center gap-7">
              {primaryNavigationRight.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "font-mono text-[10px] tracking-[0.18em] uppercase transition",
                    isHeroMode
                      ? "text-white/62 hover:text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              <Link
                href="/account"
                className={cn(
                  "font-mono text-[10px] tracking-[0.16em] uppercase transition",
                  isHeroMode
                    ? "text-white/62 hover:text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                Кабинет
              </Link>
              <Link
                href="/cart"
                className={cn(
                  "relative rounded-full p-2 transition",
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
            </div>
          </div>

          <div className="flex flex-1 items-center gap-3 lg:hidden">
            <Link
              href="/"
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-2 py-1.5",
                isHeroMode ? "text-white" : "text-[var(--foreground)]",
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-[12px] font-black tracking-[0.14em]",
                  isHeroMode
                    ? "bg-white text-[#151411]"
                    : "bg-[#151411] text-white",
                )}
              >
                A
              </span>
              <span className="text-[13px] font-black tracking-[0.12em] uppercase">
                {companyName}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
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
              onClick={() => setIsMenuOpen(true)}
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
      </header>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-[70] bg-black/38 backdrop-blur-sm lg:hidden">
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

      <MobileBottomDock pathname={pathname} itemCount={itemCount} />
    </>
  );
}
