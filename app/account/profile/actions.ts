"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { verifySession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";

const profileSchema = z.object({
  firstName: z.string().trim().min(2, "Укажите имя.").max(80),
  lastName: z.string().trim().max(80),
  phone: z.string().trim().max(40),
  companyName: z.string().trim().max(160),
  email: z.email("Укажите корректный email.").trim().toLowerCase(),
});

export async function updateAccountProfileAction(formData: FormData) {
  const session = await verifySession("/login?next=/account/profile");

  if (!hasDatabaseUrl()) {
    redirect("/account/profile?status=error&message=База+данных+недоступна");
  }

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Проверьте данные.";
    redirect(
      `/account/profile?status=error&message=${encodeURIComponent(message)}`,
    );
  }

  const existingUser = await getDb().user.findFirst({
    where: {
      email: parsed.data.email,
      NOT: { id: session.userId },
    },
    select: { id: true },
  });

  if (existingUser) {
    redirect(
      "/account/profile?status=error&message=Этот+email+уже+используется",
    );
  }

  await getDb().user.update({
    where: { id: session.userId },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName || null,
      phone: parsed.data.phone || null,
      companyName: parsed.data.companyName || null,
      email: parsed.data.email,
    },
  });

  revalidatePath("/account");
  revalidatePath("/account/profile");
  redirect("/account/profile?status=success");
}
