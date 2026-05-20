import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { StructuredData } from "@/components/seo/structured-data";
import { organizationJsonLd } from "@/lib/seo";
import { CartProvider } from "@/components/providers/cart-provider";
import { CompareBar } from "@/components/catalog/compare-bar";
import { getPublicProducts } from "@/lib/server/catalog-public";

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const products = await getPublicProducts();

  return (
    <CartProvider products={products}>
      <StructuredData data={organizationJsonLd()} />
      <div className="min-h-screen overflow-x-clip bg-background">
        <SiteHeader />
        <main
          id="main-content"
          className="min-w-0 overflow-x-clip pb-[calc(6.25rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          {children}
        </main>
        <SiteFooter />
      </div>
          <CompareBar />
    </CartProvider>
  );
}
