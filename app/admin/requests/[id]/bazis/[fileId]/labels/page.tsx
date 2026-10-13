import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";

import { PrintRouteSheetButton } from "@/components/admin/print-route-sheet-button";
import { describeEdgedSides } from "@/features/bazis/part-groups";
import { requireAdminSession } from "@/lib/auth/dal";
import { BazisParseError, parseBazisProject } from "@/lib/bazis-b3d";
import { getSiteUrl } from "@/lib/seo";
import { createBazisPartToken } from "@/lib/server/bazis-part-link";
import { readRequestFileBytes } from "@/lib/server/request-file-content";
import { getRequestDetailById } from "@/lib/server/request-inbox";

export const dynamic = "force-dynamic";

type LabelsPageProps = {
  params: Promise<{ id: string; fileId: string }>;
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

export default async function BazisLabelsPage({ params }: LabelsPageProps) {
  const { id, fileId } = await params;
  await requireAdminSession(
    "/login?next=/admin/requests",
    `/admin/requests/${id}`,
  );
  const request = await getRequestDetailById(id);
  const file = request?.files.find((item) => item.id === fileId);

  if (!request || !file || !/\.b3d$/i.test(file.fileName)) {
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

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-[#171714] print:max-w-none">
      {/* Лист А4 без полей: 3 этикетки 70 × 37 мм в ряд, 8 рядов. */}
      <style>{`@media print { @page { size: A4; margin: 0; } }`}</style>

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
          <p className="mt-1 text-[var(--muted)]">
            Печатайте на самоклеящейся бумаге А4 с этикетками 70 × 37 мм (24 на
            листе), масштаб 100%, без полей. Сборщик наводит камеру телефона на
            код и видит, где деталь стоит в изделии. Одинаковые детали имеют
            одинаковый код.
          </p>
        </div>
      </div>

      {problem ? (
        <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {problem}
        </p>
      ) : null}

      <div className="grid grid-cols-3">
        {labels.map((label) => (
          <div
            key={label.key}
            className="flex h-[37mm] w-[70mm] break-inside-avoid items-center gap-[2mm] overflow-hidden border border-dashed border-[#cbc7bf] p-[2.5mm] print:border-0"
          >
            <div
              className="size-[27mm] shrink-0 [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: label.qrSvg }}
            />
            <div className="min-w-0 text-[7.5pt] leading-[1.25]">
              <p className="line-clamp-2 text-[9pt] leading-[1.15] font-bold">
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
