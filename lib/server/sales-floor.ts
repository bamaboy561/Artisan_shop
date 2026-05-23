import { ProductStatus, RoleCode } from "@/generated/prisma";
import { getDb } from "@/lib/db";

export async function getSalesFloorData() {
  const db = getDb();

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
      where: {
        status: ProductStatus.ACTIVE,
        price: { not: null },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: 600,
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stockQuantity: true,
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
    products,
  };
}
