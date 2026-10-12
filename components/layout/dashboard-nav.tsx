"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Calculator,
  FileText,
  FileStack,
  Factory,
  FolderTree,
  Gift,
  Layers3,
  LayoutDashboard,
  Package2,
  ReceiptText,
  Rocket,
  ShoppingBag,
  Scissors,
  UserCog,
  Users2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";

type DashboardNavProps = {
  items: NavItem[];
  variant?: "admin" | "account";
  mode?: "sidebar" | "mobile";
};

const iconMap = {
  "/admin": LayoutDashboard,
  "/admin/launch": Rocket,
  "/admin/categories": FolderTree,
  "/admin/brands": Layers3,
  "/admin/products": Package2,
  "/admin/users": Users2,
  "/admin/staff": UserCog,
  "/admin/loyalty": Gift,
  "/admin/orders": ReceiptText,
  "/admin/sales-floor": ShoppingBag,
  "/admin/requests": FileStack,
  "/admin/cutting": Scissors,
  "/admin/production": Factory,
  "/admin/promotions": BadgePercent,
  "/admin/content": FileText,
  "/calculator": Calculator,
  "/account": LayoutDashboard,
  "/account/orders": ReceiptText,
  "/account/requests": FileStack,
  "/account/favorites": BadgePercent,
} as const;

function isItemActive(pathname: string, href: string) {
  return href === "/admin" || href === "/account"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = iconMap[item.href as keyof typeof iconMap] ?? LayoutDashboard;
  const active = isItemActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      title={item.description ?? item.label}
      className={cn(
        "group flex h-10 shrink-0 items-center justify-between gap-3 rounded-lg px-3 text-[13px] font-medium transition focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none lg:w-full",
        active
          ? "bg-[#a8492b] text-white shadow-[0_12px_26px_rgba(168,73,43,0.28)]"
          : "text-white/76 hover:bg-white/[0.075] hover:text-white",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="size-[18px] shrink-0" strokeWidth={1.85} />
        <span className="truncate">{item.label}</span>
      </span>
      {item.badge ? (
        <span
          className={cn(
            "min-w-6 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold",
            active ? "bg-white/18 text-white" : "bg-white/12 text-white/72",
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function AccountNav({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <nav aria-label="Разделы кабинета" className="grid gap-1">
      {items.map((item) => {
        const Icon =
          iconMap[item.href as keyof typeof iconMap] ?? LayoutDashboard;
        const active = isItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.description ?? item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none",
              active
                ? "bg-[var(--foreground)] text-white"
                : "text-[var(--foreground)] hover:bg-[var(--background)]",
            )}
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.9} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AccountMobileNav({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <nav
      aria-label="Разделы кабинета"
      className="-mx-4 flex min-w-0 [scrollbar-width:none] gap-2 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const Icon =
          iconMap[item.href as keyof typeof iconMap] ?? LayoutDashboard;
        const active = isItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.description ?? item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none",
              active
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                : "border-[color:var(--line)] bg-white text-[var(--foreground)]",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.9} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardNav({
  items,
  variant = "account",
  mode = "sidebar",
}: DashboardNavProps) {
  const pathname = usePathname();

  if (variant !== "admin") {
    if (mode === "mobile") {
      return <AccountMobileNav items={items} pathname={pathname} />;
    }

    return <AccountNav items={items} pathname={pathname} />;
  }

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-1 lg:overflow-visible lg:pb-0">
      {items.map((item) => (
        <AdminNavItem key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
