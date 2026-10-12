import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { RequestType } from "@/generated/prisma";
import { PrintRouteSheetButton } from "@/components/admin/print-route-sheet-button";
import {
  cuttingStageLabels,
  cuttingStageSteps,
} from "@/features/cutting/progress";
import { getManagerDisplayName } from "@/features/admin/operations-filters";
import { requireAdminSession } from "@/lib/auth/dal";
import { absoluteUrl } from "@/lib/seo";
import {
  getProductionPlans,
  productionPlanningAvailable,
} from "@/lib/server/production-planning";
import { getRequestDetailById } from "@/lib/server/request-inbox";

type RouteSheetPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bishkek",
  }).format(value instanceof Date ? value : new Date(value));
}

function formatDueDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");

  return year && month && day ? `${day}.${month}.${year}` : value;
}

type RoutePart = {
  sequence: string;
  title: string;
  size: string;
  quantity: string;
  edge: string;
  orientation: string;
  sheets: string;
};

// Заявка из калькулятора хранит детали текстом: «1. Название — размер ·
// N шт. · кромка · ориентация · листы». Разбираем его в таблицу для цеха.
function parseRouteMessage(message: string | null | undefined) {
  const lines = (message ?? "").split(/\r?\n/);
  const partsStart = lines.findIndex((line) => line.trim() === "Детали:");

  if (partsStart === -1) {
    return null;
  }

  const commentStart = lines.findIndex(
    (line, index) =>
      index > partsStart && line.trim() === "Комментарий клиента:",
  );
  const partLines = lines
    .slice(partsStart + 1, commentStart === -1 ? undefined : commentStart)
    .filter((line) => line.trim());
  const parts: RoutePart[] = [];

  for (const line of partLines) {
    const match = line.match(/^(\d+)\.\s+(.*?)\s+—\s+(.*)$/);
    const cells = match?.[3].split(" · ").map((cell) => cell.trim());

    if (!match || !cells || cells.length < 2) {
      return null;
    }

    parts.push({
      sequence: match[1],
      title: match[2],
      size: cells[0],
      quantity: cells[1].replace(/\s*шт\.?$/, ""),
      edge: cells[2] ?? "",
      orientation: cells[3] ?? "",
      sheets: cells.slice(4).join(" · "),
    });
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    summary: lines
      .slice(0, partsStart)
      .filter((line) => line.trim())
      .join("\n"),
    parts,
    comment:
      commentStart === -1
        ? ""
        : lines
            .slice(commentStart + 1)
            .join("\n")
            .trim(),
  };
}

function RouteField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-[#d7d4ce] pb-2">
      <p className="text-[9px] font-semibold tracking-[0.12em] text-[#77736c] uppercase">
        {label}
      </p>
      <p className="mt-1 text-[12px] leading-5 font-medium break-words text-[#171714]">
        {value}
      </p>
    </div>
  );
}

export default async function RouteSheetPage({ params }: RouteSheetPageProps) {
  const { id } = await params;
  await requireAdminSession(
    "/login?next=/admin/cutting",
    `/admin/requests/${id}/route-sheet`,
  );
  const request = await getRequestDetailById(id);

  if (!request || request.type !== RequestType.CUTTING_SERVICE) {
    notFound();
  }

  const requestNumber = request.number ?? request.id.slice(0, 8).toUpperCase();
  const requestUrl = absoluteUrl(`/admin/production/${request.id}`);
  const qrUrl = `/api/qr?data=${encodeURIComponent(requestUrl)}&size=320&margin=1`;
  const currentStage = request.cuttingStage
    ? cuttingStageLabels[request.cuttingStage]
    : "Не запущен";
  const managerName = request.manager
    ? getManagerDisplayName(request.manager)
    : "Не назначен";
  const plan = (await productionPlanningAvailable())
    ? (await getProductionPlans([id])).get(id)
    : undefined;
  const parsedMessage = parseRouteMessage(request.message);
  const isUrgent = /срочно/i.test(
    `${request.subject} ${request.message ?? ""}`.replace(
      /Приоритет:\s*стандарт/gi,
      "",
    ),
  );

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-[#171714] print:max-w-none">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/production/${request.id}`}
          className="inline-flex h-10 items-center gap-2 border border-[color:var(--line-strong)] px-4 text-sm font-medium transition hover:border-[color:var(--foreground)]"
        >
          <ArrowLeft className="size-4" />К производству
        </Link>
        <PrintRouteSheetButton />
      </div>

      <article className="min-h-[297mm] border border-[#cbc7bf] bg-white p-[10mm] shadow-sm print:min-h-0 print:border-0 print:p-[8mm] print:shadow-none">
        <header className="grid grid-cols-[minmax(0,1fr)_34mm] gap-[8mm] border-b-2 border-[#171714] pb-[6mm]">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase">
              Artisan
            </p>
            <h1 className="mt-3 text-[24px] leading-none font-bold">
              Маршрутный лист распила
            </h1>
            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              <p className="text-[34px] leading-none font-black">
                {requestNumber}
              </p>
              {isUrgent ? (
                <p className="border-2 border-[#171714] px-3 py-1 text-[16px] leading-none font-black tracking-[0.08em] uppercase">
                  Срочно
                </p>
              ) : null}
              <p className="pb-1 text-[11px] text-[#625f59]">
                Напечатано: {formatDate(new Date())}
              </p>
            </div>
          </div>

          <div className="text-center">
            <Image
              src={qrUrl}
              alt={`QR заявки ${requestNumber}`}
              width={320}
              height={320}
              unoptimized
              className="mx-auto size-[31mm]"
            />
            <p className="mt-1 text-[8px] leading-3 text-[#625f59]">
              Открыть заявку
            </p>
          </div>
        </header>

        <section className="mt-[6mm] grid grid-cols-2 gap-x-[8mm] gap-y-[4mm]">
          <RouteField label="Клиент" value={request.contactName} />
          <RouteField label="Телефон" value={request.contactPhone} />
          <RouteField
            label="Сумма работ, сом"
            value={
              request.quotedTotal != null
                ? request.quotedTotal.toLocaleString("ru-RU")
                : "Не рассчитана"
            }
          />
          <RouteField
            label="Материал"
            value={request.material ?? request.product?.name ?? "Не указан"}
          />
          <RouteField
            label="Количество листов"
            value={
              request.cuttingSheetCount
                ? `${request.cuttingSheetCount} шт.`
                : "Не указано"
            }
          />
          <RouteField
            label="Кромка"
            value={request.edgeOption ?? "Не указана"}
          />
          <RouteField
            label="Кромка, пог. м"
            value={
              request.cuttingEdgeMeters != null
                ? `${request.cuttingEdgeMeters.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м`
                : "Не указано"
            }
          />
          <RouteField
            label="Дата приема"
            value={formatDate(request.createdAt)}
          />
          <RouteField
            label="Срок готовности"
            value={plan?.dueDate ? formatDueDate(plan.dueDate) : "Не назначен"}
          />
          <RouteField label="Менеджер" value={managerName} />
          <RouteField label="Этап на момент печати" value={currentStage} />
          <RouteField
            label="Ячейка выдачи"
            value={request.cuttingPickupCell || "Назначается при готовности"}
          />
        </section>

        <section className="mt-[7mm]">
          <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
            Производственный маршрут
          </h2>
          <div className="mt-3 border border-[#bdb9b1]">
            {cuttingStageSteps.map((step, index) => {
              const isCurrent = request.cuttingStage === step.stage;

              return (
                <div
                  key={step.stage}
                  className="grid grid-cols-[8mm_minmax(0,1fr)_34mm_34mm] items-center border-b border-[#d7d4ce] last:border-b-0"
                >
                  <div className="flex h-[11mm] items-center justify-center border-r border-[#d7d4ce] text-[11px] font-bold">
                    {index + 1}
                  </div>
                  <div className="min-w-0 px-3">
                    <p className="text-[11px] font-semibold">
                      {isCurrent ? "● " : "○ "}
                      {step.label}
                    </p>
                  </div>
                  <div className="h-full border-l border-[#d7d4ce] px-2 py-1 text-[8px] text-[#77736c]">
                    Дата / время
                  </div>
                  <div className="h-full border-l border-[#d7d4ce] px-2 py-1 text-[8px] text-[#77736c]">
                    Сотрудник
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {request.productionComment ? (
          <section className="mt-[7mm] break-inside-avoid border-2 border-[#171714] p-3">
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
              Комментарий производства
            </h2>
            <p className="mt-2 text-[11px] leading-5 whitespace-pre-wrap">
              {request.productionComment}
            </p>
          </section>
        ) : null}

        {parsedMessage ? (
          <>
            <section className="mt-[7mm] break-inside-avoid">
              <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
                Материал и расчёт
              </h2>
              <pre className="mt-3 columns-2 gap-[8mm] border border-[#bdb9b1] bg-[#faf9f7] p-3 font-sans text-[9px] leading-[1.55] whitespace-pre-wrap text-[#302e2a]">
                {parsedMessage.summary}
              </pre>
            </section>

            <section className="mt-[7mm]">
              <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
                Детали: {parsedMessage.parts.length} поз.
              </h2>
              <table className="mt-3 w-full border-collapse border border-[#bdb9b1] text-[9px] leading-[1.4]">
                <thead>
                  <tr className="bg-[#f0eeea] text-left">
                    {[
                      "№",
                      "Деталь",
                      "Размер",
                      "Кол-во",
                      "Кромка",
                      "Ориентация",
                      "Лист",
                      "Распил ✓",
                      "Кромка ✓",
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
                  {parsedMessage.parts.map((part) => (
                    <tr key={part.sequence} className="break-inside-avoid">
                      <td className="border border-[#d7d4ce] px-1.5 py-1 font-semibold">
                        {part.sequence}
                      </td>
                      <td className="border border-[#d7d4ce] px-1.5 py-1">
                        {part.title}
                      </td>
                      <td className="border border-[#d7d4ce] px-1.5 py-1 font-semibold whitespace-nowrap">
                        {part.size}
                      </td>
                      <td className="border border-[#d7d4ce] px-1.5 py-1 text-center font-semibold">
                        {part.quantity}
                      </td>
                      <td className="border border-[#d7d4ce] px-1.5 py-1">
                        {part.edge}
                      </td>
                      <td className="border border-[#d7d4ce] px-1.5 py-1">
                        {part.orientation}
                      </td>
                      <td className="border border-[#d7d4ce] px-1.5 py-1">
                        {part.sheets}
                      </td>
                      <td className="w-[13mm] border border-[#d7d4ce]" />
                      <td className="w-[13mm] border border-[#d7d4ce]" />
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[8px] text-[#77736c]">
                В двух последних колонках оператор отмечает готовность детали на
                своей станции.
              </p>
            </section>

            {parsedMessage.comment ? (
              <section className="mt-[6mm] break-inside-avoid">
                <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
                  Комментарий клиента
                </h2>
                <p className="mt-2 text-[10px] leading-5 whitespace-pre-wrap">
                  {parsedMessage.comment}
                </p>
              </section>
            ) : null}
          </>
        ) : (
          <section className="mt-[7mm]">
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
              Материал и детали
            </h2>
            <pre className="mt-3 border border-[#bdb9b1] bg-[#faf9f7] p-3 font-sans text-[9px] leading-[1.55] whitespace-pre-wrap text-[#302e2a]">
              {request.message || request.subject}
            </pre>
          </section>
        )}

        {request.files.length > 0 ? (
          <section className="mt-[6mm] break-inside-avoid">
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
              Файлы заявки
            </h2>
            <p className="mt-2 text-[9px] leading-5 text-[#4e4b46]">
              {request.files.map((file) => file.fileName).join(" · ")}
            </p>
          </section>
        ) : null}

        <footer className="mt-[8mm] grid grid-cols-2 gap-[10mm] border-t border-[#bdb9b1] pt-[6mm] text-[9px] text-[#625f59]">
          <p>Контроль качества: ____________________</p>
          <p>Выдал / получил: ____________________</p>
        </footer>
      </article>
    </div>
  );
}
