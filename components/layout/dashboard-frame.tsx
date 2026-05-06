import type { ReactNode } from "react";

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
    label: "Операционный контур",
    title: "Каталог, заявки и клиенты в одном рабочем окне.",
    description:
      "Админка должна помогать команде вести поток, а не отвлекать лишними экранами и декоративными блоками.",
    chips: ["Каталог", "Заявки", "Заказы", "Лояльность"],
  },
  account: {
    label: "Личный кабинет",
    title: "Профиль, история и текущие статусы без перегруза.",
    description:
      "Клиент видит только то, что нужно для заказа, повторного обращения и контроля статусов.",
    chips: ["Профиль", "Заказы", "Заявки", "Избранное"],
  },
} as const;

export function DashboardFrame({
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f2ec_0%,#f2ede6_100%)]">
      <Container className="grid gap-4 py-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start xl:py-6">
        <aside className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#111111] p-4 text-white shadow-[0_28px_80px_rgba(17,17,17,0.24)] xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
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

        <main id="main-content" className="space-y-4">
          <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/92 px-5 py-4 shadow-[0_20px_56px_rgba(17,17,17,0.05)]">
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

          <div className="space-y-4 [&_article.surface-glow]:shadow-[0_20px_56px_rgba(17,17,17,0.05)] [&_section.surface-glow]:shadow-[0_20px_56px_rgba(17,17,17,0.05)]">
            {children}
          </div>
        </main>
      </Container>
    </div>
  );
}
