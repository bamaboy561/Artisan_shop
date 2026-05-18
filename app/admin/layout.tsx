import type { Metadata } from "next";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { DashboardFrame } from "@/components/layout/dashboard-frame";
import { requireAdminSession } from "@/lib/auth/dal";
import { getAdminNavigationForRole } from "@/lib/auth/roles";
import { noIndexRobots } from "@/lib/seo";
import { adminNavigation } from "@/lib/site-config";
import { getAdminDashboardMetrics } from "@/lib/server/admin-data";

export const metadata: Metadata = {
  title: "Админка",
  robots: noIndexRobots,
};

function formatRoleLabel(roleCode: string) {
  const labels: Record<string, string> = {
    MANAGER: "Менеджер",
    ADMIN: "Администратор",
    SUPER_ADMIN: "Супер-админ",
    CUSTOMER: "Клиент",
  };

  return labels[roleCode] ?? roleCode;
}

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await requireAdminSession("/login?next=/admin");
  const metrics = await getAdminDashboardMetrics().catch(() => null);
  const adminName =
    [session.firstName, session.lastName].filter(Boolean).join(" ") ||
    session.email;
  const adminItems = getAdminNavigationForRole(
    session.roleCode,
    adminNavigation,
  ).map((item) => {
    if (item.href === "/admin/orders" && metrics?.openOrders) {
      return { ...item, badge: String(metrics.openOrders) };
    }

    if (item.href === "/admin/requests" && metrics?.openRequests) {
      return { ...item, badge: String(metrics.openRequests) };
    }

    return item;
  });
  return (
    <DashboardFrame
      eyebrow="Панель управления"
      title="Админка Artisan"
      description="Рабочая среда команды: каталог, входящие заявки, заказы, клиенты и акции."
      items={adminItems}
      variant="admin"
      actions={
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#c65b3a] text-sm font-bold text-white">
              {adminName.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">
                {adminName}
              </span>
              <span className="block truncate text-xs text-white/52">
                {formatRoleLabel(session.roleCode)}
              </span>
            </span>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center rounded-lg border border-white/10 text-sm font-medium text-white/70 transition hover:border-white/30 hover:bg-white/8 hover:text-white"
            >
              Выйти
            </button>
          </form>
        </div>
      }
    >
      {children}
    </DashboardFrame>
  );
}
