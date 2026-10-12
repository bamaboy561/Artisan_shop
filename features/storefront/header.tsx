"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Calculator,
  Heart,
  Home,
  LayoutGrid,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { companyContacts, primaryNavigation } from "@/lib/site-config";
import { StorefrontDialog } from "./controls";
import { LiveSearch } from "./live-search";
import s from "./storefront.module.css";

export function StorefrontHeader({
  categories,
}: {
  categories: { slug: string; name: string }[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { itemCount } = useCart();
  const pathname = usePathname();
  function closeSearch() {
    setSearchOpen(false);
    setMenuOpen(false);
  }
  const featuredCategories = categories
    .filter((category) => /^(МДФ|ЛДСП|Фурнитура)/i.test(category.name))
    .slice(0, 3);
  const dock = [
    { href: "/", label: "Главная", icon: Home },
    { href: "/catalog", label: "Каталог", icon: LayoutGrid },
    { href: "/calculator", label: "Распил", icon: Calculator },
    { href: "/account", label: "Кабинет", icon: UserRound },
    {
      href: "/cart",
      label: `Корзина${itemCount ? ` ${itemCount}` : ""}`,
      icon: ShoppingBag,
    },
  ];
  return (
    <>
      <div className={s.previewBar}>
        <span>
          <MapPin size={13} /> Бишкек, Кыргызстан
        </span>
        <Link href="/contacts">{companyContacts.hours}</Link>
      </div>
      <header className={s.header}>
        <div className={`${s.container} ${s.headerMain}`}>
          <Link href="/" className={s.wordmark} aria-label="Artisan, главная">
            ARTISAN<span>МАТЕРИАЛЫ ДЛЯ МЕБЕЛИ</span>
          </Link>
          <LiveSearch key={pathname} onNavigate={closeSearch} />
          <div className={s.headerActions}>
            <button
              type="button"
              className={`${s.iconButton} ${s.mobileOnly}`}
              aria-label="Открыть поиск"
              aria-expanded={searchOpen}
              title="Поиск"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search size={23} />
            </button>
            <Link
              className={`${s.iconButton} ${s.desktopOnly}`}
              href="/account/favorites"
              aria-label="Избранное"
              title="Избранное"
            >
              <Heart size={22} />
            </Link>
            <Link
              className={`${s.iconButton} ${s.desktopOnly}`}
              href="/account"
              aria-label="Личный кабинет"
              title="Личный кабинет"
            >
              <UserRound size={22} />
            </Link>
            <Link
              className={s.iconButton}
              href="/cart"
              aria-label={`Корзина, товаров: ${itemCount}`}
              title="Корзина"
            >
              <ShoppingBag size={23} />
              {itemCount > 0 && <b>{itemCount}</b>}
            </Link>
            <button
              type="button"
              className={`${s.iconButton} ${s.mobileOnly}`}
              aria-label="Открыть меню"
              title="Меню"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
        {searchOpen && (
          <LiveSearch
            key={`mobile-${pathname}`}
            mobile
            onNavigate={closeSearch}
          />
        )}
        <nav className={s.nav} aria-label="Основная навигация">
          <div className={s.container}>
            <Link href="/catalog" className={s.catalogNav}>
              <LayoutGrid size={17} /> Каталог
            </Link>
            {featuredCategories.map((category) => (
              <Link key={category.slug} href={`/catalog/${category.slug}`}>
                {category.name}
              </Link>
            ))}
            <Link href="/brands">Бренды</Link>
            <Link href="/calculator">Распил и услуги</Link>
            <a href={`tel:${companyContacts.phoneTel}`} className={s.phone}>
              {companyContacts.phone}
            </a>
          </div>
        </nav>
      </header>
      {pathname !== "/checkout" && (
        <nav
          className={`${s.mobileDock} ${s.liveDock}`}
          aria-label="Мобильная навигация"
        >
          {dock.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (href === "/" ? pathname === "/" : pathname.startsWith(href))
                  ? "page"
                  : undefined
              }
            >
              <Icon size={21} />
              {label}
            </Link>
          ))}
        </nav>
      )}
      <StorefrontDialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Artisan"
      >
        <div className={s.menuLinks}>
          {primaryNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
              <ArrowRight size={18} />
            </Link>
          ))}
          <Link href="/account/favorites" onClick={() => setMenuOpen(false)}>
            Избранное
            <Heart size={18} />
          </Link>
        </div>
      </StorefrontDialog>
    </>
  );
}
