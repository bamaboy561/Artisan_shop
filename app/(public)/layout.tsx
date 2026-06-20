import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CartProvider } from "@/components/providers/cart-provider";
import { PromotionExperience } from "@/components/promotions/promotion-experience";
import { getPublicProducts } from "@/lib/server/catalog-public";
import { getPublicHighlightedPromotions } from "@/lib/server/promotions-public";

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [products, promotions] = await Promise.all([
    getPublicProducts(),
    getPublicHighlightedPromotions(),
  ]);

  return (
    <CartProvider products={products}>
      <div className="bg-background min-h-screen overflow-x-clip">
        <SiteHeader />
        <PromotionExperience promotions={promotions} />
        <main
          id="main-content"
          className="min-w-0 overflow-x-clip pb-[calc(6.25rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          {children}
        </main>
        <SiteFooter />
      </div>
    </CartProvider>
  );
}
