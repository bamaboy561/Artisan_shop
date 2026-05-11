import type { Metadata } from "next";

import { CheckoutForm } from "@/app/(public)/checkout/checkout-form";
import { getOptionalSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  getEffectiveDiscountPercent,
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
} from "@/lib/server/pricing";
import { noIndexRobots } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Оформление заказа",
  robots: noIndexRobots,
};

export default async function CheckoutPage() {
  const databaseReady = hasDatabaseUrl();

  if (!databaseReady) {
    return (
      <CheckoutForm
        databaseReady={false}
        customer={null}
        deliveryMethods={[]}
      />
    );
  }

  const db = getDb();
  const session = await getOptionalSession();

  const [deliveryMethods, customer] = await Promise.all([
    db.deliveryMethod.findMany({
      where: { isActive: true },
      orderBy: [{ price: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        price: true,
      },
    }),
    session?.userId
      ? db.user.findUnique({
          where: { id: session.userId },
          select: {
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            companyName: true,
            loyaltyTier: true,
            loyaltyPointsBalance: true,
            personalDiscountPercent: true,
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <CheckoutForm
      databaseReady
      deliveryMethods={deliveryMethods}
      customer={
        customer
          ? {
              email: customer.email,
              name:
                [customer.firstName, customer.lastName]
                  .filter(Boolean)
                  .join(" ") || "",
              phone: customer.phone ?? "",
              companyName: customer.companyName ?? "",
              loyaltyTierLabel: getLoyaltyTierLabel(customer.loyaltyTier),
              pointsBalance: customer.loyaltyPointsBalance,
              discountPercent: getEffectiveDiscountPercent(customer),
              accrualPercent: getLoyaltyTierBenefits(customer.loyaltyTier)
                .accrualPercent,
            }
          : null
      }
    />
  );
}
