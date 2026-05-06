"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  FileStack,
  FolderTree,
  Layers3,
  LayoutDashboard,
  Package2,
  ReceiptText,
  Users2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";

type DashboardNavProps = {
  items: NavItem[];
  variant?: "admin" | "account";
};

const iconMap = {
  "/admin": LayoutDashboard,
  "/admin/categories": FolderTree,
  "/admin/brands": Layers3,
  "/admin/products": Package2,
  "/admin/users": Users2,
  "/admin/orders": ReceiptText,
  "/admin/requests": FileStack,
  "/admin/promotions": BadgePercent,
  "/account": LayoutDashboard,
  "/account/orders": ReceiptText,
  "/account/requests": FileStack,
  "/account/favorites": BadgePercent,
} as const;

const adminGroups = [
  {
    label: "Операции",
    hrefs: ["/admin", "/admin/orders", "/admin/requests"],
  },
  {
    label: "Каталог",
    hrefs: ["/admin/products", "/admin/categories", "/admin/brands"],
  },
  {
    label: "Клиенты",
    hrefs: ["/admin/users", "/admin/promotions"],
  },
] as const;

function isItemActive(pathname: string, href: string) {
  return href === "/admin" || href === "/account"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({
  items,
  variant = "account",
}: DashboardNavProps) {
  const pathname = usePathname();
  const itemsMap = new Map(items.map((item) => [item.href, item]));

  const groupedItems =
    variant === "admin"
      ? adminGroups
          .map((group) => ({
            label: group.label,
            items: group.hrefs
              .map((href) => itemsMap.get(href))
              .filter((item): item is NavItem => Boolean(item)),
          }))
          .filter((group) => group.items.length > 0)
      : [
          {
            label: "Разделы",
            items,
          },
        ];

  return (
    <div className="space-y-5">
      {groupedItems.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="px-2 font-mono text-[10px] tracking-[0.24em] text-white/34 uppercase">
            {group.label}
          </p>

          <div className="grid gap-1.5">
            {group.items.map((item) => {
              const Icon =
                iconMap[item.href as keyof typeof iconMap] ?? LayoutDashboard;
              const active = isItemActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.description ?? item.label}
                  className={cn(
                    "group flex items-center justify-between gap-3 rounded-[18px] px-3 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]",
                    active
                      ? "bg-white text-[#111111] shadow-[0_18px_42px_rgba(255,255,255,0.08)]"
                      : "text-white/76 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
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

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.label}
                      </p>
                      {variant === "account" && item.description ? (
                        <p
                          className={cn(
                            "mt-0.5 truncate text-xs",
                            active ? "text-black/55" : "text-white/42",
                          )}
                        >
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full transition",
                      active
                        ? "bg-[var(--accent)]"
                        : "bg-white/12 group-hover:bg-white/22",
                    )}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
