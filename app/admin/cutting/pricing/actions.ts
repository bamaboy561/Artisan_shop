"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { RequestType } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessRequestType, canEditCuttingPrices } from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { parseCuttingLaborPrice } from "@/features/cutting/labor-price";
import { cuttingExtrasFromForm } from "@/features/cutting/quote";
import {
  defaultSiteCuttingPrices,
  drillingDiameters,
  isValidSitePrice,
  otherWorks,
  type OtherWorkPriceKey,
  type SiteCuttingPrices,
} from "@/features/cutting/site-prices";
import {
  cuttingPriceKey,
  repriceCuttingRequest,
  siteCuttingPricesKey,
} from "@/lib/server/cutting-pricing";
import {
  applyGibLabProjectToRequest,
  isGibLabProjectFileName,
  readRequestGibLabSummary,
} from "@/lib/server/giblab-project-apply";
import { logOperationEvent } from "@/lib/server/operation-events";

export async function saveCuttingPriceAction(form: FormData) {
  const actor = await requireAdminSession("/login", "/admin/cutting/pricing");
  if (!canEditCuttingPrices(actor.roleCode))
    throw new Error("Нет прав менять прайс распила.");
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
  if (!canEditCuttingPrices(actor.roleCode))
    throw new Error("Нет прав менять прайс распила.");
  const sheet = readRate(form, "siteSheet");
  const sheetRegular = readRate(form, "siteSheetRegular");
  const edge = readRate(form, "siteEdge");
  const edgeRegular = readRate(form, "siteEdgeRegular");
  // Поля фрезеровки появились позже: старая форма без них цену не сбрасывает.
  const optionalRate = (field: string, fallback: number) =>
    form.get(field) === null ? fallback : readRate(form, field);
  const milling = optionalRate("siteMilling", defaultSiteCuttingPrices.milling);
  const bevel = optionalRate("siteBevel", defaultSiteCuttingPrices.bevel);
  const groove = optionalRate("siteGroove", defaultSiteCuttingPrices.groove);
  const otherPrices: Partial<Record<OtherWorkPriceKey, number>> = {};
  let otherValid = true;
  for (const work of otherWorks) {
    const rate = optionalRate(`site_${work.price}`, work.fallback);
    if (rate === null) otherValid = false;
    else otherPrices[work.price] = rate;
  }
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
    milling === null ||
    bevel === null ||
    groove === null ||
    !otherValid ||
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
    milling,
    bevel,
    groove,
    ...(otherPrices as Record<OtherWorkPriceKey, number>),
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
  const errorRedirect = (message: string) =>
    redirect(
      `/admin/requests/${encodeURIComponent(id)}?pricingError=${encodeURIComponent(message)}`,
    );
  // Присадка и фрезеровка из формы менеджера; пустая форма — «без присадки».
  const parsed = cuttingExtrasFromForm(form);
  if (!parsed.ok) errorRedirect(parsed.message);
  const fromForm = parsed.ok ? parsed.extras : null;
  const extras =
    fromForm ??
    (form.get("extrasForm")
      ? {
          drilling: {},
          curveMeters: 0,
          bevelMeters: 0,
          source: "manager" as const,
        }
      : null);
  try {
    await repriceCuttingRequest(id, actor.userId, extras);
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

// «Взять из GibLab»: оператор доделал заказ в GibLab, файл .project
// приложен к заявке. Листы, кромка, присадка и фрезеровка переносятся в
// заявку, сумма работ пересчитывается по прайсу.
export async function applyGibLabProjectAction(form: FormData) {
  const id = String(form.get("requestId") ?? "").trim();
  const fileId = String(form.get("fileId") ?? "").trim();
  const actor = await requireAdminSession("/login", `/admin/requests/${id}`);
  if (!canAccessRequestType(actor.roleCode, RequestType.CUTTING_SERVICE))
    throw new Error("Нет доступа.");
  const back = (message?: string) =>
    redirect(
      `/admin/requests/${encodeURIComponent(id)}${
        message ? `?pricingError=${encodeURIComponent(message)}` : ""
      }#giblab`,
    );
  if (!hasDatabaseUrl()) back("База данных не подключена.");
  const file = await getDb().requestFile.findFirst({
    where: { id: fileId, requestId: id },
    select: { fileName: true, fileUrl: true },
  });
  if (!file || !isGibLabProjectFileName(file.fileName))
    back("Файл GibLab не найден в заявке.");
  let message: string | null = null;
  try {
    const summary = await readRequestGibLabSummary(file!.fileUrl);
    if (!summary) throw new Error("Не удалось прочитать файл GibLab.");
    const extras = await applyGibLabProjectToRequest(id, summary);
    await logOperationEvent({
      entityType: "request",
      entityId: id,
      eventType: "production_result",
      title: "Данные взяты из заказа GibLab",
      description: [
        `Файл: ${file!.fileName}.`,
        ...summary.sheets.map((sheet) => `${sheet.name}: ${sheet.sheets} л.`),
        ...summary.bands.map((band) => `${band.name}: ${band.meters} м.`),
        `Отверстий: ${summary.faceHoles + summary.edgeHoles}.`,
      ].join(" "),
      isVisibleToClient: false,
      actor,
    });
    try {
      await repriceCuttingRequest(id, actor.userId, extras);
    } catch (error) {
      message =
        error instanceof Error &&
        error.message === "Сначала заполните прайс работ."
          ? "Данные из GibLab перенесены, но прайс работ не заполнен: сумма не пересчитана."
          : "Данные из GibLab перенесены, но сумму пересчитать не удалось.";
    }
  } catch (error) {
    console.error("[giblab:apply]", error);
    message =
      error instanceof Error && error.message.startsWith("В проекте GibLab")
        ? error.message
        : error instanceof Error &&
            error.message === "Не удалось прочитать файл GibLab."
          ? error.message
          : "Не удалось перенести данные из GibLab. Повторите попытку.";
  }
  revalidatePath(`/admin/requests/${id}`);
  revalidatePath(`/admin/requests/${id}/route-sheet`);
  revalidatePath("/admin/cutting");
  revalidatePath("/account/requests");
  back(message ?? undefined);
}
