import { CuttingStage, ProductionStation } from "@/generated/prisma";

export type ProductionTransition = {
  from: CuttingStage;
  to: CuttingStage;
  label: string;
  requiresPickupCell?: boolean;
};

export const productionStationStages: Record<
  ProductionStation,
  CuttingStage[]
> = {
  [ProductionStation.CUTTING]: [
    CuttingStage.ACCEPTED,
    CuttingStage.CUTTING,
  ],
  [ProductionStation.EDGING]: [CuttingStage.EDGING],
  [ProductionStation.DRILLING]: [CuttingStage.DRILLING],
};

export function getProductionTransition(
  station: ProductionStation,
  stage: CuttingStage | null | undefined,
): ProductionTransition | null {
  const currentStage = stage ?? CuttingStage.ACCEPTED;

  if (
    station === ProductionStation.CUTTING &&
    currentStage === CuttingStage.ACCEPTED
  ) {
    return {
      from: CuttingStage.ACCEPTED,
      to: CuttingStage.CUTTING,
      label: "Начать распил",
    };
  }

  if (
    station === ProductionStation.CUTTING &&
    currentStage === CuttingStage.CUTTING
  ) {
    return {
      from: CuttingStage.CUTTING,
      to: CuttingStage.EDGING,
      label: "Передать на кромку",
    };
  }

  if (
    station === ProductionStation.EDGING &&
    currentStage === CuttingStage.EDGING
  ) {
    return {
      from: CuttingStage.EDGING,
      to: CuttingStage.DRILLING,
      label: "Передать на присадку",
    };
  }

  if (
    station === ProductionStation.DRILLING &&
    currentStage === CuttingStage.DRILLING
  ) {
    return {
      from: CuttingStage.DRILLING,
      to: CuttingStage.READY_FOR_PICKUP,
      label: "Готово к выдаче",
      requiresPickupCell: true,
    };
  }

  return null;
}
