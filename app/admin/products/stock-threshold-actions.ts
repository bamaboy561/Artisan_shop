"use server";

import { revalidatePath } from "next/cache";

import { CategoryKind } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import {
  getStockThresholds,
  saveStockThresholds,
} from "@/lib/server/stock-thresholds";

// Сохраняет пороги остатка из формы в разделе «Товары».
export async function saveStockThresholdsAction(formData: FormData) {
  const session = await requireAdminSession(
    "/login?next=/admin/products",
    "/admin/products",
  );

  if (!canAccessGeneralAdmin(session.roleCode) || !hasDatabaseUrl()) return;

  const current = await getStockThresholds();
  const read = (kind: CategoryKind) => {
    const parsed = Number.parseInt(String(formData.get(kind) ?? ""), 10);

    return Number.isInteger(parsed) ? parsed : current[kind];
  };

  await saveStockThresholds({
    [CategoryKind.PLATE]: read(CategoryKind.PLATE),
    [CategoryKind.FITTINGS]: read(CategoryKind.FITTINGS),
    [CategoryKind.OTHER]: read(CategoryKind.OTHER),
  });

  revalidatePath("/admin");
  revalidatePath("/admin/products");
}
