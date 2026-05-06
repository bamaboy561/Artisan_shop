import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { DashboardFrame } from "@/components/layout/dashboard-frame";
import { Button } from "@/components/ui/button";
import { verifySession } from "@/lib/auth/dal";
import { accountNavigation } from "@/lib/site-config";

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
      description="Профиль клиента, персональная скидка, баллы, история заказов, заявки и сохранённые позиции в одном рабочем разделе."
      items={accountNavigation}
      variant="account"
      actions={
        <div className="space-y-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
            <p className="font-mono text-[10px] tracking-[0.24em] text-white/40 uppercase">
              Профиль
            </p>
            <p className="mt-3 text-sm font-semibold text-white">
              {accountName}
            </p>
            <p className="mt-1 text-xs text-white/52">{session.email}</p>
          </div>

          <form action={signOutAction}>
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
