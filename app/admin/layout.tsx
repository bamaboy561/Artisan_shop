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
      description="Операционный слой сайта: каталог, бренды, заявки, заказы, клиенты, скидки и лояльность в едином рабочем контуре."
      items={adminNavigation}
      variant="admin"
      actions={
        <div className="space-y-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
            <p className="font-mono text-[10px] tracking-[0.24em] text-white/40 uppercase">
              Смена
            </p>
            <p className="mt-3 text-sm font-semibold text-white">
              {adminName}
            </p>
            <p className="mt-1 text-xs text-white/52">{session.email}</p>
            <div className="mt-3 inline-flex rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-white/62 uppercase">
              {formatRoleLabel(session.roleCode)}
            </div>
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
