import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { DashboardFrame } from "@/components/layout/dashboard-frame";
import { Button } from "@/components/ui/button";
import { requireAdminSession } from "@/lib/auth/dal";
import { adminNavigation } from "@/lib/site-config";

function formatRoleLabel(roleCode: string) {
  return roleCode
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await requireAdminSession("/login?next=/admin");
  const adminName =
    [session.firstName, session.lastName].filter(Boolean).join(" ") ||
    session.email;

  return (
    <DashboardFrame
      eyebrow="Панель управления"
      title="Админка Artisan"
      description="Рабочая среда команды: каталог, входящие заявки, заказы, клиенты и акции."
      items={adminNavigation}
      variant="admin"
      actions={
        <div className="space-y-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-white/34 uppercase">
              Смена
            </p>
            <p className="mt-3 text-sm font-semibold text-white">
              {adminName}
            </p>
            <p className="mt-1 text-xs text-white/52">{session.email}</p>

            <div className="mt-4 flex items-center justify-between rounded-[18px] border border-white/10 bg-black/20 px-3 py-2">
              <span className="font-mono text-[10px] tracking-[0.16em] text-white/34 uppercase">
                Роль
              </span>
              <span className="text-xs font-semibold text-white/72">
                {formatRoleLabel(session.roleCode)}
              </span>
            </div>
          </div>

          <form action={signOutAction}>
            <Button
              type="submit"
              variant="secondary"
              className="w-full border-white/14 text-white hover:border-white hover:bg-white hover:text-[#111111]"
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
