"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { parseProductImportFile } from "@/features/admin/product-import";
import {
  buildStockImportPlan,
  buildStockReconciliation,
  stockMatchedPendingKeys,
  collectStockPendingItems,
  stockReconciliationCsv,
  stockRowKey,
  stockImportReportCsv,
  summarizeStockImport,
  type StockImportResult,
  type StockProduct,
} from "@/features/admin/stock-import";
import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  getInventoryStatusForStock,
  getUnpaidReservedQuantities,
} from "@/lib/server/inventory-reservations";
import {
  pruneStockPendingItems,
  saveStockPendingItems,
} from "@/lib/server/stock-pending";
import { ensureStockPendingItemsTable } from "@/lib/server/stock-pending-schema";

export async function processStockImportAction(
  formData: FormData,
): Promise<StockImportResult> {
  const session = await requireAdminSession(
    "/login?next=/admin/products",
    "/admin/products",
  );
  if (!canAccessGeneralAdmin(session.roleCode))
    return { phase: "error", message: "Нет доступа к обновлению каталога." };
  if (!hasDatabaseUrl())
    return {
      phase: "error",
      message: "База данных не подключена. Товары не изменены.",
    };

  const file = formData.get("stockFile");
  const mode = formData.get("mode");
  const intent = formData.get("intent");
  if (!(file instanceof File) || !file.size)
    return { phase: "error", message: "Выберите файл цен и остатков." };
  if (!/\.(xlsx?|csv|tsv)$/i.test(file.name))
    return {
      phase: "error",
      message: "Поддерживаются файлы XLSX, XLS, CSV и TSV.",
    };
  if (file.size > 100 * 1024 * 1024)
    return {
      phase: "error",
      message: "Файл больше 100 МБ. Разделите его на несколько файлов.",
    };
  if (mode !== "all" && mode !== "price" && mode !== "stock")
    return { phase: "error", message: "Выберите режим обновления." };
  if (intent !== "preview" && intent !== "apply")
    return { phase: "error", message: "Сначала проверьте файл." };

  let parsed: Awaited<ReturnType<typeof parseProductImportFile>>;
  try {
    parsed = await parseProductImportFile(file, { stockReports: true });
  } catch {
    return {
      phase: "error",
      message:
        "Не удалось прочитать таблицу. Проверьте формат и отсутствие пароля на файле.",
    };
  }
  if (!parsed.rows.length)
    return {
      phase: "error",
      message:
        "Не найдены строки товаров. Проверьте колонки «Артикул», «Цена», «Остаток».",
      warnings: parsed.warnings,
    };

  const db = getDb();
  let products: StockProduct[];
  try {
    products = await db.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        compareAtPrice: true,
        stockQuantity: true,
        inventoryStatus: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    });
  } catch {
    return {
      phase: "error",
      message:
        "Не удалось загрузить каталог для сверки. Товары не изменены; повторите проверку.",
    };
  }
  const plan = buildStockImportPlan(parsed.rows, products, mode);
  const reconcile =
    mode === "stock" ||
    (mode === "all" && parsed.rows.every((row) => row.inventoryReport));
  const fileName = file.name;
  // Позиции отчёта, которых нет на сайте, после подтверждения сохраняются
  // в список «Добавить на сайт», чтобы завести карточки позже.
  const pendingItems = reconcile
    ? collectStockPendingItems(
        buildStockReconciliation(parsed.rows, products, plan),
      )
    : [];
  let pendingSaved: number | null = null;

  // «Обнулить то, чего нет в файле»: товар распродан и пропал из отчёта 1С,
  // но на сайте всё ещё числится в наличии. Только для сверки остатков.
  const zeroMissing = reconcile && formData.get("zeroMissing") === "on";
  const missingToZero = zeroMissing
    ? buildStockReconciliation(parsed.rows, products, plan).flatMap((entry) =>
        entry.kind === "missing" && (entry.siteQuantity ?? 0) > 0
          ? [
              {
                id: entry.key.slice("missing:".length),
                name: entry.name,
                quantity: entry.siteQuantity ?? 0,
              },
            ]
          : [],
      )
    : [];
  const missingToZeroIds = new Set(missingToZero.map((item) => item.id));
  let zeroedCount: number | null = null;
  const fingerprint = createHash("sha256")
    .update(new Uint8Array(await file.arrayBuffer()))
    .update(
      JSON.stringify({
        mode,
        plan,
        zeroMissing: zeroMissing ? [...missingToZeroIds] : false,
      }),
    )
    .digest("hex");

  function result(
    phase: "preview" | "done",
    message: string,
  ): StockImportResult {
    // Keep the interactive table small; the downloaded report contains every parsed row.
    const prioritized = [...plan].sort((a, b) => {
      const priority = {
        error: 0,
        conflict: 1,
        skipped: 2,
        ready: 3,
        updated: 4,
        unchanged: 5,
      };
      return priority[a.status] - priority[b.status];
    });
    const reconciliation = reconcile
      ? buildStockReconciliation(parsed.rows, products, plan)
      : undefined;

    if (reconciliation && zeroMissing) {
      for (const entry of reconciliation) {
        if (
          entry.kind === "missing" &&
          missingToZeroIds.has(entry.key.slice("missing:".length))
        ) {
          entry.reason =
            zeroedCount === null
              ? `Нет в файле: остаток будет обнулён (сейчас ${entry.siteQuantity}).`
              : `Нет в файле: остаток обнулён (было ${entry.siteQuantity}).`;
        }
      }
    }

    const zeroWarnings =
      zeroMissing && missingToZero.length > 0
        ? [
            `${
              zeroedCount === null
                ? "После подтверждения будет обнулён остаток"
                : "Обнулён остаток"
            } у товаров, которых нет в файле: ${
              zeroedCount ?? missingToZero.length
            }. ${missingToZero
              .slice(0, 20)
              .map((item) => `${item.name} (${item.quantity})`)
              .join("; ")}${
              missingToZero.length > 20
                ? `; и ещё ${missingToZero.length - 20}. Полный список в отчёте.`
                : "."
            }`,
          ]
        : zeroMissing
          ? ["Товаров с остатком, которых нет в файле, не найдено."]
          : [];
    const pendingWarnings = !pendingItems.length
      ? []
      : pendingSaved === null
        ? [
            `Нет на сайте: ${pendingItems.length}. После подтверждения эти позиции сохранятся в список «Добавить на сайт», повторы не дублируются.`,
          ]
        : pendingSaved > 0
          ? [
              `Сохранено в список «Добавить на сайт»: ${pendingSaved}. Список ниже, в разделе «Нет на сайте».`,
            ]
          : [
              "Не удалось сохранить список «Нет на сайте». Остатки обновлены; скачайте отчёт CSV.",
            ];

    return {
      phase,
      message,
      fingerprint: phase === "preview" ? fingerprint : undefined,
      fileName,
      counts: summarizeStockImport(plan),
      total: plan.length,
      entries: prioritized.slice(0, 100).map((entry) => ({
        sheet: entry.sheet,
        row: entry.row,
        sku: entry.sku,
        name: entry.name,
        status: entry.status,
        reason: entry.reason,
        before: entry.before,
        changes: entry.changes,
      })),
      warnings: [...pendingWarnings, ...zeroWarnings, ...parsed.warnings],
      pendingCount: pendingItems.length,
      columns: parsed.mappedColumns,
      reconciliation,
      reportCsv: reconciliation
        ? stockReconciliationCsv(reconciliation)
        : stockImportReportCsv(plan),
    };
  }
  if (intent === "preview")
    return result("preview", "Проверка завершена. Изменения ещё не применены.");
  if (formData.get("fingerprint") !== fingerprint) {
    return result(
      "preview",
      "Файл, настройки или товары изменились после проверки. Проверьте обновлённый результат и подтвердите ещё раз. Ничего не записано.",
    );
  }

  let selected: Set<string> | null = null;
  if (reconcile) {
    try {
      const keys: unknown = JSON.parse(
        String(formData.get("selectedRows") ?? "null"),
      );
      const allowed = new Set(
        plan.filter((entry) => entry.status === "ready").map(stockRowKey),
      );
      if (
        !Array.isArray(keys) ||
        (!keys.length &&
          !(zeroMissing && missingToZero.length > 0) &&
          !pendingItems.length) ||
        keys.some((key) => typeof key !== "string" || !allowed.has(key))
      )
        return result(
          "preview",
          "Выберите проверенные строки для обновления. Ничего не записано.",
        );
      selected = new Set(keys);
    } catch {
      return result(
        "preview",
        "Не удалось прочитать выбранные строки. Ничего не записано.",
      );
    }
  }
  const ready = plan.filter(
    (entry) =>
      entry.status === "ready" &&
      (!selected || selected.has(stockRowKey(entry))),
  );
  if (selected) {
    for (const entry of plan) {
      if (entry.status === "ready" && !selected.has(stockRowKey(entry))) {
        entry.status = "skipped";
        entry.reason = "Не выбрано для обновления. Остаток не изменён.";
        entry.changes = {};
      }
    }
  }
  // Остаток из файла 1С уменьшаем на то, что держат неоплаченные заказы
  // сайта: в 1С они ещё не проведены, и выгрузка не должна стирать резерв.
  const reservedByProduct = await getUnpaidReservedQuantities(
    db,
    ready.flatMap((entry) => (entry.productId ? [entry.productId] : [])),
  );

  for (const entry of ready) {
    const reserved = entry.productId
      ? (reservedByProduct.get(entry.productId) ?? 0)
      : 0;

    if (reserved > 0 && typeof entry.changes.stockQuantity === "number") {
      const availableQuantity = Math.max(
        0,
        entry.changes.stockQuantity - reserved,
      );

      entry.changes = {
        ...entry.changes,
        stockQuantity: availableQuantity,
        inventoryStatus: getInventoryStatusForStock(availableQuantity),
      };
      entry.reason = `Учтён резерв неоплаченных заказов сайта: ${reserved} шт.`;
    }
  }

  for (let offset = 0; offset < ready.length; offset += 100) {
    const batch = ready.slice(offset, offset + 100);
    try {
      // Optimistic version checks also protect changes made after preview was revalidated.
      const updates = await db.$transaction(
        batch.map((entry) =>
          db.product.updateMany({
            where: {
              id: entry.productId!,
              updatedAt: new Date(entry.updatedAt!),
            },
            data: entry.changes,
          }),
        ),
      );
      updates.forEach((update, index) => {
        batch[index].status = update.count === 1 ? "updated" : "conflict";
        if (update.count !== 1) {
          batch[index].reason =
            "Товар изменён или удалён во время обновления. Загрузите файл повторно.";
          batch[index].changes = {};
        }
      });
    } catch {
      for (const entry of batch) {
        entry.status = "error";
        entry.reason =
          "Не удалось подтвердить обновление пакета. Повторите проверку файла, чтобы сверить текущие данные.";
        entry.changes = {};
      }
    }
  }
  if (zeroMissing && missingToZero.length > 0) {
    try {
      const zeroed = await db.product.updateMany({
        where: {
          id: { in: [...missingToZeroIds] },
          stockQuantity: { gt: 0 },
        },
        data: {
          stockQuantity: 0,
          inventoryStatus: getInventoryStatusForStock(0),
        },
      });
      zeroedCount = zeroed.count;
    } catch {
      zeroedCount = 0;
    }
  }

  try {
    await saveStockPendingItems(db, pendingItems, fileName);
    await pruneStockPendingItems(
      db,
      products,
      stockMatchedPendingKeys(parsed.rows, plan),
    );
    pendingSaved = pendingItems.length;
  } catch {
    pendingSaved = pendingItems.length ? 0 : null;
  }

  if (plan.some((entry) => entry.status === "updated") || zeroedCount) {
    for (const path of [
      "/admin",
      "/admin/products",
      "/admin/brands",
      "/admin/categories",
      "/",
      "/catalog",
      "/brands",
      "/cart",
      "/calculator",
    ])
      revalidatePath(path);
    revalidatePath("/product/[slug]", "page");
    revalidatePath("/catalog/[slug]", "page");
    revalidatePath("/brands/[slug]", "page");
  }
  const counts = summarizeStockImport(plan);
  return result(
    "done",
    counts.error || counts.conflict
      ? "Обновление завершено с замечаниями. Строки, требующие повторной проверки, указаны в отчёте."
      : counts.updated || zeroedCount
        ? "Цены и остатки обновлены."
        : pendingSaved
          ? "Остатки не менялись. Позиции, которых нет на сайте, сохранены в список."
          : "Обновление не потребовалось. Проверьте результаты строк.",
  );
}

// «Не добавлять»: позиция скрывается и не возвращается при следующих
// загрузках (например, расходники цеха, которые не продаются на сайте).
export async function dismissStockPendingItemAction(formData: FormData) {
  const session = await requireAdminSession(
    "/login?next=/admin/products",
    "/admin/products",
  );
  if (!canAccessGeneralAdmin(session.roleCode) || !hasDatabaseUrl()) return;
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await ensureStockPendingItemsTable(getDb());
  await getDb().stockPendingItem.updateMany({
    where: { id, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });
  revalidatePath("/admin/products");
}
