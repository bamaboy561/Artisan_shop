import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CuttingRequestForm } from "@/app/admin/cutting/cutting-request-form";
import { SetupState } from "@/components/admin/setup-state";
import { getButtonClassName } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { getSalesFloorCustomers } from "@/lib/server/sales-floor";

export const dynamic = "force-dynamic";

export default async function NewAdminCuttingPage() {
  if (!hasDatabaseUrl() && !isDemoModeEnabled()) {
    return (
      <SetupState
        title="Создание распила появится после настройки БД"
        description="Для производственной очереди требуется рабочая база заявок."
        steps={[
          "Настройте DATABASE_URL.",
          "Примените Prisma-схему.",
          "Вернитесь в раздел распила.",
        ]}
      />
    );
  }

  await requireAdminSession(
    "/login?next=/admin/cutting/new",
    "/admin/cutting/new",
  );

  const customers = hasDatabaseUrl()
    ? await getSalesFloorCustomers("", 20)
    : [];

  return (
    <div className="space-y-5">
      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading
            title="Новый распил"
            description="Создание производственного заказа. Файлы можно прикрепить сразу или добавить позже."
            titleClassName="text-2xl sm:text-3xl"
            descriptionClassName="text-sm leading-6"
          />
          <Link
            href="/admin/cutting"
            className={getButtonClassName("secondary", "md", "shrink-0")}
          >
            <ArrowLeft className="size-4" />К очереди
          </Link>
        </div>
      </section>

      <CuttingRequestForm customers={customers} />
    </div>
  );
}
