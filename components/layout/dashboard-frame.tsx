import type { ReactNode } from "react";
import Link from "next/link";
import { Calculator, FileStack, Home, LogOut } from "lucide-react";

import { ArtisanLogo } from "@/components/brand/artisan-logo";
import { Container } from "@/components/ui/container";
import {
  CommandPalette,
  CommandTrigger,
} from "@/components/admin/command-palette";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import type { NavItem } from "@/types/navigation";

type DashboardFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: NavItem[];
  actions?: ReactNode;
  variant?: "admin" | "account";
  // Окно Ctrl+K ищет клиентов и заказы только для менеджеров и админов.
  canSearch?: boolean;
  children: ReactNode;
};

function AdminFrame({
  title,
  description,
  items,
  actions,
  canSearch = false,
  children,
}: DashboardFrameProps) {
  const requestBadge =
    items.find((item) => item.href === "/admin/requests")?.badge ?? "0";
  const topLinkClass =
    "inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--line)] bg-[var(--surface-strong)] px-3.5 font-medium transition hover:border-[color:var(--line-strong)]";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] lg:grid lg:grid-cols-[256px_minmax(0,1fr)] print:block print:bg-[var(--surface-strong)]">
      <aside className="sticky top-0 z-30 border-b border-[color:var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] lg:h-screen lg:overflow-hidden lg:border-r lg:border-b-0 lg:shadow-none print:hidden">
        <div className="flex flex-col px-3 py-2.5 lg:h-full lg:min-h-0 lg:py-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <Link href="/admin" className="flex min-w-0 items-center gap-3">
              <span className="min-w-0">
                <ArtisanLogo
                  variant="compact"
                  className="block h-6 w-auto lg:h-7"
                  title="Artisan"
                />
                <span className="mt-1 block text-xs text-[var(--sidebar-muted)]">
                  Панель управления
                </span>
              </span>
            </Link>
            <Link
              href="/"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--sidebar-border)] px-3 text-sm font-medium text-[var(--sidebar-fg)] transition hover:bg-[var(--sidebar-hover)] lg:hidden"
            >
              <Home className="size-4" strokeWidth={1.85} />
              На сайт
            </Link>
          </div>

          <CommandTrigger
            variant="dark"
            className="mt-4 hidden w-full lg:flex"
          />

          <div className="mt-2.5 min-h-0 overflow-hidden [scrollbar-width:none] lg:mt-4 lg:flex-1 lg:overflow-y-auto lg:pr-1 [&::-webkit-scrollbar]:hidden">
            <DashboardNav items={items} variant="admin" />
          </div>

          <div className="mt-4 hidden border-t border-[color:var(--sidebar-border)] pt-4 lg:block">
            {actions ?? (
              <Link
                href="/login"
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg)]"
              >
                <LogOut className="size-[18px]" strokeWidth={1.8} />
                Выйти
              </Link>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 overflow-x-clip print:overflow-visible">
        <header className="sticky top-0 z-20 hidden border-b border-[color:var(--line)] bg-[var(--background)]/85 backdrop-blur-xl lg:block print:hidden">
          <nav className="flex min-h-16 items-center justify-end gap-2 px-6 text-sm xl:px-7">
            <CommandTrigger className="mr-auto w-full max-w-sm" />
            <Link href="/calculator" className={topLinkClass}>
              <Calculator className="size-4" strokeWidth={1.8} />
              Калькулятор
            </Link>
            <Link href="/admin/requests" className={topLinkClass}>
              <FileStack className="size-4" strokeWidth={1.8} />
              Запросы
              {requestBadge !== "0" ? (
                <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent-ink)]">
                  {requestBadge}
                </span>
              ) : null}
            </Link>
            <Link href="/" className={topLinkClass}>
              <Home className="size-4" strokeWidth={1.8} />
              На сайт
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
      <CommandPalette items={items} canSearch={canSearch} />
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

      <aside className="hidden min-w-0 space-y-3 rounded-[20px] bg-[var(--surface-strong)] p-3 lg:sticky lg:top-4 lg:block">
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
