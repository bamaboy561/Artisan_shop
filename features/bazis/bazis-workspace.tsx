"use client";

import { useMemo, useState } from "react";
import { Eye, Plus, Scissors, Trash2, Upload } from "lucide-react";

import { DownloadCsvButton } from "@/components/admin/download-csv-button";
import { BazisViewer } from "@/components/bazis/bazis-viewer";
import {
  CALCULATOR_DRAFT_KEY,
  type BazisViewProject,
  type BazisViewResponse,
} from "@/features/bazis/project-view";

// Строка списка деталей. panelIndexes связывает её с деталями макета:
// удалили строку, детали пропали с макета.
type Row = {
  id: string;
  name: string;
  length: string;
  width: string;
  quantity: string;
  material: number;
  edgedLengthSides: number;
  edgedWidthSides: number;
  complexContour: boolean;
  textured: boolean;
  panelIndexes: number[];
};

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

const inputClassName =
  "h-9 w-full min-w-0 border border-[#d7d4ce] bg-white px-2 text-sm text-[#252b29] outline-none focus:border-[#a94730]";

function toNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildRows(project: BazisViewProject): Row[] {
  const rows = new Map<string, Row>();

  project.panels.forEach((panel, index) => {
    const key = JSON.stringify([
      panel.name,
      panel.material,
      panel.thickness,
      panel.length,
      panel.width,
      panel.edgedLengthSides,
      panel.edgedWidthSides,
      panel.complexContour,
      panel.textured,
    ]);
    const existing = rows.get(key);

    if (existing) {
      existing.panelIndexes.push(index);
      existing.quantity = String(existing.panelIndexes.length);
    } else {
      rows.set(key, {
        id: `row-${index}`,
        name: panel.name,
        length: String(panel.length),
        width: String(panel.width),
        quantity: "1",
        material: panel.material,
        edgedLengthSides: Math.min(panel.edgedLengthSides, 2),
        edgedWidthSides: Math.min(panel.edgedWidthSides, 2),
        complexContour: panel.complexContour,
        textured: panel.textured,
        panelIndexes: [index],
      });
    }
  });

  return [...rows.values()].sort(
    (left, right) =>
      left.material - right.material ||
      toNumber(right.length) * toNumber(right.width) -
        toNumber(left.length) * toNumber(left.width),
  );
}

export function BazisWorkspace({ catalogBoards }: { catalogBoards: string[] }) {
  const [project, setProject] = useState<BazisViewProject | null>(null);
  const [materials, setMaterials] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  async function openFile(file: File) {
    setLoading(true);
    setError("");

    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/bazis/project", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as BazisViewResponse;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setProject(result.project);
      setMaterials(result.project.materials);
      setRows(buildRows(result.project));
      setHighlight(null);
      setFileName(file.name);
    } catch {
      setError("Не получилось отправить файл. Проверьте интернет и повторите.");
    } finally {
      setLoading(false);
    }
  }

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );

  // Макет показывает детали тех строк, что остались в списке, и красит их
  // по материалу, выбранному в строке. Если размер в строке поменяли,
  // деталь на макете растягивается от своего угла до нового размера.
  const boxes = useMemo(() => {
    if (!project) return [];

    return rows.flatMap((row) =>
      row.panelIndexes.map((index) => {
        const panel = project.panels[index];
        const length = toNumber(row.length) || panel.length;
        const width = toNumber(row.width) || panel.width;
        const lengthAlongX = panel.box.lengthAlongX;

        return {
          ...panel.box,
          sizeX: lengthAlongX ? length : width,
          sizeY: lengthAlongX ? width : length,
          thickness: panel.thickness,
          tone: row.material,
        };
      }),
    );
  }, [project, rows]);

  const materialStats = materials.map((name, index) => {
    const own = rows.filter((row) => row.material === index);

    return {
      name,
      index,
      pieces: own.reduce((sum, row) => sum + toNumber(row.quantity), 0),
      area: own.reduce(
        (sum, row) =>
          sum +
          (toNumber(row.length) *
            toNumber(row.width) *
            toNumber(row.quantity)) /
            1_000_000,
        0,
      ),
    };
  });

  const csv = useMemo(() => {
    const cell = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;

    return [
      [
        "Деталь",
        "Длина, мм",
        "Ширина, мм",
        "Кол-во",
        "Материал",
        "Кромка по длине, сторон",
        "Кромка по ширине, сторон",
      ],
      ...rows.map((row) => [
        row.name,
        row.length,
        row.width,
        row.quantity,
        materials[row.material] ?? "",
        row.edgedLengthSides,
        row.edgedWidthSides,
      ]),
    ]
      .map((line) => line.map(cell).join(";"))
      .join("\n");
  }, [materials, rows]);

  // Передаём детали одного материала в калькулятор распила через его
  // сохранённый черновик и открываем калькулятор.
  function sendToCalculator(materialIndex: number) {
    const details = rows
      .filter(
        (row) =>
          row.material === materialIndex &&
          toNumber(row.length) > 0 &&
          toNumber(row.width) > 0 &&
          toNumber(row.quantity) > 0,
      )
      .map((row, index) => ({
        id: `bazis-${Date.now()}-${index}`,
        title: row.name.slice(0, 120) || "Деталь",
        width: String(Math.round(toNumber(row.length))),
        height: String(Math.round(toNumber(row.width))),
        quantity: String(Math.round(toNumber(row.quantity))),
        edgedSides: [
          ...["top", "bottom"].slice(0, row.edgedLengthSides),
          ...["right", "left"].slice(0, row.edgedWidthSides),
        ],
        // Деталь с текстурой в Базисе нельзя поворачивать при раскрое.
        orientationMode: row.textured ? "fixed" : "free",
      }));

    if (details.length === 0) {
      setError("У этого материала нет деталей с размерами.");
      return;
    }

    try {
      const saved = window.localStorage.getItem(CALCULATOR_DRAFT_KEY);
      const contact = saved
        ? ((JSON.parse(saved) as { contact?: unknown }).contact ?? {})
        : {};

      window.localStorage.setItem(
        CALCULATOR_DRAFT_KEY,
        JSON.stringify({
          details,
          contact,
          savedAt: new Date().toISOString(),
        }),
      );
      window.location.assign("/calculator#cut-calculator");
    } catch {
      setError(
        "Браузер не дал сохранить список. Скачайте его для Excel и вставьте в калькулятор.",
      );
    }
  }

  return (
    <div className="grid gap-5">
      <label className="flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-[#cbc7bf] bg-white px-4 py-8 text-center transition hover:border-[#a94730]">
        <Upload className="size-6 text-[#a94730]" />
        <span className="text-base font-semibold text-[#252b29]">
          {loading
            ? "Читаем проект..."
            : project
              ? "Открыть другой проект"
              : "Выберите файл проекта Базис-Мебельщик (.b3d)"}
        </span>
        <span className="text-xs text-[#69716d]">
          {fileName
            ? `Открыт: ${fileName}`
            : "Файл не сохраняется на сайте, до 4 МБ"}
        </span>
        <input
          type="file"
          accept=".b3d"
          className="sr-only"
          disabled={loading}
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) void openFile(file);
            event.target.value = "";
          }}
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      {project ? (
        <>
          <section className="grid gap-3 bg-white p-4 sm:p-5">
            <h2 className="text-xl font-semibold text-[#252b29]">
              {project.orderName || "Проект"}: макет
            </h2>
            <BazisViewer boxes={boxes} highlightTone={highlight} />
          </section>

          <section className="grid gap-3 bg-white p-4 sm:p-5">
            <h2 className="text-xl font-semibold text-[#252b29]">Материалы</h2>
            <p className="text-sm text-[#69716d]">
              Материал можно заменить: начните вводить название плиты из нашего
              каталога или впишите своё.
            </p>
            <datalist id="bazis-catalog-boards">
              {catalogBoards.map((board) => (
                <option key={board} value={board} />
              ))}
            </datalist>
            <div className="grid gap-3">
              {materialStats.map((material) => (
                <div
                  key={material.index}
                  className="grid gap-2 border border-[#e1e5e1] p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center"
                >
                  <input
                    value={material.name}
                    list="bazis-catalog-boards"
                    aria-label={`Материал ${material.index + 1}`}
                    className={inputClassName}
                    onChange={(event) =>
                      setMaterials((current) =>
                        current.map((name, index) =>
                          index === material.index ? event.target.value : name,
                        ),
                      )
                    }
                  />
                  <p className="text-sm whitespace-nowrap text-[#69716d]">
                    {numberFormatter.format(material.pieces)} дет. ·{" "}
                    {numberFormatter.format(material.area)} м²
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setHighlight((current) =>
                        current === material.index ? null : material.index,
                      )
                    }
                    aria-pressed={highlight === material.index}
                    className={`inline-flex h-9 items-center justify-center gap-2 border px-3 text-sm font-medium transition ${highlight === material.index ? "border-[#a94730] bg-[#a94730] text-white" : "border-[#cbc7bf] bg-white text-[#252b29] hover:border-[#252b29]"}`}
                  >
                    <Eye className="size-4" />
                    {highlight === material.index
                      ? "Показать все"
                      : "Показать на макете"}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendToCalculator(material.index)}
                    disabled={material.pieces === 0}
                    className="inline-flex h-9 items-center justify-center gap-2 bg-[#252b29] px-3 text-sm font-semibold text-white transition hover:bg-[#a94730] disabled:opacity-40"
                  >
                    <Scissors className="size-4" />
                    Рассчитать раскрой
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#69716d]">
              «Рассчитать раскрой» открывает калькулятор с деталями этого
              материала. Плиту и кромку для расчёта цены выберите уже там.
            </p>
          </section>

          <section className="grid gap-3 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#252b29]">
                Детали: {rows.length} строк
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      {
                        id: `new-${Date.now()}`,
                        name: "Новая деталь",
                        length: "",
                        width: "",
                        quantity: "1",
                        material: 0,
                        edgedLengthSides: 0,
                        edgedWidthSides: 0,
                        complexContour: false,
                        textured: false,
                        panelIndexes: [],
                      },
                    ])
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 border border-[#cbc7bf] bg-white px-4 text-sm font-medium text-[#252b29] transition hover:border-[#252b29]"
                >
                  <Plus className="size-4" />
                  Добавить деталь
                </button>
                <DownloadCsvButton
                  csvContent={csv}
                  fileName="bazis-detali.csv"
                />
              </div>
            </div>
            <p className="text-sm text-[#69716d]">
              Размеры указаны для готовой детали. Всё в списке можно править:
              название, размеры, количество, материал и кромку. Новый размер
              сразу виден на макете: деталь меняется от своего угла, соседние
              детали остаются на месте.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f3f5f3] text-left text-xs text-[#69716d]">
                    {[
                      "Деталь",
                      "Длина, мм",
                      "Ширина, мм",
                      "Кол-во",
                      "Материал",
                      "Кромка по длине",
                      "Кромка по ширине",
                      "",
                    ].map((heading, index) => (
                      <th key={index} className="px-2 py-2 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-[#e1e5e1]">
                      <td className="min-w-60 px-1 py-1.5">
                        <input
                          value={row.name}
                          aria-label="Название детали"
                          className={inputClassName}
                          onChange={(event) =>
                            updateRow(row.id, { name: event.target.value })
                          }
                        />
                        {row.complexContour ? (
                          <span className="mt-0.5 block text-[11px] text-[#a94730]">
                            Сложный контур: размер по габариту
                          </span>
                        ) : null}
                      </td>
                      {(["length", "width", "quantity"] as const).map(
                        (field) => (
                          <td key={field} className="w-24 px-1 py-1.5">
                            <input
                              value={row[field]}
                              inputMode="decimal"
                              aria-label={
                                field === "length"
                                  ? "Длина"
                                  : field === "width"
                                    ? "Ширина"
                                    : "Количество"
                              }
                              className={inputClassName}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  [field]: event.target.value,
                                })
                              }
                            />
                          </td>
                        ),
                      )}
                      <td className="min-w-44 px-1 py-1.5">
                        <select
                          value={row.material}
                          aria-label="Материал детали"
                          className={inputClassName}
                          onChange={(event) =>
                            updateRow(row.id, {
                              material: Number(event.target.value),
                            })
                          }
                        >
                          {materials.map((name, index) => (
                            <option key={index} value={index}>
                              {name || `Материал ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </td>
                      {(["edgedLengthSides", "edgedWidthSides"] as const).map(
                        (field) => (
                          <td key={field} className="w-32 px-1 py-1.5">
                            <select
                              value={row[field]}
                              aria-label={
                                field === "edgedLengthSides"
                                  ? "Кромка по длине"
                                  : "Кромка по ширине"
                              }
                              className={inputClassName}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  [field]: Number(event.target.value),
                                })
                              }
                            >
                              <option value={0}>нет</option>
                              <option value={1}>1 сторона</option>
                              <option value={2}>2 стороны</option>
                            </select>
                          </td>
                        ),
                      )}
                      <td className="w-10 px-1 py-1.5">
                        <button
                          type="button"
                          aria-label={`Удалить деталь ${row.name}`}
                          title="Удалить"
                          onClick={() =>
                            setRows((current) =>
                              current.filter((item) => item.id !== row.id),
                            )
                          }
                          className="grid size-9 place-items-center text-[#69716d] transition hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

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
        </>
      ) : null}
    </div>
  );
}
