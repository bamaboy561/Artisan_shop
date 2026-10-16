"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { RoleCode, RequestType } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessRequestType } from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { parseCuttingLaborPrice } from "@/features/cutting/labor-price";
import {
  drillingDiameters,
  isValidSitePrice,
  type SiteCuttingPrices,
} from "@/features/cutting/site-prices";
import {
  cuttingPriceKey,
  repriceCuttingRequest,
  siteCuttingPricesKey,
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

function readRate(form: FormData, field: string) {
  const raw = String(form.get(field) ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  const rate = raw ? Number(raw) : NaN;
  return isValidSitePrice(rate) ? rate : null;
}

// Цены сайта: калькулятор распила, плашка «Раскрой через сайт дешевле»
// и присадка по диаметрам. Сразу видны на всех страницах сайта.
export async function saveSiteCuttingPricesAction(form: FormData) {
  const actor = await requireAdminSession("/login", "/admin/cutting/pricing");
  if (
    ![RoleCode.ADMIN, RoleCode.SUPER_ADMIN].some(
      (role) => role === actor.roleCode,
    )
  )
    throw new Error("Только администратор может менять прайс.");
  const sheet = readRate(form, "siteSheet");
  const sheetRegular = readRate(form, "siteSheetRegular");
  const edge = readRate(form, "siteEdge");
  const edgeRegular = readRate(form, "siteEdgeRegular");
  const drilling: Record<number, number> = {};
  let drillingValid = true;
  for (const diameter of drillingDiameters) {
    const price = readRate(form, `drill${diameter}`);
    if (price === null) drillingValid = false;
    else drilling[diameter] = price;
  }
  if (
    sheet === null ||
    sheetRegular === null ||
    edge === null ||
    edgeRegular === null ||
    !drillingValid ||
    !hasDatabaseUrl()
  )
    redirect("/admin/cutting/pricing?siteError=invalid");
  const value: SiteCuttingPrices = {
    sheet,
    sheetRegular,
    edge,
    edgeRegular,
    drilling,
  };
  await getDb().siteSetting.upsert({
    where: { key: siteCuttingPricesKey },
    create: { key: siteCuttingPricesKey, value },
    update: { value },
  });
  // Цены показаны на главной, в каталоге, калькуляторе и проектах Базиса.
  revalidatePath("/", "layout");
  redirect("/admin/cutting/pricing?siteSaved=1");
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
