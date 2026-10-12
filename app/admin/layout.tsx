import type { Metadata } from "next";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { DashboardFrame } from "@/components/layout/dashboard-frame";
import { ProductionFrame } from "@/features/production/frame";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  canAccessAdminPath,
  isCuttingManager,
  isProductionManager,
  isProductionOperator,
  productionStationDefinitions,
  roleDefinitions,
} from "@/lib/auth/roles";
import { noIndexRobots } from "@/lib/seo";
import { adminNavigation } from "@/lib/site-config";
import { getAdminDashboardMetrics } from "@/lib/server/admin-data";

export const metadata: Metadata = {
  title: "Админка",
  robots: noIndexRobots,
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await requireAdminSession("/login?next=/admin");
  const cuttingManager = isCuttingManager(session.roleCode);
  const productionManager = isProductionManager(session.roleCode);
  const productionOperator = isProductionOperator(session.roleCode);
  const productionWorkspace =
    cuttingManager || productionManager || productionOperator;
  const metrics = productionWorkspace
    ? null
    : await getAdminDashboardMetrics().catch(() => null);
  const adminName =
    [session.firstName, session.lastName].filter(Boolean).join(" ") ||
    session.email;
  const adminItems = adminNavigation
    .filter((item) => canAccessAdminPath(session.roleCode, item.href))
    .map((item) => {
      if (item.href === "/admin/orders" && metrics?.openOrders) {
        return { ...item, badge: String(metrics.openOrders) };
      }

      if (item.href === "/admin/requests" && metrics?.openRequests) {
        return { ...item, badge: String(metrics.openRequests) };
      }

      return item;
    });
  const workspaceTitle = cuttingManager
    ? "Рабочее место кроя"
    : productionManager
      ? "Управление производством"
      : productionOperator && session.productionStation
        ? productionStationDefinitions[session.productionStation].label
        : productionOperator
          ? "Рабочее место станции"
          : "Админка Artisan";
  if (productionWorkspace) {
    return (
      <ProductionFrame
        title={workspaceTitle}
        name={adminName}
        role={roleDefinitions[session.roleCode].label}
        items={adminItems}
      >
        {children}
      </ProductionFrame>
    );
  }
  return (
    <DashboardFrame
      eyebrow={productionWorkspace ? "Производство" : "Панель управления"}
      title={workspaceTitle}
      description={
        productionWorkspace
          ? "Очередь, QR маршрутных листов, этапы производства и готовность к выдаче."
          : "Рабочая среда команды: каталог, входящие заявки, заказы, клиенты и акции."
      }
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
                {roleDefinitions[session.roleCode].label}
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
