import { SetupState } from "@/components/admin/setup-state";
import { ProductionQueueView } from "@/features/production/queue-view";
import { parseProductionFilters } from "@/features/production/queue";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  isProductionOperator,
  productionStationDefinitions,
} from "@/lib/auth/roles";
import { hasDatabaseUrl, isDemoModeEnabled } from "@/lib/db";
import { getProductionQueue } from "@/lib/server/production-workspace";
import Link from "next/link";
import { productionDateKey } from "@/features/production/queue";
import { getMyShift } from "@/lib/server/production-shifts";
import shiftStyles from "@/features/production/shift.module.css";

export const dynamic = "force-dynamic";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession(
    "/login?next=/admin/production",
    "/admin/production",
  );
  if (!hasDatabaseUrl() && !isDemoModeEnabled())
    return (
      <SetupState
        title="Производственная очередь появится после подключения БД"
        description="Для этапов, QR и журнала действий нужна рабочая база заявок."
        steps={[
          "Настройте DATABASE_URL.",
          "Примените Prisma-схему.",
          "Откройте рабочее место производства повторно.",
        ]}
      />
    );
  const operator = isProductionOperator(session.roleCode);
  const station = operator ? session.productionStation : null;
  if (operator && !station)
    return (
      <SetupState
        title="Для аккаунта не выбрана станция"
        description="Администратор должен назначить этому оператору распил, кромку или присадку в разделе сотрудников."
        steps={[
          "Откройте Сотрудники под аккаунтом администратора.",
          "Выберите станцию для этого оператора.",
          "Сохраните роль и войдите снова.",
        ]}
      />
    );
  const params = await searchParams;
  const [queue, shift] = await Promise.all([
    getProductionQueue(parseProductionFilters(params, station)),
    operator
      ? getMyShift(session, productionDateKey(new Date())).catch(() => null)
      : Promise.resolve(null),
  ]);
  // Оператору напоминаем принять смену до работы на станке.
  const shiftBanner =
    operator && !shift?.startedAt && !shift?.absence ? (
      <p className={shiftStyles.warn}>
        Смена не принята.{" "}
        <Link href="/admin/production/shift">
          <strong>Принять смену →</strong>
        </Link>
      </p>
    ) : operator && shift?.startedAt && !shift.endedAt ? (
      <p className={shiftStyles.hint} style={{ marginBottom: 8 }}>
        В конце дня не забудьте{" "}
        <Link href="/admin/production/shift">сдать смену</Link>.
      </p>
    ) : null;
  return (
    <>
      {shiftBanner}
      <ProductionQueueView
        queue={queue}
        operator={operator}
        title={
          station
            ? productionStationDefinitions[station].label
            : "Очередь производства"
        }
        notice={
          params.notice === "request-missing"
            ? "Производственная заявка не найдена."
            : undefined
        }
      />
    </>
  );
}
