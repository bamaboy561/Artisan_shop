"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/dal";
import { canManageStaff, staffAccessRoleCodes } from "@/lib/auth/roles";
import { RoleCode } from "@/generated/prisma";
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
    where: {
      id,
      deletedAt: null,
      role: { code: { in: [...staffAccessRoleCodes] } },
    },
    data: { isActive: value === "true" },
  });
  if (result.count !== 1) redirect("/admin/staff?notice=access-forbidden");
  revalidatePath("/admin/staff");
  redirect(`/admin/staff?notice=${value === "true" ? "enabled" : "disabled"}`);
}

// Удаление сотрудника. Строку в базе не стираем: заказы, заявки, смены и
// журнал цеха ссылаются на него, и после настоящего удаления в них пропало
// бы, кто вёл работу. Вместо этого аккаунт закрывается навсегда: вход,
// пароль, Telegram и уведомления на телефон отключаются, email
// освобождается для нового аккаунта, а сотрудник пропадает из списка.
export async function deleteStaffAccountAction(formData: FormData) {
  const session = await requireAdminSession(
    "/login?next=/admin/staff",
    "/admin/staff",
  );
  if (!canManageStaff(session.roleCode)) {
    redirect("/admin/staff?notice=access-forbidden");
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !id.trim()) {
    redirect("/admin/staff?notice=account-missing");
  }
  if (id === session.userId) redirect("/admin/staff?notice=self-delete");
  if (!hasDatabaseUrl()) redirect("/admin/staff?notice=database-unavailable");

  const deletableRoles: RoleCode[] = [...staffAccessRoleCodes];
  if (session.roleCode === RoleCode.SUPER_ADMIN) {
    deletableRoles.push(RoleCode.ADMIN);
  }

  const deleted = await getDb().$transaction(async (tx) => {
    const account = await tx.user.findFirst({
      where: { id, deletedAt: null, role: { code: { in: deletableRoles } } },
      select: { id: true, email: true },
    });
    if (!account) return false;
    await tx.user.update({
      where: { id: account.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        hashedPassword: null,
        email: `deleted-${account.id}-${account.email}`.slice(0, 320),
        telegramChatId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      },
    });
    await tx.pushDevice.deleteMany({ where: { userId: account.id } });
    return true;
  });

  if (!deleted) redirect("/admin/staff?notice=delete-forbidden");
  revalidatePath("/admin/staff");
  redirect("/admin/staff?notice=deleted");
}
