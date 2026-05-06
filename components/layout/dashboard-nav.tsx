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
    label: "Рабочая зона",
    hrefs: ["/admin"],
  },
  {
    label: "Каталог",
    hrefs: ["/admin/categories", "/admin/brands", "/admin/products"],
  },
  {
    label: "Продажи",
    hrefs: ["/admin/orders", "/admin/requests", "/admin/promotions"],
  },
  {
    label: "Клиенты",
    hrefs: ["/admin/users"],
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
        <div key={group.label} className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.26em] text-white/38 uppercase">
            {group.label}
          </p>

          <div className="grid gap-2">
            {group.items.map((item) => {
              const Icon =
                iconMap[item.href as keyof typeof iconMap] ?? LayoutDashboard;
              const active = isItemActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-2xl border px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]",
                    active
                      ? "border-white/16 bg-white text-[#111111] shadow-[0_18px_40px_rgba(255,255,255,0.12)]"
                      : "border-white/10 bg-white/[0.04] text-white/82 hover:border-white/18 hover:bg-white/[0.07]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border",
                        active
                          ? "border-black/8 bg-black/[0.06]"
                          : "border-white/10 bg-white/[0.04]",
                      )}
                    >
                      <Icon className="size-4" strokeWidth={1.9} />
                    </span>

                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span
                          className={cn(
                            "mt-1 block text-xs leading-5",
                            active ? "text-black/62" : "text-white/50",
                          )}
                        >
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
