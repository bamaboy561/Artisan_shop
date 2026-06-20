import { RoleCode } from "@/generated/prisma";
import { getEffectiveProductPrice } from "@/features/catalog/bundle-pricing";
import { getDb } from "@/lib/db";
import { ensureProductBundleItemsTable } from "@/lib/server/product-bundle-schema";

export async function getSalesFloorData() {
  const db = getDb();
  await ensureProductBundleItemsTable(db);

  const [customers, products] = await Promise.all([
    db.user.findMany({
      where: {
        isActive: true,
        role: {
          code: {
            in: [RoleCode.CUSTOMER, RoleCode.DEALER],
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { email: "asc" }],
      take: 200,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        loyaltyTier: true,
        loyaltyPointsBalance: true,
        personalDiscountPercent: true,
      },
    }),
    db.product.findMany({
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: 5000,
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stockQuantity: true,
        bundleItems: {
          select: {
            quantity: true,
            componentProduct: {
              select: {
                price: true,
              },
            },
          },
        },
        brand: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          take: 1,
          select: {
            url: true,
          },
        },
      },
    }),
  ]);

  return {
    customers,
    products: products.map((product) => ({
      ...product,
      price: getEffectiveProductPrice(product),
    })),
  };
}
