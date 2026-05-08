import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ClientOperationTimeline } from "@/components/account/client-operation-timeline";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import { RequestFileKind, RequestStatus } from "@/generated/prisma";
import {
  requestStatusLabels,
  requestTypeLabels,
} from "@/features/admin/operations-filters";
import { hasDatabaseUrl } from "@/lib/db";
import { getAccountRequests, getAccountUser } from "@/lib/server/account-data";
import { uploadAccountRequestFilesAction } from "@/app/account/requests/actions";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatBudget(value: number | null) {
  if (value === null) {
    return "По расчету";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(value);
}

const requestUploadStatuses = new Set<RequestStatus>([
  RequestStatus.NEW,
  RequestStatus.IN_REVIEW,
  RequestStatus.QUOTE_SENT,
  RequestStatus.WAITING_FOR_CLIENT,
  RequestStatus.IN_PROGRESS,
]);

export default async function AccountRequestsPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Заявки появятся после подключения базы данных"
        description="Раздел покажет запросы цены, сервисные обращения и работу менеджера по каждой заявке."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "После первой реальной заявки история появится здесь автоматически.",
        ]}
      />
    );
  }

  const user = await getAccountUser();

  if (!user) {
    return null;
  }

  const requests = await getAccountRequests(user.id);

  const rows = requests.map((request) => {
    const clientFiles = request.files.filter(
      (file) => file.kind === RequestFileKind.CLIENT_UPLOAD,
    );
    const resultFiles = request.files.filter(
      (file) => file.kind === RequestFileKind.MANAGER_RESULT,
    );
    const canUploadFiles = requestUploadStatuses.has(request.status);

    return {
    request: (
      <div className="space-y-1">
        <p className="font-semibold text-[var(--foreground)]">
          {request.number ?? request.id.slice(0, 8)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatDate(request.createdAt)}
        </p>
      </div>
    ),
    service: (
      <div className="space-y-1">
        <p>{request.subject}</p>
        <p className="text-xs text-[var(--muted)]">
          {requestTypeLabels[request.type]}
        </p>
      </div>
    ),
    clientFiles: (
      <div className="space-y-3">
        {clientFiles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {clientFiles.map((file) => (
              <a
                key={file.id}
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--foreground)] transition hover:border-[color:var(--foreground)]"
              >
                {file.fileName}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Файлы не загружены.</p>
        )}
        {canUploadFiles ? (
          <form
            action={uploadAccountRequestFilesAction}
            encType="multipart/form-data"
            className="grid gap-2"
          >
            <input type="hidden" name="requestId" value={request.id} />
            <Input
              name="files"
              type="file"
              multiple
              accept=".pdf,.xls,.xlsx,.csv,.zip,.rar,.jpg,.jpeg,.png,.webp,.dwg,.dxf"
              className="h-auto py-2 text-xs"
            />
            <AdminSubmitButton
              type="submit"
              variant="secondary"
              size="sm"
              idleLabel="Добавить файл"
              pendingLabel="Загружаем..."
            />
          </form>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Загрузка закрыта после завершения заявки.
          </p>
        )}
      </div>
    ),
    status: (
      <div className="space-y-2">
        <StatusBadge tone="warning">{requestStatusLabels[request.status]}</StatusBadge>
        <p className="text-xs text-[var(--muted)]">
          Итог: {formatBudget(request.quotedTotal)}
        </p>
      </div>
    ),
    result: (
      <div className="space-y-2">
        {request.productionComment ? (
          <p className="max-w-sm text-sm leading-6 text-[var(--foreground)]">
            {request.productionComment}
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">Результат появится после расчета.</p>
        )}
        {resultFiles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {resultFiles.map((file) => (
              <a
                key={file.id}
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--foreground)] transition hover:border-[color:var(--foreground)]"
              >
                {file.fileName}
              </a>
            ))}
          </div>
        ) : null}
        {request.managerNotes.length > 0 ? (
          <p className="text-xs leading-5 text-[var(--muted)]">
            {request.managerNotes[0]?.body}
          </p>
        ) : null}
      </div>
    ),
    history: (
      <ClientOperationTimeline
        events={request.history}
        emptyMessage="История появится после обработки заявки."
      />
    ),
    manager: (
      <div className="space-y-1">
        <p>
          {[request.manager?.firstName, request.manager?.lastName]
            .filter(Boolean)
            .join(" ") || "Без менеджера"}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {request.manager?.email ?? "Назначение появится после обработки"}
        </p>
      </div>
    ),
    };
  });

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Мои заявки"
          description="Все сервисные обращения, запросы цены и ответы команды Artisan в одном месте."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-2xl text-sm leading-7"
        />
      </section>

      <DataTable
        columns={[
          { key: "request", label: "Заявка" },
          { key: "service", label: "Содержание" },
          { key: "clientFiles", label: "Ваши файлы" },
          { key: "status", label: "Статус" },
          { key: "result", label: "Расчет и файлы" },
          { key: "history", label: "История" },
          { key: "manager", label: "Менеджер" },
        ]}
        rows={rows}
        caption="Заявки"
        emptyMessage="Когда вы отправите первое обращение, оно появится здесь."
      />
    </div>
  );
}
