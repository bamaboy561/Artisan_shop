"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { normalizeSeasonMode } from "@/lib/season";
import { saveSeasonMode } from "@/lib/server/season-settings";

// Переключатель «Новогоднее оформление сайта» в разделе «Контент сайта».
export async function saveSeasonModeAction(formData: FormData) {
  const session = await requireAdminSession(
    "/login?next=/admin/content",
    "/admin/content",
  );

  if (!canAccessGeneralAdmin(session.roleCode) || !hasDatabaseUrl()) return;

  await saveSeasonMode(normalizeSeasonMode(formData.get("mode")));

  revalidatePath("/", "layout");
  revalidatePath("/admin/content");
}
