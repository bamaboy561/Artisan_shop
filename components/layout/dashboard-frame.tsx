import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Calculator,
  FileStack,
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

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#22201e] lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="relative z-30 bg-[#111210] text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(197,89,53,0.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0))]" />
        <div className="relative flex flex-col px-3 py-3 lg:h-full lg:min-h-0 lg:py-4">
          <Link href="/admin" className="flex items-center gap-3 px-1">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white text-[20px] font-black text-[#151513] shadow-[0_10px_30px_rgba(255,255,255,0.08)]">
              A
            </span>
            <span>
              <span className="block text-xl font-semibold leading-none">
                Artisan
              </span>
              <span className="mt-1 block text-xs text-white/62">
                Панель управления
              </span>
            </span>
          </Link>

          <div className="mt-4 min-h-0 overflow-hidden lg:mt-6 lg:flex-1 lg:overflow-y-auto lg:pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

      <div className="min-w-0 overflow-x-clip">
        <header className="sticky top-0 z-20 border-b border-[#e6e2dc] bg-white/88 backdrop-blur-xl">
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
                  ⌘K
                </span>
              </div>
            </div>

            <nav className="flex min-w-0 items-center gap-2 overflow-x-auto text-sm text-[#2b2a28]">
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
          className="min-w-0 space-y-5 overflow-x-clip px-4 py-5 sm:px-6 xl:px-7 xl:py-6"
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
                <h1 className="mt-1 truncate text-[1.25rem] font-semibold leading-none tracking-[-0.035em] text-white">
                  {title}
                </h1>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-[#111111]">
                A
              </span>
            </div>

            {actions ? <div>{actions}</div> : null}

            <DashboardNav items={items} variant={variant} mode="mobile" />
          </div>
        </section>

        <aside className="relative hidden min-w-0 max-w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#111111] p-4 text-white shadow-[0_28px_80px_rgba(17,17,17,0.24)] xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-2rem)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(199,106,63,0.22),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_42%)]" />

          <div className="relative flex h-full min-w-0 flex-col gap-5">
            <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="font-mono text-[10px] tracking-[0.24em] text-white/38 uppercase">
                {eyebrow}
              </p>
              <h1 className="mt-3 max-w-full text-[1.65rem] font-semibold leading-[1.04] tracking-[-0.035em] break-words text-white 2xl:text-[1.85rem]">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 break-words text-white/58">
                {description}
              </p>
            </div>

            {actions ? <div>{actions}</div> : null}

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <DashboardNav items={items} variant={variant} />
            </div>

            <div className="h-px bg-white/8" />
          </div>
        </aside>

        <main id="main-content" className="min-w-0 space-y-3 overflow-x-clip xl:space-y-4">
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
