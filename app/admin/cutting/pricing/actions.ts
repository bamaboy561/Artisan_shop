"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { RoleCode, RequestType } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessRequestType } from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { parseCuttingLaborPrice } from "@/features/cutting/labor-price";
import {
  cuttingPriceKey,
  repriceCuttingRequest,
} from "@/lib/server/cutting-pricing";

export async function saveCuttingPriceAction(form: FormData) {
  const actor = await requireAdminSession("/login", "/admin/cutting/pricing");
  if (
    ![RoleCode.ADMIN, RoleCode.SUPER_ADMIN].some(
      (role) => role === actor.roleCode,
    )
  )
    throw new Error("Только администратор может менять прайс.");
  const rawSheet = String(form.get("sheetRate") ?? "")
    .trim()
    .replace(",", ".");
  const rawEdge = String(form.get("edgeRate") ?? "")
    .trim()
    .replace(",", ".");
  const price =
    rawSheet && rawEdge
      ? parseCuttingLaborPrice({
          sheetRate: Number(rawSheet),
          edgeRate: Number(rawEdge),
        })
      : null;
  if (!price || !hasDatabaseUrl())
    redirect("/admin/cutting/pricing?error=invalid");
  await getDb().siteSetting.upsert({
    where: { key: cuttingPriceKey },
    create: { key: cuttingPriceKey, value: { ...price } },
    update: { value: { ...price } },
  });
  revalidatePath("/admin/cutting/pricing");
  redirect("/admin/cutting/pricing?saved=1");
}

export async function repriceCuttingRequestAction(form: FormData) {
  const id = String(form.get("requestId") ?? "").trim();
  const actor = await requireAdminSession("/login", `/admin/requests/${id}`);
  if (!canAccessRequestType(actor.roleCode, RequestType.CUTTING_SERVICE))
    throw new Error("Нет доступа.");
  try {
    await repriceCuttingRequest(id, actor.userId);
  } catch (error) {
    const knownErrors = [
      "База данных не подключена.",
      "Заявка на распил не найдена.",
      "Сначала заполните прайс работ.",
      "Укажите количество листов и метраж кромления.",
      "Сумма работ слишком большая.",
    ];
    const message =
      error instanceof Error && knownErrors.includes(error.message)
        ? error.message
        : "Не удалось рассчитать сумму. Повторите попытку.";
    redirect(
      `/admin/requests/${encodeURIComponent(id)}?pricingError=${encodeURIComponent(message)}`,
    );
  }
  revalidatePath(`/admin/requests/${id}`);
  revalidatePath(`/admin/requests/${id}/route-sheet`);
  revalidatePath("/admin");
  revalidatePath("/account/requests");
  redirect(`/admin/requests/${encodeURIComponent(id)}`);
}
