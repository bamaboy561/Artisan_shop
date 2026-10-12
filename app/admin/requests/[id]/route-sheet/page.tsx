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
  }).format(value instanceof Date ? value : new Date(value));
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
              <p className="pb-1 text-[11px] text-[#625f59]">
                Проект Giblab: <strong>{requestNumber}</strong>
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
          <RouteField label="Сумма работ, сом" value={request.quotedTotal != null ? request.quotedTotal.toLocaleString("ru-RU") : "Не рассчитана"} />
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
          <RouteField label="Менеджер" value={managerName} />
          <RouteField label="Текущий этап" value={currentStage} />
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

        <section className="mt-[7mm] break-inside-avoid">
          <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase">
            Материал и детали
          </h2>
          <pre className="mt-3 border border-[#bdb9b1] bg-[#faf9f7] p-3 font-sans text-[9px] leading-[1.55] whitespace-pre-wrap text-[#302e2a]">
            {request.message || request.subject}
          </pre>
        </section>

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
