import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Calculator, FileStack, Home, LogOut } from "lucide-react";

import { Container } from "@/components/ui/container";
import { AdminSearchForm } from "@/components/admin/admin-search-form";
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
  const topLinkClass =
    "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#e3ddd2] bg-white px-4 font-medium transition hover:border-[#1b1c19]";

  return (
    <div className="min-h-screen bg-[#f4f1eb] text-[#1b1c19] lg:grid lg:grid-cols-[256px_minmax(0,1fr)] print:block print:bg-white">
      <aside className="sticky top-0 z-30 bg-[#1f2b25] text-white shadow-[0_8px_24px_rgba(31,43,37,0.18)] lg:h-screen lg:overflow-hidden lg:shadow-none print:hidden">
        <div className="flex flex-col px-3 py-2.5 lg:h-full lg:min-h-0 lg:py-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <Link href="/admin" className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f1eb] text-lg font-black text-[#1f2b25] lg:size-10">
                A
              </span>
              <span className="min-w-0">
                <span className="block text-lg leading-none font-bold">
                  Artisan
                </span>
                <span className="mt-1 block text-xs text-white/60">
                  Панель управления
                </span>
              </span>
            </Link>
            <Link
              href="/"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/15 px-3 text-sm font-medium text-white/85 transition hover:bg-white hover:text-[#1f2b25] lg:hidden"
            >
              <Home className="size-4" strokeWidth={1.85} />
              На сайт
            </Link>
          </div>

          <Link
            href="/"
            className="mt-4 hidden h-10 items-center justify-center gap-2 rounded-full border border-white/15 px-3 text-sm font-medium text-white/85 transition hover:bg-white hover:text-[#1f2b25] lg:inline-flex"
          >
            <Home className="size-4" strokeWidth={1.85} />
            На сайт
          </Link>

          <div className="mt-2.5 min-h-0 overflow-hidden [scrollbar-width:none] lg:mt-6 lg:flex-1 lg:overflow-y-auto lg:pr-1 [&::-webkit-scrollbar]:hidden">
            <DashboardNav items={items} variant="admin" />
          </div>

          <div className="mt-4 hidden border-t border-white/10 pt-4 lg:block">
            {actions ?? (
              <Link
                href="/login"
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white"
              >
                <LogOut className="size-[18px]" strokeWidth={1.8} />
                Выйти
              </Link>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 overflow-x-clip print:overflow-visible">
        <header className="sticky top-0 z-20 hidden border-b border-[#e3ddd2] bg-[#f4f1eb]/90 backdrop-blur-xl lg:block print:hidden">
          <nav className="flex min-h-16 items-center justify-end gap-2 px-6 text-sm xl:px-7">
            <AdminSearchForm className="mr-auto w-full max-w-sm" />
            <Link href="/calculator" className={topLinkClass}>
              <Calculator className="size-4" strokeWidth={1.8} />
              Калькулятор
            </Link>
            <Link href="/admin/requests" className={topLinkClass}>
              <FileStack className="size-4" strokeWidth={1.8} />
              Запросы
              {requestBadge !== "0" ? (
                <span className="rounded-full bg-[#c4532b] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {requestBadge}
                </span>
              ) : null}
            </Link>
            <Link href="/admin" className={topLinkClass}>
              <Bell className="size-4" strokeWidth={1.8} />
              Уведомления
              {notificationBadge !== "0" ? (
                <span className="rounded-full bg-[#c4532b] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {notificationBadge}
                </span>
              ) : null}
            </Link>
          </nav>
        </header>

        <main
          id="main-content"
          className="min-w-0 space-y-4 overflow-x-clip px-3 py-4 sm:space-y-5 sm:px-6 sm:py-5 xl:px-7 xl:py-6 print:space-y-0 print:overflow-visible print:p-0"
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
