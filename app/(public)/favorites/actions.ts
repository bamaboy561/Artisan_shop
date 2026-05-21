"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { verifySession } from "@/lib/auth/dal";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export async function toggleFavoriteAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const next = getSafeRedirectPath(
    String(formData.get("next") ?? ""),
    "/catalog",
  );

  if (!productSlug) {
    redirect(next);
  }

  const session = await verifySession(
    `/login?next=${encodeURIComponent(next)}`,
  );

  if (!hasDatabaseUrl()) {
    redirect(next);
  }

  const db = getDb();
  const product = await db.product.findUnique({
    where: { slug: productSlug },
    select: { id: true, slug: true },
  });

  if (!product) {
    redirect(next);
  }

  const favoriteKey = {
    userId_productId: {
      userId: session.userId,
      productId: product.id,
    },
  };
  const existingFavorite = await db.favorite.findUnique({
    where: favoriteKey,
    select: { productId: true },
  });

  if (existingFavorite) {
    await db.favorite.delete({ where: favoriteKey });
  } else {
    await db.favorite.create({
      data: {
        userId: session.userId,
        productId: product.id,
      },
    });
  }

  const nextPath = next.split("?")[0] || "/";
  revalidatePath(nextPath);
  revalidatePath("/catalog");
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/account");
  revalidatePath("/account/favorites");

  redirect(next);
}
