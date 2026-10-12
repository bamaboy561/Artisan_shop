import Link from "next/link";
import { RoleCode } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { getCuttingPrice } from "@/lib/server/cutting-pricing";
import { saveCuttingPriceAction } from "./actions";
import { Input } from "@/components/ui/input";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";

export default async function CuttingPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireAdminSession("/login", "/admin/cutting/pricing");
  const price = await getCuttingPrice();
  const query = await searchParams;
  const canEdit =
    session.roleCode === RoleCode.ADMIN ||
    session.roleCode === RoleCode.SUPER_ADMIN;
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/cutting" className="text-sm underline">
        Распил
      </Link>
      <h1 className="text-2xl font-semibold">Прайс работ</h1>
      {query.saved ? (
        <p role="status" className="text-emerald-700">
          Прайс сохранён.
        </p>
      ) : null}
      {query.error ? (
        <p role="alert" className="text-red-700">
          Заполните оба тарифа от 0 до 100 000 сом, не более двух знаков после
          запятой. Требуется подключённая база данных.
        </p>
      ) : null}
      <form action={saveCuttingPriceAction} className="grid gap-5">
        <label className="grid gap-2 text-sm font-medium">
          Распил, сом за лист
          <Input
            name="sheetRate"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            required
            defaultValue={price?.sheetRate ?? ""}
            disabled={!canEdit}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Кромление, сом за погонный метр
          <Input
            name="edgeRate"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            required
            defaultValue={price?.edgeRate ?? ""}
            disabled={!canEdit}
          />
        </label>
        {canEdit ? (
          <AdminSubmitButton
            type="submit"
            idleLabel="Сохранить прайс"
            pendingLabel="Сохраняем..."
          />
        ) : null}
      </form>
    </section>
  );
}
