import type { Metadata } from "next";

import { BazisWorkspace } from "@/features/bazis/bazis-workspace";
import { getCalculatorBundle } from "@/lib/server/calculator-config";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Проект Базис-Мебельщик онлайн: макет, детали и раскрой",
  description:
    "Откройте проект Базис-Мебельщик (.b3d) прямо на сайте Artisan: объёмный макет, список деталей с кромкой, замена материала и расчёт раскроя в Бишкеке.",
  path: "/bazis",
});

export default async function BazisPage() {
  const bundle = await getCalculatorBundle();
  const seenLabels = new Set<string>();
  const catalogBoards = bundle.presets
    .filter((preset) => {
      if (!preset.label || seenLabels.has(preset.label)) return false;
      seenLabels.add(preset.label);
      return true;
    })
    .map((preset) => ({ id: preset.id, label: preset.label }));

  return (
    <div className="bg-[var(--surface)]">
      <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12 lg:px-10">
        <h1 className="max-w-[16ch] text-[clamp(32px,4.2vw,56px)] leading-[1.04] font-medium tracking-[-0.03em] text-balance text-[var(--foreground)]">
          Откройте проект Базис-Мебельщика прямо на сайте
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-[1.6] text-[var(--muted)]">
          Загрузите файл .b3d: увидите макет, который можно покрутить, список
          деталей с размерами и кромкой, фурнитуру. Материал и детали можно
          поменять и сразу отправить в расчёт раскроя.
        </p>
        <div className="mt-6">
          <BazisWorkspace catalogBoards={catalogBoards} />
        </div>
      </section>
    </div>
  );
}
