import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CartProvider } from "@/components/providers/cart-provider";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
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
    </CartProvider>
  );
}
