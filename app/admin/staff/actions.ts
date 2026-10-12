"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/dal";
import { canManageStaff, staffAccessRoleCodes } from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export async function setStaffAccountAccessAction(formData: FormData) {
  const session = await requireAdminSession(
    "/login?next=/admin/staff",
    "/admin/staff",
  );
  if (!canManageStaff(session.roleCode)) {
    redirect("/admin/staff?notice=access-forbidden");
  }
  const id = formData.get("id");
  const value = formData.get("isActive");
  if (
    typeof id !== "string" ||
    !id.trim() ||
    (value !== "true" && value !== "false")
  ) {
    redirect("/admin/staff?notice=invalid-access");
  }
  if (id === session.userId) redirect("/admin/staff?notice=self-access");
  if (!hasDatabaseUrl()) redirect("/admin/staff?notice=database-unavailable");

  // Check the target role in the write itself, including concurrent role changes.
  const result = await getDb().user.updateMany({
    where: { id, role: { code: { in: [...staffAccessRoleCodes] } } },
    data: { isActive: value === "true" },
  });
  if (result.count !== 1) redirect("/admin/staff?notice=access-forbidden");
  revalidatePath("/admin/staff");
  redirect(`/admin/staff?notice=${value === "true" ? "enabled" : "disabled"}`);
}
