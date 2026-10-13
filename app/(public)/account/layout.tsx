import type { Metadata } from "next";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { DashboardFrame } from "@/components/layout/dashboard-frame";
import { Button } from "@/components/ui/button";
import { verifySession } from "@/lib/auth/dal";
import { noIndexRobots } from "@/lib/seo";
import { accountNavigation } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Личный кабинет",
  robots: noIndexRobots,
};

export default async function AccountLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await verifySession("/login?next=/account");
  const accountName =
    [session.firstName, session.lastName].filter(Boolean).join(" ") ||
    session.email;

  return (
    <DashboardFrame
      eyebrow="Кабинет клиента"
      title="Личный кабинет"
      description="Статусы, баллы, заказы и заявки в одном рабочем экране."
      items={accountNavigation}
      variant="account"
      actions={
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-white p-3 lg:bg-[var(--background)]">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-[var(--foreground)]">
              {accountName}
            </p>
            <p className="truncate text-[13px] text-[var(--muted)]">
              {session.email}
            </p>
          </div>
          <form action={signOutAction} className="shrink-0">
            <Button type="submit" size="sm" variant="secondary">
              Выйти
            </Button>
          </form>
        </div>
      }
    >
      {children}
    </DashboardFrame>
  );
}
