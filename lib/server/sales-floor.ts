import { ProductStatus, RoleCode, type Prisma } from "@/generated/prisma";
import { getEffectiveProductPrice } from "@/features/catalog/bundle-pricing";
import { rankProductSearch } from "@/features/admin/product-search";
import { getDb } from "@/lib/db";
import { ensureProductBundleItemsTable } from "@/lib/server/product-bundle-schema";
import {
  getProductPromotionPrice,
  PROMOTION_PRICE_SELECT,
} from "@/lib/server/product-promotion-pricing";
import {
  buildUserSearchWhere,
  normalizeUserSearchQuery,
} from "@/lib/server/users-admin";

const salesFloorCustomerSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  companyName: true,
  loyaltyTier: true,
  plateMaterialLoyaltyTier: true,
  fittingsLoyaltyTier: true,
  loyaltyPointsBalance: true,
  personalDiscountPercent: true,
} satisfies Prisma.UserSelect;

function buildSalesFloorCustomerWhere(query: string): Prisma.UserWhereInput {
  return {
    isActive: true,
    role: {
      code: {
        in: [RoleCode.CUSTOMER, RoleCode.DEALER],
      },
    },
    ...buildUserSearchWhere(query),
  };
}

export async function getSalesFloorCustomers(query = "", take = 40) {
  const db = getDb();
  const normalizedQuery = normalizeUserSearchQuery(query);

  return db.user.findMany({
    where: buildSalesFloorCustomerWhere(normalizedQuery),
    orderBy: normalizedQuery
      ? [{ updatedAt: "desc" }, { email: "asc" }]
      : [{ updatedAt: "desc" }, { email: "asc" }],
    take,
    select: salesFloorCustomerSelect,
  });
}

export async function getSalesFloorProducts(
  query = "",
  take = 120,
  allForInvoice = false,
) {
  const db = getDb();
  const normalizedQuery = query.replace(/\s+/g, " ").trim().slice(0, 500);
  const limit = Math.max(1, Math.min(200, take));
  // Rank lightweight catalog records first; load images/prices only for the results.
  const rankedIds = normalizedQuery
    ? rankProductSearch(
        await db.product.findMany({
          where: { status: ProductStatus.ACTIVE },
          select: {
            id: true,
            name: true,
            sku: true,
            brand: { select: { name: true } },
            category: { select: { name: true } },
          },
        }),
        normalizedQuery,
      )
        .slice(0, limit)
        .map((product) => product.id)
    : null;
  if (rankedIds && !rankedIds.length) return [];

  const products = await db.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      ...(rankedIds ? { id: { in: rankedIds } } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    ...(allForInvoice ? {} : { take: limit }),
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stockQuantity: true,
      bundleItems: {
        select: {
          quantity: true,
          componentProduct: { select: { price: true } },
        },
      },
      promotions: {
        select: { promotion: { select: PROMOTION_PRICE_SELECT } },
      },
      brand: { select: { name: true } },
      category: {
        select: {
          name: true,
          promotions: {
            select: { promotion: { select: PROMOTION_PRICE_SELECT } },
          },
        },
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { url: true },
      },
    },
  });

  const orderedProducts = rankedIds
    ? [...products].sort(
        (a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id),
      )
    : products;
  return orderedProducts.map((product) => {
    const promotionPrice = getProductPromotionPrice(
      getEffectiveProductPrice(product),
      product.promotions,
      product.category.promotions,
    );

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: promotionPrice.finalPrice,
      stockQuantity: product.stockQuantity,
      brand: product.brand,
      category: { name: product.category.name },
      images: product.images,
    };
  });
}

export async function getSalesFloorData() {
  const db = getDb();
  await ensureProductBundleItemsTable(db);

  const [customers, products] = await Promise.all([
    getSalesFloorCustomers("", 80),
    getSalesFloorProducts("", 120),
  ]);

  return {
    customers,
    products,
  };
}
