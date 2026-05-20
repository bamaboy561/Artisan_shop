"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
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

export async function toggleFavoriteAction(productSlug: string, label?: string) {
  const session = await verifySession("/login?next=/account");
  const db = getDb();

  const product = await db.product.findUnique({
    where: { slug: productSlug },
    select: { id: true },
  });

  if (!product) {
    return { success: false, error: "Товар не найден." };
  }

  const existing = await db.favorite.findUnique({
    where: {
      userId_productId: {
        userId: session.userId,
        productId: product.id,
      },
    },
  });

  if (existing) {
    await db.favorite.delete({
      where: {
        userId_productId: {
          userId: session.userId,
          productId: product.id,
        },
      },
    });
    revalidatePath("/account/favorites");
    revalidatePath(`/product/${productSlug}`);
    return { success: true as const, active: false as const };
  }

  await db.favorite.create({
    data: {
      userId: session.userId,
      productId: product.id,
      label: label || null,
    },
  });

  revalidatePath("/account/favorites");
  revalidatePath(`/product/${productSlug}`);
  return { success: true as const, active: true as const };
}