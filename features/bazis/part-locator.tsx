"use client";

import { useMemo, useState } from "react";

import { BazisViewer } from "@/components/bazis/bazis-viewer";
import {
  describeEdgedSides,
  findSameParts,
} from "@/features/bazis/part-groups";
import {
  type BazisViewProject,
  toBazisPartInfo,
} from "@/features/bazis/project-view";

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

// Страница из QR-кода на детали: что это за деталь и где она стоит.
export function PartLocator({
  project,
  panelIndex,
}: {
  project: BazisViewProject;
  panelIndex: number;
}) {
  const panel = project.panels[panelIndex];
  // Каждое нажатие «Показать ещё раз» запускает анимацию заново.
  const [replay, setReplay] = useState(0);
  const sameParts = useMemo(
    () => findSameParts(project.panels, panelIndex),
    [project, panelIndex],
  );
  const boxes = useMemo(
    () =>
      project.panels.map((item) => ({
        ...item.box,
        thickness: item.thickness,
        tone: item.material,
        info: toBazisPartInfo(item, project.materials),
      })),
    [project],
  );

  if (!panel) {
    return null;
  }

  const facts = [
    [
      "Размер",
      `${numberFormatter.format(panel.length)} × ${numberFormatter.format(panel.width)} × ${numberFormatter.format(panel.thickness)} мм`,
    ],
    ["Материал", project.materials[panel.material] || "не указан"],
    [
      "Кромка, сторон",
      describeEdgedSides(panel.edgedLengthSides, panel.edgedWidthSides),
    ],
    ...(panel.block ? [["Входит в", panel.block]] : []),
    ...(panel.position ? [["Позиция в проекте", `№ ${panel.position}`]] : []),
  ];

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
          {project.orderName || "Проект"}
        </p>
        <h1 className="mt-1 text-2xl leading-tight font-semibold text-[var(--foreground)] sm:text-3xl">
          {panel.name}
        </h1>
      </div>

      <dl className="grid gap-x-6 gap-y-2 bg-[var(--surface-strong)] p-4 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 sm:block">
            <dt className="text-[var(--muted)]">{label}</dt>
            <dd className="text-right font-semibold text-[var(--foreground)] sm:text-left">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-2 bg-[var(--surface-strong)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {sameParts.length > 1
              ? `Таких деталей в изделии ${sameParts.length}. Деталь подходит в любое из выделенных мест.`
              : "Место детали в изделии выделено цветом."}
          </p>
          <button
            type="button"
            onClick={() => setReplay((current) => current + 1)}
            className="inline-flex h-9 items-center justify-center bg-[var(--accent-strong)] px-3 text-sm font-semibold text-[var(--accent-ink)] transition hover:bg-[#8c3a26]"
          >
            Показать ещё раз
          </button>
        </div>
        <BazisViewer
          boxes={boxes}
          joints={project.joints}
          highlightBoxes={sameParts}
          animationKey={replay}
          defaultSelected={panelIndex}
          defaultExploded
          heightClassName="h-[62vh] min-h-80"
        />
      </div>
    </div>
  );
}
