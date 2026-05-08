"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Box,
  Calculator,
  FileStack,
  FolderTree,
  Layers3,
  LayoutDashboard,
  Package2,
  ReceiptText,
  Rocket,
  Scissors,
  Settings,
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
  "/admin/orders": ReceiptText,
  "/admin/requests": FileStack,
  "/admin/cutting": Scissors,
  "/admin/promotions": BadgePercent,
  "/calculator": Calculator,
  "/account": LayoutDashboard,
  "/account/orders": ReceiptText,
  "/account/requests": FileStack,
  "/account/favorites": BadgePercent,
} as const;

const adminSecondaryItems = [
  { href: "/admin/products", label: "Склад и остатки", icon: Box },
  { href: "/admin", label: "Отчеты", icon: LayoutDashboard },
  { href: "/admin", label: "Настройки", icon: Settings },
] as const;

function isItemActive(pathname: string, href: string) {
  return href === "/admin" || href === "/account"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavItem({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const Icon = iconMap[item.href as keyof typeof iconMap] ?? LayoutDashboard;
  const active = isItemActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      title={item.description ?? item.label}
      className={cn(
        "group flex h-11 shrink-0 items-center justify-between gap-3 rounded-lg px-3 text-[14px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:w-full",
        active
          ? "bg-[#a8492b] text-white shadow-[0_16px_36px_rgba(168,73,43,0.34)]"
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
    <div className="space-y-2 xl:space-y-2">
      <p className="hidden px-2 font-mono text-[10px] tracking-[0.24em] text-white/34 uppercase xl:block">
        Разделы
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 xl:grid xl:gap-1.5 xl:overflow-visible xl:pb-0">
        {items.map((item) => {
          const Icon =
            iconMap[item.href as keyof typeof iconMap] ?? LayoutDashboard;
          const active = isItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.description ?? item.label}
              className={cn(
                "group flex h-10 shrink-0 items-center justify-between gap-2 rounded-full px-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] xl:h-auto xl:gap-3 xl:rounded-[18px] xl:px-3 xl:py-3",
                active
                  ? "bg-white text-[#111111]"
                  : "text-white/76 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "hidden size-9 shrink-0 items-center justify-center rounded-2xl border xl:inline-flex",
                    active
                      ? "border-black/8 bg-black/[0.05]"
                      : "border-white/10 bg-white/[0.04]",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.9} />
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold uppercase tracking-[0.1em] xl:text-sm xl:normal-case xl:tracking-normal">
                    {item.label}
                  </span>
                  {item.description ? (
                    <span
                      className={cn(
                        "mt-0.5 hidden truncate text-xs xl:block",
                        active ? "text-black/55" : "text-white/42",
                      )}
                    >
                      {item.description}
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
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
    <nav aria-label="Разделы кабинета" className="grid grid-cols-2 gap-2 min-[460px]:grid-cols-4">
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
              "flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border px-3 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              active
                ? "border-white bg-white text-[#111111]"
                : "border-white/10 bg-white/[0.06] text-white/64 hover:border-white/25 hover:bg-white/[0.1] hover:text-white",
            )}
          >
            <Icon className="size-3.5 shrink-0" strokeWidth={1.9} />
            <span className="truncate">{item.label}</span>
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
    <nav className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-1.5 lg:overflow-visible lg:pb-0">
      {items.map((item) => (
        <AdminNavItem key={item.href} item={item} pathname={pathname} />
      ))}

      <div className="my-3 hidden h-px bg-white/8 lg:block" />

      {adminSecondaryItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className="group hidden h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-medium text-white/60 transition hover:bg-white/[0.075] hover:text-white lg:flex"
          >
            <Icon className="size-[18px]" strokeWidth={1.85} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
