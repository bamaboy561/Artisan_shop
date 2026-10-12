import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Calculator, FileStack, Home, LogOut } from "lucide-react";

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
  },
  account: {
    label: "Личный кабинет",
    title: "Профиль, заказы и текущие статусы",
    description:
      "Клиент видит только то, что нужно для заказа, повторного обращения и контроля статусов.",
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

          <div className="mt-2.5 min-h-0 [scrollbar-width:none] overflow-hidden lg:mt-6 lg:flex-1 lg:overflow-y-auto lg:pr-1 [&::-webkit-scrollbar]:hidden">
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
      <Container className="grid min-w-0 gap-3 overflow-x-clip py-3 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start xl:gap-4 xl:py-6 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="relative min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#111111] p-3 text-white shadow-[0_18px_42px_rgba(17,17,17,0.18)] xl:hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(199,106,63,0.2),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_54%)]" />

          <div className="relative space-y-3">
            <div className="flex min-w-0 items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[8px] tracking-[0.2em] text-white/42 uppercase">
                  {eyebrow}
                </p>
                <h1 className="mt-1 truncate text-[1.25rem] leading-none font-semibold text-white">
                  {title}
                </h1>
              </div>
              <Link
                href="/"
                aria-label="На сайт"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-[#111111] transition hover:bg-[#c65b3a] hover:text-white"
              >
                A
              </Link>
            </div>

            {actions ? <div>{actions}</div> : null}

            <Link
              href="/"
              className="flex h-10 items-center justify-center gap-2 rounded-[16px] border border-white/10 bg-white/[0.06] text-sm font-semibold text-white/82 transition hover:border-white/30 hover:bg-white hover:text-[#111111]"
            >
              <Home className="size-4" strokeWidth={1.9} />
              На сайт
            </Link>

            <DashboardNav items={items} variant={variant} mode="mobile" />
          </div>
        </section>

        <aside className="relative hidden max-w-full min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#111111] p-4 text-white shadow-[0_28px_80px_rgba(17,17,17,0.24)] xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-2rem)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(199,106,63,0.22),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_42%)]" />

          <div className="relative flex h-full min-w-0 flex-col gap-5">
            <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="font-mono text-[10px] tracking-[0.24em] text-white/38 uppercase">
                {eyebrow}
              </p>
              <h1 className="mt-3 max-w-full text-[1.65rem] leading-[1.04] font-semibold break-words text-white 2xl:text-[1.85rem]">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 break-words text-white/58">
                {description}
              </p>
            </div>

            {actions ? <div>{actions}</div> : null}

            <Link
              href="/"
              className="flex h-11 items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.055] text-sm font-semibold text-white/82 transition hover:border-white/30 hover:bg-white hover:text-[#111111]"
            >
              <Home className="size-4" strokeWidth={1.9} />
              На сайт
            </Link>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <DashboardNav items={items} variant={variant} />
            </div>

            <div className="h-px bg-white/8" />
          </div>
        </aside>

        <main
          id="main-content"
          className="min-w-0 space-y-3 overflow-x-clip xl:space-y-4"
        >
          <section className="surface-glow hidden rounded-[24px] border border-[color:var(--line)] bg-white/92 px-5 py-4 shadow-[0_20px_56px_rgba(17,17,17,0.05)] xl:block">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
                  {meta.label}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)] sm:text-[2rem]">
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
