"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { verifySession } from "@/lib/auth/dal";
import {
  createTelegramLinkForUser,
  disconnectTelegramForUser,
} from "@/lib/server/telegram-client";

export async function startTelegramLinkAction() {
  const session = await verifySession("/login?next=/account");
  const link = await createTelegramLinkForUser(session.userId);

  if (!link) {
    redirect("/account?telegram=unavailable");
  }

  redirect(link.url);
}

export async function disconnectTelegramAction() {
  const session = await verifySession("/login?next=/account");

  await disconnectTelegramForUser(session.userId);
  revalidatePath("/account");
  redirect("/account?telegram=disconnected");
}
