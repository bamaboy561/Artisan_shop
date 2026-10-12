import { CuttingStage } from "@/generated/prisma";

export const cuttingStageSteps = [
  {
    stage: CuttingStage.ACCEPTED,
    label: "Принят в обработку",
    description: "Заявка подтверждена и поставлена в производственную очередь.",
  },
  {
    stage: CuttingStage.CUTTING,
    label: "На станции распила",
    description: "Детали раскраиваются по утвержденной карте.",
  },
  {
    stage: CuttingStage.EDGING,
    label: "На станции кромки",
    description: "На подготовленные детали наносится кромка.",
  },
  {
    stage: CuttingStage.DRILLING,
    label: "На присадке",
    description: "Выполняются сверление и присадка деталей.",
  },
  {
    stage: CuttingStage.READY_FOR_PICKUP,
    label: "Готов к выдаче",
    description: "Заказ проверен и ожидает выдачи клиенту.",
  },
] as const;

export const cuttingStageLabels: Record<CuttingStage, string> =
  Object.fromEntries(
    cuttingStageSteps.map((step) => [step.stage, step.label]),
  ) as Record<CuttingStage, string>;

export function getCuttingStageIndex(stage: CuttingStage | null | undefined) {
  return cuttingStageSteps.findIndex((step) => step.stage === stage);
}
