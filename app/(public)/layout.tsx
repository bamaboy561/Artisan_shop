import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CartProvider } from "@/components/providers/cart-provider";
import { SiteCuttingPricesProvider } from "@/features/cutting/site-prices-context";
import { getSiteCuttingPrices } from "@/lib/server/cutting-pricing";
import { PromotionExperience } from "@/components/promotions/promotion-experience";
import { getPublicHighlightedPromotions } from "@/lib/server/promotions-public";
import { getPublicCategories } from "@/lib/server/catalog-public";
import { isPremiumStorefront } from "@/features/storefront/config";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import storefront from "@/features/storefront/storefront.module.css";

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [promotions, sitePrices] = await Promise.all([
    getPublicHighlightedPromotions(),
    getSiteCuttingPrices(),
  ]);

  if (isPremiumStorefront()) {
    const categories = await getPublicCategories();
    return (
      <SiteCuttingPricesProvider prices={sitePrices}>
        <CartProvider>
          <div className={storefront.root} data-storefront="premium">
            <StorefrontHeader
              categories={categories.map(({ slug, name }) => ({ slug, name }))}
            />
            <PromotionExperience promotions={promotions} />
            <main id="main-content" className={storefront.main}>
              {children}
            </main>
            <StorefrontFooter />
          </div>
        </CartProvider>
      </SiteCuttingPricesProvider>
    );
  }

  return (
    <CartProvider>
      <div className="bg-background min-h-screen overflow-x-clip">
        <SiteHeader />
        <PromotionExperience promotions={promotions} />
        <main
          id="main-content"
          className="min-h-[70svh] min-w-0 overflow-x-clip pb-[calc(6.25rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          {children}
        </main>
        <SiteFooter />
      </div>
    </CartProvider>
  );
}
