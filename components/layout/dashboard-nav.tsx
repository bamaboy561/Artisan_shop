"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Calculator,
  FileStack,
  FolderTree,
  Layers3,
  LayoutDashboard,
  Package2,
  ReceiptText,
  Rocket,
  Scissors,
  ShoppingBag,
  ShieldCheck,
  UserRound,
  Users2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";

type DashboardNavProps = {
  items: NavItem[];
  variant?: "admin" | "account";
  mode?: "sidebar" | "mobile";
  onItemClick?: () => void;
};

const iconMap = {
  "/admin": LayoutDashboard,
  "/admin/launch": Rocket,
  "/admin/my": UserRound,
  "/admin/categories": FolderTree,
  "/admin/brands": Layers3,
  "/admin/products": Package2,
  "/admin/users": Users2,
  "/admin/staff": ShieldCheck,
  "/admin/orders": ReceiptText,
  "/admin/sales": ShoppingBag,
  "/admin/requests": FileStack,
  "/admin/cutting": Scissors,
  "/admin/promotions": BadgePercent,
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

function AdminNavItem({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const Icon = iconMap[item.href as keyof typeof iconMap] ?? LayoutDashboard;
  const active = isItemActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      title={item.description ?? item.label}
      onClick={onClick}
      className={cn(
        "group flex h-10 w-full shrink-0 items-center justify-between gap-3 rounded-lg px-3 text-[13px] font-medium transition focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
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
    <nav aria-label="Разделы кабинета" className="space-y-2">
      <p className="px-2 font-mono text-[10px] tracking-[0.24em] text-white/34 uppercase">
        Разделы
      </p>
      <div className="grid gap-1.5">
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
                "group flex min-w-0 items-center gap-3 rounded-[18px] px-3 py-3 transition focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] focus-visible:outline-none",
                active
                  ? "bg-white text-[#111111]"
                  : "text-white/76 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border",
                    active
                      ? "border-black/8 bg-black/[0.05]"
                      : "border-white/10 bg-white/[0.04]",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.9} />
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {item.label}
                  </span>
                  {item.description ? (
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-xs",
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
      className="grid min-w-0 grid-cols-4 gap-1.5"
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
              "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] border px-1.5 text-center text-[9px] font-bold tracking-[0.08em] uppercase transition focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none",
              active
                ? "border-white bg-white text-[#111111] shadow-[0_8px_24px_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-white/[0.055] text-white/62 hover:border-white/25 hover:bg-white/[0.1] hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.9} />
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
  onItemClick,
}: DashboardNavProps) {
  const pathname = usePathname();

  if (variant !== "admin") {
    if (mode === "mobile") {
      return <AccountMobileNav items={items} pathname={pathname} />;
    }

    return <AccountNav items={items} pathname={pathname} />;
  }

  return (
    <nav className="grid gap-1">
      {items.map((item) => (
        <AdminNavItem
          key={item.href}
          item={item}
          pathname={pathname}
          onClick={onItemClick}
        />
      ))}
    </nav>
  );
}
