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
      description="Профиль, скидки, баллы, заказы и заявки в одном разделе."
      items={accountNavigation}
      variant="account"
      actions={
        <div className="space-y-3">
          <div className="hidden rounded-[24px] border border-white/10 bg-white/[0.05] p-4 xl:block">
            <p className="font-mono text-[10px] tracking-[0.24em] text-white/40 uppercase">
              Профиль
            </p>
            <p className="mt-3 text-sm font-semibold text-white">
              {accountName}
            </p>
            <p className="mt-1 truncate text-xs text-white/52">
              {session.email}
            </p>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.055] p-3 xl:hidden">
            <div className="min-w-0">
              <p className="font-mono text-[9px] tracking-[0.22em] text-white/36 uppercase">
                Профиль
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {accountName}
              </p>
              <p className="truncate text-xs text-white/50">{session.email}</p>
            </div>

            <form action={signOutAction} className="shrink-0">
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                className="h-9 border-white/16 px-3 text-[0.62rem] tracking-[0.16em] text-white hover:border-white hover:bg-white hover:text-[#111111]"
              >
                Выйти
              </Button>
            </form>
          </div>

          <form action={signOutAction} className="hidden xl:block">
            <Button
              type="submit"
              variant="secondary"
              className="w-full border-white/16 text-white hover:border-white hover:bg-white hover:text-[#111111]"
            >
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
