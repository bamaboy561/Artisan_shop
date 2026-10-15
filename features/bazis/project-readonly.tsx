"use client";

import { useMemo, useState } from "react";

import { BazisViewer } from "@/components/bazis/bazis-viewer";
import { guessDecorColor } from "@/features/bazis/decor-color";
import { DrillingSummary } from "@/features/bazis/drilling-summary";
import {
  describeEdgedSides,
  getPartGroupKey,
} from "@/features/bazis/part-groups";
import {
  type BazisViewProject,
  toBazisPartInfo,
} from "@/features/bazis/project-view";

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

// Проект Базиса только для просмотра: макет и список деталей. Нажатие на
// строку показывает на макете, где стоят эти детали.
export function BazisProjectReadonly({
  project,
}: {
  project: BazisViewProject;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const boxes = useMemo(
    () =>
      project.panels.map((panel) => ({
        ...panel.box,
        thickness: panel.thickness,
        tone: panel.material,
        info: toBazisPartInfo(panel, project.materials),
      })),
    [project],
  );
  const toneColors = useMemo(
    () => project.materials.map((name) => guessDecorColor(name)),
    [project],
  );
  const rows = useMemo(() => {
    const groups = new Map<string, number[]>();

    project.panels.forEach((panel, index) => {
      const key = getPartGroupKey(panel);

      groups.set(key, [...(groups.get(key) ?? []), index]);
    });

    return [...groups.entries()]
      .map(([key, indexes]) => ({
        key,
        indexes,
        panel: project.panels[indexes[0]],
      }))
      .sort(
        (left, right) =>
          left.panel.material - right.panel.material ||
          right.panel.length * right.panel.width -
            left.panel.length * left.panel.width,
      );
  }, [project]);
  const highlightBoxes = useMemo(
    () => rows.find((row) => row.key === selected)?.indexes,
    [rows, selected],
  );

  return (
    <div className="grid gap-5">
      <section className="grid gap-2 bg-white p-4 sm:p-5">
        <BazisViewer
          boxes={boxes}
          toneColors={toneColors}
          highlightBoxes={highlightBoxes}
        />
        <p className="text-xs text-[#69716d]">
          Цвет деталей примерный: он подобран по названию материала.
          {selected ? " Выбранные детали выделены." : ""}
        </p>
      </section>

      <section className="grid gap-3 bg-white p-4 sm:p-5">
        <h2 className="text-xl font-semibold text-[#252b29]">
          Детали: {project.panels.length} шт.
        </h2>
        <p className="text-sm text-[#69716d]">
          Нажмите на строку, чтобы увидеть деталь на макете.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#f3f5f3] text-left text-xs text-[#69716d]">
                {["Деталь", "Размер, мм", "Кол-во", "Материал", "Кромка"].map(
                  (heading) => (
                    <th key={heading} className="px-3 py-2 font-medium">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  onClick={() =>
                    setSelected((current) =>
                      current === row.key ? null : row.key,
                    )
                  }
                  className={`cursor-pointer border-b border-[#e1e5e1] transition ${selected === row.key ? "bg-[#f6ece8]" : "hover:bg-[#f7f8f7]"}`}
                >
                  <td className="px-3 py-2 font-medium text-[#252b29]">
                    {row.panel.name}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {numberFormatter.format(row.panel.length)} ×{" "}
                    {numberFormatter.format(row.panel.width)} ×{" "}
                    {numberFormatter.format(row.panel.thickness)}
                  </td>
                  <td className="px-3 py-2">{row.indexes.length}</td>
                  <td className="px-3 py-2">
                    {project.materials[row.panel.material] || "не указан"}
                  </td>
                  <td className="px-3 py-2">
                    {describeEdgedSides(
                      row.panel.edgedLengthSides,
                      row.panel.edgedWidthSides,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DrillingSummary drilling={project.drilling} />

      {project.hardware.length > 0 ? (
        <section className="grid gap-3 bg-white p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-[#252b29]">
            Фурнитура в проекте
          </h2>
          <ul className="grid gap-1 text-sm text-[#252b29] sm:grid-cols-2">
            {project.hardware.map((item) => (
              <li
                key={item.name}
                className="flex justify-between gap-3 border-b border-[#e1e5e1] py-1.5"
              >
                <span>{item.name}</span>
                <span className="font-semibold whitespace-nowrap">
                  {item.quantity} шт.
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
