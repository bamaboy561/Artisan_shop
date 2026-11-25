"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  BadgePercent,
  Calculator,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FileStack,
  Factory,
  FolderTree,
  HardDrive,
  Gift,
  Layers3,
  LayoutDashboard,
  LayoutGrid,
  Package2,
  ReceiptText,
  Rocket,
  ShoppingBag,
  Scissors,
  TrendingUp,
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
  "/admin/production/board": LayoutGrid,
  "/admin/production/shift": ClipboardCheck,
  "/admin/production/shifts": ClipboardList,
  "/admin/production/machines": HardDrive,
  "/admin/promotions": BadgePercent,
  "/admin/price-trends": TrendingUp,
  "/admin/calculator": Calculator,
  "/admin/content": FileText,
  "/calculator": Calculator,
  "/account": LayoutDashboard,
  "/account/orders": ReceiptText,
  "/account/requests": FileStack,
  "/account/favorites": BadgePercent,
} as const;

function isItemActive(pathname: string, href: string) {
  if (
    href === "/admin/production" &&
    [
      "/admin/production/board",
      "/admin/production/shift",
      "/admin/production/shifts",
      "/admin/production/machines",
    ].includes(pathname)
  )
    return false;
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
        "group flex h-10 shrink-0 items-center justify-between gap-3 rounded-lg px-3 text-[13px] font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none lg:h-9 lg:w-full",
        active
          ? "bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active-fg)]"
          : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg)]",
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
            active
              ? "bg-[var(--accent)] text-[var(--accent-ink)]"
              : "bg-[var(--sidebar-hover)] text-[var(--sidebar-fg)]",
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
                ? "bg-[var(--foreground)] text-[var(--background)]"
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
      className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--foreground)]",
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
    <>
      <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {items.map((item) => (
          <AdminNavItem key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
      <AdminGroupedNav items={items} pathname={pathname} />
    </>
  );
}

// Меню админки по группам. Группа «Настройки» по умолчанию свёрнута;
// какие группы свёрнуты — запоминается в браузере.
const adminGroups: Array<{
  key: string;
  title: string | null;
  hrefs: string[];
}> = [
  { key: "main", title: null, hrefs: ["/admin", "/admin/launch"] },
  {
    key: "sales",
    title: "Продажи",
    hrefs: [
      "/admin/orders",
      "/admin/requests",
      "/admin/sales-floor",
      "/admin/users",
    ],
  },
  {
    key: "workshop",
    title: "Цех",
    hrefs: [
      "/admin/cutting",
      "/admin/production/board",
      "/admin/production",
      "/admin/production/shift",
      "/admin/production/shifts",
      "/admin/production/machines",
    ],
  },
  {
    key: "catalog",
    title: "Каталог",
    hrefs: [
      "/admin/products",
      "/admin/categories",
      "/admin/brands",
      "/admin/promotions",
      "/admin/price-trends",
    ],
  },
];
const collapsedKey = "artisan-admin-nav-collapsed";
const collapsedEvent = "artisan-admin-nav-collapsed";

function readCollapsed() {
  try {
    return window.localStorage.getItem(collapsedKey);
  } catch {
    return null;
  }
}

function subscribeCollapsed(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(collapsedEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(collapsedEvent, callback);
  };
}

function parseCollapsed(raw: string | null): string[] {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return Array.isArray(value) ? value : ["settings"];
  } catch {
    return ["settings"];
  }
}

function AdminGroupedNav({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  const collapsed = parseCollapsed(
    useSyncExternalStore(subscribeCollapsed, readCollapsed, () => null),
  );

  function toggle(key: string) {
    const next = collapsed.includes(key)
      ? collapsed.filter((item) => item !== key)
      : [...collapsed, key];
    try {
      window.localStorage.setItem(collapsedKey, JSON.stringify(next));
    } catch {
      // Без localStorage меню просто не запомнит выбор.
    }
    window.dispatchEvent(new Event(collapsedEvent));
  }

  const grouped = new Set(adminGroups.flatMap((group) => group.hrefs));
  const groups = [
    ...adminGroups.map((group) => ({
      ...group,
      items: group.hrefs
        .map((href) => items.find((item) => item.href === href))
        .filter((item): item is NavItem => Boolean(item)),
    })),
    {
      key: "settings",
      title: "Настройки",
      hrefs: [],
      items: items.filter((item) => !grouped.has(item.href)),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Разделы админки" className="hidden gap-3 lg:grid">
      {groups.map((group) => {
        const hasActive = group.items.some((item) =>
          isItemActive(pathname, item.href),
        );
        const badge = group.items.reduce(
          (sum, item) => sum + (Number(item.badge) || 0),
          0,
        );
        const open =
          !group.title || hasActive || !collapsed.includes(group.key);

        return (
          <div key={group.key} className="grid gap-0.5">
            {group.title ? (
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={open}
                className="flex h-7 items-center justify-between rounded-md px-3 text-[11.5px] font-semibold text-zinc-500 transition hover:text-[var(--sidebar-fg)]"
              >
                <span>{group.title}</span>
                <span className="flex items-center gap-2">
                  {!open && badge > 0 ? (
                    <span className="rounded-full bg-[var(--sidebar-hover)] px-1.5 text-[10.5px] text-[var(--sidebar-fg)]">
                      {badge}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={cn("size-3.5 transition", !open && "-rotate-90")}
                  />
                </span>
              </button>
            ) : null}
            {open
              ? group.items.map((item) => (
                  <AdminNavItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                  />
                ))
              : null}
          </div>
        );
      })}
    </nav>
  );
}
