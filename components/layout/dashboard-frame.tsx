import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Calculator,
  FileStack,
  Home,
  LogOut,
  Menu,
  Search,
} from "lucide-react";

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

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#22201e] print:block print:bg-white lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="relative z-30 bg-[#111210] text-white print:hidden lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(197,89,53,0.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0))]" />
        <div className="relative flex flex-col px-3 py-3 lg:h-full lg:min-h-0 lg:py-4">
          <Link href="/admin" className="flex items-center gap-3 px-1">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white text-[20px] font-black text-[#151513] shadow-[0_10px_30px_rgba(255,255,255,0.08)]">
              A
            </span>
            <span>
              <span className="block text-xl leading-none font-semibold">
                Artisan
              </span>
              <span className="mt-1 block text-xs text-white/62">
                Панель управления
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm font-medium text-white/82 transition hover:border-white/30 hover:bg-white hover:text-[#111210]"
          >
            <Home className="size-4" strokeWidth={1.85} />
            На сайт
          </Link>

          <div className="mt-4 min-h-0 overflow-hidden [scrollbar-width:none] lg:mt-6 lg:flex-1 lg:overflow-y-auto lg:pr-1 [&::-webkit-scrollbar]:hidden">
            <DashboardNav items={items} variant="admin" />
          </div>

          <div className="mt-4 hidden border-t border-white/8 pt-4 lg:block">
            {actions ?? (
              <Link
                href="/login"
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-white/70 hover:bg-white/[0.075] hover:text-white"
              >
                <LogOut className="size-[18px]" strokeWidth={1.8} />
                Выйти
              </Link>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 overflow-x-clip print:overflow-visible">
        <header className="sticky top-0 z-20 border-b border-[#e6e2dc] bg-white/88 backdrop-blur-xl print:hidden">
          <div className="flex min-h-[78px] flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:px-7">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#e6e2dc] bg-white text-[#2b2a28] shadow-sm"
                aria-label="Открыть меню"
              >
                <Menu className="size-5" strokeWidth={1.75} />
              </button>

              <div className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#e6e2dc] bg-white px-4 text-sm text-[#77736c] shadow-sm xl:max-w-[620px]">
                <Search className="size-5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">
                  Поиск по заказам, клиентам, материалам...
                </span>
                <span className="ml-auto hidden rounded-md border border-[#e6e2dc] px-2 py-0.5 text-xs text-[#8a857d] sm:inline-flex">
                  Ctrl K
                </span>
              </div>
            </div>

            <nav className="flex min-w-0 items-center gap-2 overflow-x-auto text-sm text-[#2b2a28]">
              <Link
                href="/"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#e6e2dc] bg-white px-3 font-medium transition hover:border-[#c65b3a] hover:text-[#c65b3a]"
              >
                <Home className="size-4" strokeWidth={1.8} />
                На сайт
              </Link>
              <Link
                href="/calculator"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 transition hover:bg-[#f4f1ed]"
              >
                <Calculator className="size-4" strokeWidth={1.8} />
                Калькулятор
              </Link>
              <Link
                href="/admin/requests"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 transition hover:bg-[#f4f1ed]"
              >
                <FileStack className="size-4" strokeWidth={1.8} />
                Запросы
                {requestBadge !== "0" ? (
                  <span className="rounded-full bg-[#c65b3a] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {requestBadge}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/admin"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 transition hover:bg-[#f4f1ed]"
              >
                <Bell className="size-4" strokeWidth={1.8} />
                Уведомления
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
          className="min-w-0 space-y-5 overflow-x-clip px-4 py-5 print:space-y-0 print:overflow-visible print:p-0 sm:px-6 xl:px-7 xl:py-6"
        >
          <div className="sr-only">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function AccountFrame({
  title,
  description,
  items,
  actions,
  variant = "account",
  children,
}: DashboardFrameProps) {
  return (
    <Container className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 py-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:py-8">
      <div className="sr-only">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="space-y-3 lg:hidden">
        {actions}
        <DashboardNav items={items} variant={variant} mode="mobile" />
      </div>

      <aside className="hidden min-w-0 space-y-3 rounded-[20px] bg-white p-3 lg:sticky lg:top-4 lg:block">
        {actions}
        <DashboardNav items={items} variant={variant} />
      </aside>

      <div className="min-w-0 space-y-4">{children}</div>
    </Container>
  );
}

export function DashboardFrame(props: DashboardFrameProps) {
  if (props.variant === "admin") {
    return <AdminFrame {...props} />;
  }

  return <AccountFrame {...props} />;
}
