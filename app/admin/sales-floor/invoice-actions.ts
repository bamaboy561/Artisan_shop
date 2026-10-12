"use server";

import { parseSalesInvoice } from "@/features/admin/sales-invoice";
import { matchInvoiceLines } from "@/features/admin/sales-invoice-model";
import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { getSalesFloorProducts } from "@/lib/server/sales-floor";
import {
  InvoicePhotoError,
  isInvoicePhotoEnabled,
  prepareInvoicePhoto,
  recognizeInvoicePhoto,
} from "@/lib/server/invoice-photo";
import { claimInvoicePhotoAttempt } from "@/lib/server/invoice-photo-limit";

export async function previewSalesInvoiceAction(data: FormData) {
  const session = await requireAdminSession(
    "/login?next=/admin/sales-floor",
    "/admin/sales-floor",
  );
  if (!canAccessGeneralAdmin(session.roleCode))
    return { error: "Нет доступа к продажам." };
  if (!hasDatabaseUrl()) return { error: "База данных не подключена." };
  const file = data.get("invoice");
  const photo = data.get("source") === "photo";
  if (!(file instanceof File) || !file.size)
    return { error: "Выберите файл накладной." };
  if (photo && !isInvoicePhotoEnabled())
    return {
      error:
        "Распознавание фото ещё не подключено. Пока используйте накладную XLS / XLSX.",
    };
  if (photo && data.get("photoConsent") !== "yes")
    return { error: "Подтвердите отправку фото в сервис распознавания." };
  if (!photo && !/\.xlsx?$/i.test(file.name))
    return { error: "Выберите накладную XLS или XLSX." };
  if (file.size > 20 * 1024 * 1024)
    return { error: "Накладная больше 20 МБ. Разделите файл." };
  try {
    let invoice;
    if (photo) {
      const image = await prepareInvoicePhoto(file);
      if (!(await claimInvoicePhotoAttempt(session.userId)))
        return {
          error:
            "Слишком много попыток распознавания. Подождите 30 секунд; максимум 50 фото на сотрудника в сутки.",
        };
      invoice = await recognizeInvoicePhoto(image, file.name);
    } else {
      invoice = await parseSalesInvoice(file);
    }
    const products = await getSalesFloorProducts("", 120, true);
    return {
      invoice: {
        ...invoice,
        lines: matchInvoiceLines(invoice.lines, products),
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof InvoicePhotoError ||
        (error instanceof Error &&
          /таблиц|накладн|позиц|строк/i.test(error.message))
          ? error.message
          : "Не удалось прочитать накладную или загрузить каталог. Попробуйте снова.",
    };
  }
}
