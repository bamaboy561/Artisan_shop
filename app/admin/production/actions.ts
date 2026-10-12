"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/dal";
import { safeProductionReturn } from "@/features/production/queue";
import { saveProductionPlan } from "@/lib/server/production-planning";

export async function saveProductionDeadlineAction(formData: FormData) {
  const actor = await requireAdminSession(
    "/login?next=/admin/production",
    "/admin/production",
  );
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const id = get("requestId");
  if (!id || id.length > 128)
    redirect("/admin/production?notice=request-missing");
  let result: string;
  try {
    result = await saveProductionPlan({
      requestId: id,
      dueDate: get("dueDate"),
      expectedVersion: /^\d+$/.test(get("version"))
        ? Number(get("version"))
        : -1,
      actor,
    });
  } catch (error) {
    console.error("Production deadline save failed", error);
    result = "unavailable";
  }
  if (result === "saved") {
    revalidatePath("/admin/production");
    revalidatePath(`/admin/production/${id}`);
  }
  const params = new URLSearchParams({
    notice: `deadline-${result}`,
    returnTo: safeProductionReturn(get("returnTo")),
  });
  redirect(`/admin/production/${encodeURIComponent(id)}?${params}`);
}
