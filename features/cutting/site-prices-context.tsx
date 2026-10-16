"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import {
  defaultSiteCuttingPrices,
  type SiteCuttingPrices,
} from "@/features/cutting/site-prices";

const SiteCuttingPricesContext = createContext<SiteCuttingPrices>(
  defaultSiteCuttingPrices,
);

// Цены из «Прайс работ» для калькулятора и присадки в браузере.
export function SiteCuttingPricesProvider({
  prices,
  children,
}: {
  prices: SiteCuttingPrices;
  children: ReactNode;
}) {
  return (
    <SiteCuttingPricesContext value={prices}>
      {children}
    </SiteCuttingPricesContext>
  );
}

export function useSiteCuttingPrices() {
  return useContext(SiteCuttingPricesContext);
}
