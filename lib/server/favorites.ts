import "server-only";

import { getOptionalSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export async function getCurrentFavoriteProductSlugs(productSlugs?: string[]) {
  const session = await getOptionalSession();

  if (!session?.userId || !hasDatabaseUrl()) {
    return new Set<string>();
  }

  const favorites = await getDb().favorite.findMany({
    where: {
      userId: session.userId,
      ...(productSlugs?.length
        ? {
            product: {
              slug: {
                in: productSlugs,
              },
            },
          }
        : {}),
    },
    select: {
      product: {
        select: {
          slug: true,
        },
      },
    },
  });

  return new Set(favorites.map((favorite) => favorite.product.slug));
}
