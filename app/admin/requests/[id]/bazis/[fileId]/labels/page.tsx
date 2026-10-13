import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";

import { PrintRouteSheetButton } from "@/components/admin/print-route-sheet-button";
import { describeEdgedSides } from "@/features/bazis/part-groups";
import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessRequestType } from "@/lib/auth/roles";
import { BazisParseError, parseBazisProject } from "@/lib/bazis-b3d";
import { getSiteUrl } from "@/lib/seo";
import {
  BAZIS_PART_LINK_DAYS,
  createBazisPartToken,
} from "@/lib/server/bazis-part-link";
import { getOrCreateBazisProjectCode } from "@/lib/server/bazis-project-code";
import { readRequestFileBytes } from "@/lib/server/request-file-content";
import { getRequestDetailById } from "@/lib/server/request-inbox";

export const dynamic = "force-dynamic";

type LabelsPageProps = {
  params: Promise<{ id: string; fileId: string }>;
  searchParams: Promise<{ format?: string }>;
};

type Label = {
  key: string;
  name: string;
  size: string;
  material: string;
  edges: string;
  block: string;
  position: string;
  copy: number;
  copies: number;
  qrSvg: string;
};

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

export default async function BazisLabelsPage({
  params,
  searchParams,
}: LabelsPageProps) {
  const { id, fileId } = await params;
  // Термопринтер с наклейками 58 × 80 мм или лист А4 с этикетками 70 × 37.
  const thermal = (await searchParams).format !== "a4";
  const session = await requireAdminSession(
    "/login?next=/admin/requests",
    `/admin/requests/${id}/bazis/${fileId}/labels`,
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
  const labels: Label[] = [];
  let orderName = file.fileName;
  let problem = "";

  if (!bytes) {
    problem = "Не удалось открыть файл из хранилища.";
  } else {
    try {
      const project = parseBazisProject(bytes);
      const siteUrl = getSiteUrl();
      // Одинаковые детали получают один QR-код: на макете он показывает все
      // места, куда такая деталь подходит.
      const groups = new Map<string, number[]>();

      orderName = project.orderName || project.modelName || file.fileName;

      project.panels.forEach((panel, index) => {
        const lengthSides = panel.edges.filter(
          (edge) => edge.side === "length",
        ).length;
        const widthSides = panel.edges.filter(
          (edge) => edge.side === "width",
        ).length;
        const key = JSON.stringify([
          panel.name,
          panel.material,
          panel.thickness,
          panel.length,
          panel.width,
          lengthSides,
          widthSides,
        ]);

        groups.set(key, [...(groups.get(key) ?? []), index]);
      });

      const sorted = [...groups.entries()].sort(([, left], [, right]) => {
        const a = project.panels[left[0]];
        const b = project.panels[right[0]];

        return (
          a.block.localeCompare(b.block, "ru") ||
          b.length * b.width - a.length * a.width ||
          a.name.localeCompare(b.name, "ru")
        );
      });

      for (const [key, indexes] of sorted) {
        const panel = project.panels[indexes[0]];
        const qrSvg = await QRCode.toString(
          `${siteUrl}/d/${createBazisPartToken({
            requestId: request.id,
            fileId: file.id,
            panelIndex: indexes[0],
          })}`,
          { type: "svg", margin: 0, errorCorrectionLevel: "M" },
        );

        indexes.forEach((_, copyIndex) => {
          labels.push({
            key: `${key}-${copyIndex}`,
            name: panel.name,
            size: `${numberFormatter.format(panel.length)} × ${numberFormatter.format(panel.width)} × ${numberFormatter.format(panel.thickness)}`,
            material: panel.material,
            edges: describeEdgedSides(
              panel.edges.filter((edge) => edge.side === "length").length,
              panel.edges.filter((edge) => edge.side === "width").length,
            ),
            block: panel.block,
            position: panel.position,
            copy: copyIndex + 1,
            copies: indexes.length,
            qrSvg,
          });
        });
      }
    } catch (error) {
      problem =
        error instanceof BazisParseError
          ? error.message
          : "Не удалось прочитать проект.";
    }
  }

  const requestNumber = request.number ?? request.id.slice(0, 8).toUpperCase();
  const projectCode =
    labels.length > 0
      ? await getOrCreateBazisProjectCode(request.id, file.id).catch(
          (error) => {
            console.error("[bazis:project-code]", error);
            return null;
          },
        )
      : null;
  const basePath = `/admin/requests/${request.id}/bazis/${file.id}/labels`;

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-[#171714] print:max-w-none">
      {/* Термопринтер: одна наклейка 58 × 80 мм на страницу. Лист А4 без
          полей: 3 этикетки 70 × 37 мм в ряд, 8 рядов. */}
      <style>
        {thermal
          ? `@media print { @page { size: 58mm 80mm; margin: 0; } }`
          : `@media print { @page { size: A4; margin: 0; } }`}
      </style>

      <div className="mb-4 grid gap-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/admin/requests/${request.id}/bazis/${file.id}`}
            className="inline-flex h-10 items-center gap-2 border border-[color:var(--line-strong)] px-4 text-sm font-medium transition hover:border-[color:var(--foreground)]"
          >
            <ArrowLeft className="size-4" />К проекту
          </Link>
          {labels.length > 0 ? <PrintRouteSheetButton /> : null}
        </div>
        <div className="border border-[color:var(--line-strong)] bg-[#faf8f4] p-4 text-sm leading-6">
          <p className="font-semibold">
            Этикетки для сборки: {orderName} · заявка {requestNumber} ·{" "}
            {labels.length} шт.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { href: basePath, label: "Термопринтер 58 × 80 мм", on: thermal },
              {
                href: `${basePath}?format=a4`,
                label: "Лист А4, этикетки 70 × 37 мм",
                on: !thermal,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-9 items-center border px-3 text-sm font-medium transition ${item.on ? "border-[color:var(--foreground)] bg-[var(--foreground)] text-white" : "border-[color:var(--line-strong)] bg-white hover:border-[color:var(--foreground)]"}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-[var(--muted)]">
            {thermal
              ? "Одна наклейка 58 × 80 мм на деталь. В окне печати выберите термопринтер, размер бумаги 58 × 80 мм, масштаб 100%, поля «нет»."
              : "Самоклеящаяся бумага А4 с этикетками 70 × 37 мм (24 на листе), масштаб 100%, поля «нет»."}{" "}
            Сборщик наводит камеру телефона на код и видит, где деталь стоит в
            изделии. Одинаковые детали имеют одинаковый код. Код работает{" "}
            {BAZIS_PART_LINK_DAYS} день со дня, когда открыта эта страница.
          </p>
        </div>
      </div>

      {projectCode ? (
        <div className="mb-4 border border-[color:var(--line-strong)] bg-white p-4 text-sm leading-6 print:hidden">
          <p className="font-semibold">
            Если этикетки печатает GibLab — код проекта:{" "}
            <span className="ml-1 bg-[#252b29] px-2 py-1 font-mono text-base tracking-[0.2em] text-white">
              {projectCode.code}
            </span>
          </p>
          <p className="mt-2 text-[var(--muted)]">
            Впишите этот код в название проекта в GibLab, без пробелов внутри
            кода. Например: «{requestNumber}_{projectCode.code}». Тогда QR-код
            на этикетке GibLab откроет ту же страницу детали. Код действует до{" "}
            {new Intl.DateTimeFormat("ru-RU", {
              timeZone: "Asia/Bishkek",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(projectCode.expiresAt)}
            .
          </p>
        </div>
      ) : null}

      {problem ? (
        <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {problem}
        </p>
      ) : null}

      <div
        className={
          thermal ? "flex flex-wrap gap-3 print:block" : "grid grid-cols-3"
        }
      >
        {labels.map((label) => (
          <div
            key={label.key}
            className={
              thermal
                ? "flex h-[80mm] w-[58mm] break-after-page flex-col items-center gap-[2mm] overflow-hidden border border-dashed border-[#cbc7bf] p-[3mm] print:border-0"
                : "flex h-[37mm] w-[70mm] break-inside-avoid items-center gap-[2mm] overflow-hidden border border-dashed border-[#cbc7bf] p-[2.5mm] print:border-0"
            }
          >
            <div
              className={`shrink-0 [&>svg]:size-full ${thermal ? "size-[40mm]" : "size-[27mm]"}`}
              dangerouslySetInnerHTML={{ __html: label.qrSvg }}
            />
            <div
              className={`min-w-0 leading-[1.25] ${thermal ? "w-full text-[8.5pt]" : "text-[7.5pt]"}`}
            >
              <p
                className={`line-clamp-2 leading-[1.15] font-bold ${thermal ? "text-[11pt]" : "text-[9pt]"}`}
              >
                {label.name}
              </p>
              <p className="mt-[0.6mm] font-semibold whitespace-nowrap">
                {label.size}
              </p>
              <p className="truncate">{label.material}</p>
              <p className="truncate">Кромка: {label.edges}</p>
              {label.block ? <p className="truncate">{label.block}</p> : null}
              <p className="truncate text-[6.5pt] text-[#55524c]">
                {[
                  label.position ? `поз. ${label.position}` : "",
                  label.copies > 1 ? `${label.copy} из ${label.copies}` : "",
                  requestNumber,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
