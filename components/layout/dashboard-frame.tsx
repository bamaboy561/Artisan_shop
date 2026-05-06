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
    title: "Управление каталогом, заказами и клиентской логикой.",
    description:
      "Слева остаются рабочие модули, а справа команда быстро переключается между очередями, каталогом и коммерческими сценариями.",
    chips: ["Каталог", "Продажи", "Лояльность"],
  },
  account: {
    label: "Рабочая среда клиента",
    title: "Профиль, история заказов и персональные условия.",
    description:
      "Кабинет остаётся компактным: основные разделы под рукой, а вся активность собрана в одном пространстве без лишних экранов.",
    chips: ["Профиль", "Заказы", "Избранное"],
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
    <div className="min-h-screen">
      <Container className="grid gap-6 py-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:py-8">
        <aside className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#111111] p-6 text-white xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(199,106,63,0.24),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_45%)]" />

          <div className="relative flex h-full flex-col">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase">
                {eyebrow}
              </p>
              <h1 className="font-display mt-4 text-3xl leading-[1.02] text-balance text-white">
                {title}
              </h1>
              <p className="mt-4 text-sm leading-6 text-white/58">
                {description}
              </p>
            </div>

            {actions ? <div className="mt-6">{actions}</div> : null}

            <div className="mt-6 flex-1 overflow-y-auto pr-1">
              <DashboardNav items={items} variant={variant} />
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
              <p className="font-mono text-[10px] tracking-[0.26em] text-white/38 uppercase">
                {meta.label}
              </p>
              <p className="mt-3 text-sm font-semibold text-white">
                {meta.title}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/52">
                {meta.description}
              </p>
            </div>
          </div>
        </aside>

        <main id="main-content" className="space-y-5">
          <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="font-mono text-[10px] tracking-[0.26em] text-[var(--accent)] uppercase">
                  Рабочее пространство
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)] sm:text-[2rem]">
                  {meta.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {meta.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {meta.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="space-y-5">{children}</div>
        </main>
      </Container>
    </div>
  );
}
