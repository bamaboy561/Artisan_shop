import type { Metadata } from "next";

import { CheckoutForm } from "@/app/(public)/checkout/checkout-form";
import { getOptionalSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import {
  getEffectiveDiscountPercent,
  getLoyaltyTierBenefits,
  getLoyaltyTierLabel,
  getLoyaltyTierForCategory,
} from "@/lib/server/pricing";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import { noIndexRobots } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Оформление заказа",
  robots: noIndexRobots,
};

export default async function CheckoutPage() {
  const databaseReady = hasDatabaseUrl();

  if (!databaseReady) {
    return <CheckoutForm databaseReady={false} customer={null} />;
  }

  const db = getDb();
  const session = await getOptionalSession();

  const [customer, loyaltyConfig] = await Promise.all([
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
            plateMaterialLoyaltyTier: true,
            fittingsLoyaltyTier: true,
            loyaltyPointsBalance: true,
            personalDiscountPercent: true,
          },
        })
      : Promise.resolve(null),
    getLoyaltyProgramConfig(),
  ]);

  return (
    <CheckoutForm
      databaseReady
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
              loyaltyTierLabel: getLoyaltyTierLabel(
                customer.loyaltyTier,
                loyaltyConfig,
              ),
              pointsBalance: customer.loyaltyPointsBalance,
              personalDiscountPercent: getEffectiveDiscountPercent(customer),
              maxRedeemPercent: loyaltyConfig.maxRedeemPercent,
              plateMaterialAccrualPercent: getLoyaltyTierBenefits(
                getLoyaltyTierForCategory("PLATE", customer),
                loyaltyConfig,
              ).plateMaterialAccrualPercent,
              fittingsAccrualPercent: getLoyaltyTierBenefits(
                getLoyaltyTierForCategory("FITTINGS", customer),
                loyaltyConfig,
              ).fittingsAccrualPercent,
            }
          : null
      }
    />
  );
}
