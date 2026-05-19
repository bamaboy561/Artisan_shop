import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Calculator, FileStack, LogOut, Search } from "lucide-react";

import {
  AdminSidebarPanel,
  AdminSidebarProvider,
  AdminSidebarTrigger,
} from "@/components/layout/admin-sidebar";
import { Container } from "@/components/ui/container";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import type { NavItem } from "@/types/navigation";

type DashboardFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: NavItem[];
  actions?: ReactNode;
  variant?: "admin" | "account";
  children: ReactNode;
};

const variantMeta = {
  admin: {
    label: "Панель управления",
    title: "Рабочий центр Artisan",
    description: "Заказы, запросы, материалы и клиенты в одном интерфейсе.",
    chips: ["Каталог", "Заявки", "Заказы", "Клиенты"],
  },
  account: {
    label: "Личный кабинет",
    title: "Профиль, заказы и текущие статусы",
    description:
      "Клиент видит только то, что нужно для заказа, повторного обращения и контроля статусов.",
    chips: ["Профиль", "Заказы", "Заявки", "Избранное"],
  },
} as const;

function AdminFrame({
  title,
  description,
  items,
  actions,
  children,
}: DashboardFrameProps) {
  const requestBadge =
    items.find((item) => item.href === "/admin/requests")?.badge ?? "0";
  const notificationBadge = requestBadge;

  const sidebarActions =
    actions ?? (
      <Link
        href="/login"
        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-white/70 hover:bg-white/[0.075] hover:text-white"
      >
        <LogOut className="size-[18px]" strokeWidth={1.8} />
        Выйти
      </Link>
    );

  return (
    <AdminSidebarProvider>
      <div className="min-h-screen bg-[#f7f7f5] text-[#22201e] xl:grid xl:grid-cols-[286px_minmax(0,1fr)]">
        <AdminSidebarPanel items={items} actions={sidebarActions} />
        <div className="min-w-0 overflow-x-clip">
        <header className="sticky top-0 z-20 border-b border-[#e6e2dc] bg-white/88 backdrop-blur-xl">
          <div className="flex min-h-[64px] items-center gap-2 px-3 py-2.5 sm:min-h-[78px] sm:gap-3 sm:px-6 sm:py-3 xl:gap-4 xl:px-7">
            <AdminSidebarTrigger />

            <div className="hidden h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#e6e2dc] bg-white px-4 text-sm text-[#77736c] shadow-sm sm:flex xl:max-w-[620px]">
              <Search className="size-5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">
                Поиск по заказам, клиентам, материалам...
              </span>
              <span className="ml-auto hidden rounded-md border border-[#e6e2dc] px-2 py-0.5 text-xs text-[#8a857d] xl:inline-flex">
                ⌘K
              </span>
            </div>

            <nav className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto text-sm text-[#2b2a28] sm:gap-2">
              <Link
                href="/calculator"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-2 transition hover:bg-[#f4f1ed] sm:px-3"
                aria-label="Калькулятор"
              >
                <Calculator className="size-4" strokeWidth={1.8} />
                <span className="hidden xl:inline">Калькулятор</span>
              </Link>
              <Link
                href="/admin/requests"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-2 transition hover:bg-[#f4f1ed] sm:px-3"
                aria-label="Запросы"
              >
                <FileStack className="size-4" strokeWidth={1.8} />
                <span className="hidden xl:inline">Запросы</span>
                {requestBadge !== "0" ? (
                  <span className="rounded-full bg-[#c65b3a] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {requestBadge}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/admin"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-2 transition hover:bg-[#f4f1ed] sm:px-3"
                aria-label="Уведомления"
              >
                <Bell className="size-4" strokeWidth={1.8} />
                <span className="hidden xl:inline">Уведомления</span>
                {notificationBadge !== "0" ? (
                  <span className="rounded-full bg-[#c65b3a] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {notificationBadge}
                  </span>
                ) : null}
              </Link>
            </nav>
          </div>
        </header>

        <main
          id="main-content"
          className="min-w-0 space-y-4 overflow-x-clip px-3 py-4 sm:space-y-5 sm:px-6 sm:py-5 xl:px-7 xl:py-6"
        >
          <div className="sr-only">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </main>
        </div>
      </div>
    </AdminSidebarProvider>
  );
}

function AccountFrame({
  eyebrow,
  title,
  description,
  items,
  actions,
  variant = "account",
  children,
}: DashboardFrameProps) {
  const meta = variantMeta[variant];

  return (
    <div className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#f6f2ec_0%,#f2ede6_100%)]">
      <Container className="grid min-w-0 gap-3 py-3 sm:gap-4 sm:py-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start xl:py-6">
        <section className="relative min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#111111] p-3 text-white shadow-[0_18px_48px_rgba(17,17,17,0.2)] sm:p-4 xl:hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(199,106,63,0.22),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_48%)]" />

          <div className="relative space-y-3">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.045] p-3.5">
              <p className="font-mono text-[9px] tracking-[0.22em] text-white/42 uppercase">
                {eyebrow}
              </p>
              <h1 className="mt-2 text-[1.65rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                {title}
              </h1>
              <p className="mt-2 text-xs leading-5 text-white/55">
                {description}
              </p>
            </div>

            {actions ? <div>{actions}</div> : null}
            <DashboardNav items={items} variant={variant} mode="mobile" />
          </div>
        </section>

        <aside className="relative hidden min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#111111] p-4 text-white shadow-[0_28px_80px_rgba(17,17,17,0.24)] xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-2rem)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(199,106,63,0.22),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_42%)]" />

          <div className="relative flex h-full flex-col gap-5">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="font-mono text-[10px] tracking-[0.24em] text-white/38 uppercase">
                {eyebrow}
              </p>
              <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.02] text-balance text-white">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/58">
                {description}
              </p>
            </div>

            {actions ? <div>{actions}</div> : null}

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <DashboardNav items={items} variant={variant} />
            </div>

            <div className="flex flex-wrap gap-2">
              {meta.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-white/48 uppercase"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <main id="main-content" className="min-w-0 space-y-4 overflow-x-clip">
          <section className="surface-glow hidden rounded-[24px] border border-[color:var(--line)] bg-white/92 px-5 py-4 shadow-[0_20px_56px_rgba(17,17,17,0.05)] xl:block">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                  {meta.label}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-[2rem]">
                  {meta.title}
                </h2>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {meta.description}
              </p>
            </div>
          </section>

          <div className="space-y-4">{children}</div>
        </main>
      </Container>
    </div>
  );
}

export function DashboardFrame(props: DashboardFrameProps) {
  if (props.variant === "admin") {
    return <AdminFrame {...props} />;
  }

  return <AccountFrame {...props} />;
}
