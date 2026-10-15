/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DownloadCsvButton } from "@/components/admin/download-csv-button";
import { BazisViewer } from "@/components/bazis/bazis-viewer";
import { describeEdgedSides } from "@/features/bazis/part-groups";
import { PrintRouteSheetButton } from "@/components/admin/print-route-sheet-button";
import {
  drillingDiameter,
  formatDrillingRow,
} from "@/features/bazis/drilling-summary";
import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessRequestType } from "@/lib/auth/roles";
import {
  BazisParseError,
  parseBazisProject,
  type BazisPartRow,
  type BazisProject,
} from "@/lib/bazis-b3d";
import { readRequestFileBytes } from "@/lib/server/request-file-content";
import { getRequestDetailById } from "@/lib/server/request-inbox";

export const dynamic = "force-dynamic";

type BazisProjectPageProps = {
  params: Promise<{ id: string; fileId: string }>;
};

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

function describeEdges(row: BazisPartRow) {
  const parts = [
    row.edgedLengthSides > 0 ? `по длине: ${row.edgedLengthSides}` : "",
    row.edgedWidthSides > 0 ? `по ширине: ${row.edgedWidthSides}` : "",
  ].filter(Boolean);

  if (parts.length === 0) {
    return row.edgeMaterial
      ? `сторона не определена · ${row.edgeMaterial}`
      : "";
  }

  return [parts.join(", "), row.edgeMaterial].filter(Boolean).join(" · ");
}

function buildCsv(rows: BazisPartRow[]) {
  const cell = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;

  return [
    [
      "Деталь",
      "Длина, мм",
      "Ширина, мм",
      "Кол-во",
      "Материал",
      "Толщина, мм",
      "Кромка по длине, сторон",
      "Кромка по ширине, сторон",
      "Кромка",
      "Примечание",
    ],
    ...rows.map((row) => [
      row.name,
      row.length,
      row.width,
      row.quantity,
      row.material,
      row.thickness,
      row.edgedLengthSides,
      row.edgedWidthSides,
      row.edgeMaterial,
      row.complexContour ? "сложный контур, проверьте" : "",
    ]),
  ]
    .map((line) => line.map(cell).join(";"))
    .join("\n");
}

export default async function BazisProjectPage({
  params,
}: BazisProjectPageProps) {
  const { id, fileId } = await params;
  const session = await requireAdminSession(
    "/login?next=/admin/requests",
    `/admin/requests/${id}/bazis/${fileId}`,
  );
  const request = await getRequestDetailById(id);
  const file = request?.files.find((item) => item.id === fileId);

  if (
    !request ||
    !file ||
    !/\.b3d$/i.test(file.fileName) ||
    !canAccessRequestType(session.roleCode, request.type)
  ) {
    notFound();
  }

  const bytes = await readRequestFileBytes(file.fileUrl);
  let project: BazisProject | null = null;
  let problem = "";

  if (!bytes) {
    problem = "Не удалось открыть файл из хранилища.";
  } else {
    try {
      project = parseBazisProject(bytes);
    } catch (error) {
      problem =
        error instanceof BazisParseError
          ? error.message
          : "Не удалось прочитать проект.";
    }
  }

  const requestNumber = request.number ?? request.id.slice(0, 8).toUpperCase();
  // Vercel Blob отдаёт файл на скачивание, если добавить ?download=1.
  const downloadHref = /^https:\/\//.test(file.fileUrl)
    ? `${file.fileUrl}${file.fileUrl.includes("?") ? "&" : "?"}download=1`
    : file.fileUrl;
  const viewerMaterials = [
    ...new Set(project?.panels.map((panel) => panel.material) ?? []),
  ];
  const totalParts =
    project?.rows.reduce((sum, row) => sum + row.quantity, 0) ?? 0;
  const areaByMaterial = new Map<string, number>();

  for (const row of project?.rows ?? []) {
    const key = `${row.material || "Материал не указан"}, ${numberFormatter.format(row.thickness)} мм`;

    areaByMaterial.set(
      key,
      (areaByMaterial.get(key) ?? 0) +
        (row.length * row.width * row.quantity) / 1_000_000,
    );
  }

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-[#171714] print:max-w-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/requests/${request.id}`}
          className="inline-flex h-10 items-center gap-2 border border-[color:var(--line-strong)] px-4 text-sm font-medium transition hover:border-[color:var(--foreground)]"
        >
          <ArrowLeft className="size-4" />К заявке
        </Link>
        <div className="flex flex-wrap gap-2">
          <a
            href={downloadHref}
            download={file.fileName}
            className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] bg-white px-4 text-sm font-medium text-[var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent)]"
          >
            Скачать файл Базиса
          </a>
          {project ? (
            <>
              <a
                href={`/admin/requests/${request.id}/bazis/${file.id}/giblab`}
                className="inline-flex h-11 items-center justify-center bg-[var(--foreground)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
              >
                Скачать для GibLab (.project)
              </a>
              <Link
                href={`/admin/requests/${request.id}/bazis/${file.id}/labels`}
                className="inline-flex h-11 items-center justify-center border border-[color:var(--line-strong)] bg-white px-4 text-sm font-medium text-[var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent)]"
              >
                Этикетки с QR для сборки
              </Link>
              <DownloadCsvButton
                csvContent={buildCsv(project.rows)}
                fileName={`bazis-${requestNumber}.csv`}
              />
              <PrintRouteSheetButton />
            </>
          ) : null}
        </div>
      </div>

      {project && project.panels.length > 0 ? (
        <section className="mb-4 print:hidden">
          <BazisViewer
            boxes={project.panels.map((panel) => ({
              ...panel.box,
              thickness: panel.thickness,
              tone: viewerMaterials.indexOf(panel.material),
              info: {
                name: panel.name,
                position: panel.position,
                material: panel.material,
                length: panel.length,
                width: panel.width,
                thickness: panel.thickness,
                edges: describeEdgedSides(
                  panel.edges.filter((edge) => edge.side === "length").length,
                  panel.edges.filter((edge) => edge.side === "width").length,
                ),
                edgeMaterial: [
                  ...new Set(
                    panel.edges.map((edge) => edge.material).filter(Boolean),
                  ),
                ].join(", "),
                block: panel.block,
                textured: panel.textured,
                complexContour: panel.complexContour,
                holes: panel.holes,
              },
            }))}
          />
        </section>
      ) : null}

      <article className="border border-[#cbc7bf] bg-white p-[10mm] shadow-sm print:border-0 print:p-[8mm] print:shadow-none">
        <header className="flex items-start justify-between gap-[8mm] border-b-2 border-[#171714] pb-[5mm]">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase">
              Проект Базис-Мебельщик
            </p>
            <h1 className="mt-2 text-[22px] leading-tight font-bold break-words">
              {project?.orderName || project?.modelName || file.fileName}
            </h1>
            <p className="mt-2 text-[11px] text-[#625f59]">
              Заявка {requestNumber} · {request.contactName} · файл{" "}
              {file.fileName}
            </p>
          </div>
          {project?.thumbnailPng ? (
            <img
              src={`data:image/png;base64,${project.thumbnailPng.toString("base64")}`}
              alt="Вид проекта"
              className="size-[46mm] shrink-0 border border-[#d7d4ce] object-contain"
            />
          ) : null}
        </header>

        {problem ? (
          <p className="mt-[6mm] border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
            {problem} Файл можно скачать из карточки заявки и открыть в Базисе.
          </p>
        ) : null}

        {project ? (
          <>
            <section className="mt-[5mm] grid gap-[2mm] text-[11px]">
              <p>
                <span className="text-[#77736c]">Деталей: </span>
                <strong>{totalParts}</strong> в {project.rows.length} строках
              </p>
              {[...areaByMaterial.entries()].map(([material, area]) => (
                <p key={material}>
                  <span className="text-[#77736c]">{material}: </span>
                  <strong>{numberFormatter.format(area)} м²</strong> деталей
                </p>
              ))}
              {project.materials.length > 0 ? (
                <p className="text-[#625f59]">
                  Материалы проекта: {project.materials.join("; ")}
                </p>
              ) : null}
            </section>

            <table className="mt-[5mm] w-full border-collapse border border-[#bdb9b1] text-[9px] leading-[1.4]">
              <thead>
                <tr className="bg-[#f0eeea] text-left">
                  {[
                    "№",
                    "Деталь",
                    "Длина",
                    "Ширина",
                    "Кол-во",
                    "Материал",
                    "Кромка",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border border-[#bdb9b1] px-1.5 py-1 font-semibold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {project.rows.map((row, index) => (
                  <tr key={index} className="break-inside-avoid">
                    <td className="border border-[#d7d4ce] px-1.5 py-1">
                      {index + 1}
                    </td>
                    <td className="border border-[#d7d4ce] px-1.5 py-1">
                      {row.name}
                      {row.complexContour ? (
                        <span className="font-semibold text-[#a94730]">
                          {" "}
                          · сложный контур, проверьте
                        </span>
                      ) : null}
                    </td>
                    <td className="border border-[#d7d4ce] px-1.5 py-1 text-right font-semibold whitespace-nowrap">
                      {numberFormatter.format(row.length)}
                    </td>
                    <td className="border border-[#d7d4ce] px-1.5 py-1 text-right font-semibold whitespace-nowrap">
                      {numberFormatter.format(row.width)}
                    </td>
                    <td className="border border-[#d7d4ce] px-1.5 py-1 text-center font-semibold">
                      {row.quantity}
                    </td>
                    <td className="border border-[#d7d4ce] px-1.5 py-1">
                      {row.material}, {numberFormatter.format(row.thickness)} мм
                    </td>
                    <td className="border border-[#d7d4ce] px-1.5 py-1">
                      {describeEdges(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-[3mm] text-[8px] leading-4 text-[#8a857d]">
              Список получен из файла проекта автоматически. Размеры указаны для
              готовой детали, как в проекте. Перед раскроем сверьте с проектом,
              особенно детали со сложным контуром.
            </p>

            {project.drilling.holes > 0 ? (
              <section className="mt-[6mm] break-inside-avoid">
                <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
                  Присадка: {project.drilling.holes} отв.
                </h2>
                <table className="mt-2 w-full border-collapse border border-[#bdb9b1] text-[9px] leading-[1.4]">
                  <thead>
                    <tr className="bg-[#f0eeea] text-left">
                      <th className="border border-[#bdb9b1] px-1.5 py-1 font-semibold">
                        Диаметр
                      </th>
                      <th className="border border-[#bdb9b1] px-1.5 py-1 font-semibold">
                        Куда
                      </th>
                      <th className="w-[20mm] border border-[#bdb9b1] px-1.5 py-1 text-right font-semibold">
                        Кол-во
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.drilling.rows.map((row) => (
                      <tr key={row.diameter} className="break-inside-avoid">
                        <td className="border border-[#d7d4ce] px-1.5 py-1">
                          {drillingDiameter(row.diameter)}
                        </td>
                        <td className="border border-[#d7d4ce] px-1.5 py-1">
                          {formatDrillingRow(row)}
                        </td>
                        <td className="border border-[#d7d4ce] px-1.5 py-1 text-right font-semibold">
                          {row.face + row.edge}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            {project.hardware.length > 0 ? (
              <section className="mt-[6mm] break-inside-avoid">
                <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
                  Фурнитура в проекте
                </h2>
                <table className="mt-2 w-full border-collapse border border-[#bdb9b1] text-[9px] leading-[1.4]">
                  <thead>
                    <tr className="bg-[#f0eeea] text-left">
                      <th className="border border-[#bdb9b1] px-1.5 py-1 font-semibold">
                        Наименование
                      </th>
                      <th className="w-[20mm] border border-[#bdb9b1] px-1.5 py-1 text-right font-semibold">
                        Кол-во
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.hardware.map((item) => (
                      <tr key={item.name} className="break-inside-avoid">
                        <td className="border border-[#d7d4ce] px-1.5 py-1">
                          {item.name}
                        </td>
                        <td className="border border-[#d7d4ce] px-1.5 py-1 text-right font-semibold">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
          </>
        ) : null}
      </article>
    </div>
  );
}
