"use client";

import { useDeferredValue, useMemo } from "react";

import { useSiteCuttingPrices } from "@/features/cutting/site-prices-context";
import type { CabinetPart } from "@/features/services/cabinet-builder";
import type { ConstructorDecor } from "@/lib/server/constructor-decors";

import { addEstimates, estimateParts } from "./estimate";

const plate = (decor: ConstructorDecor | undefined) =>
  decor
    ? {
        pricePerSqM: decor.pricePerSqM,
        sheetWidth: decor.sheetWidth,
        sheetHeight: decor.sheetHeight,
      }
    : null;

// Примерная цена изделия. Раскрой листов считается после ввода: поля и
// макет не ждут подсчёта. Корпус и фасады разного цвета — две плиты.
export function useEstimate({
  parts,
  isFacade,
  thickness,
  bodyDecor,
  facadeDecor,
  sameDecor,
}: {
  parts: CabinetPart[];
  isFacade: (part: CabinetPart) => boolean;
  thickness: number;
  bodyDecor: ConstructorDecor | undefined;
  facadeDecor: ConstructorDecor | undefined;
  sameDecor: boolean;
}) {
  const prices = useSiteCuttingPrices();
  const deferredParts = useDeferredValue(parts);
  return useMemo(() => {
    if (sameDecor) {
      return estimateParts(deferredParts, thickness, plate(bodyDecor), prices);
    }
    const bodyParts = deferredParts.filter((part) => !isFacade(part));
    const facadeParts = deferredParts.filter(isFacade);
    const body = estimateParts(bodyParts, thickness, plate(bodyDecor), prices);
    const facade = estimateParts(
      facadeParts,
      thickness,
      plate(facadeDecor),
      prices,
    );
    // Одна из плит без цены — лучше не показывать сумму ниже настоящей.
    if ((bodyParts.length && !body) || (facadeParts.length && !facade)) {
      return null;
    }
    return addEstimates(body, facade);
  }, [
    deferredParts,
    isFacade,
    thickness,
    bodyDecor,
    facadeDecor,
    sameDecor,
    prices,
  ]);
}
