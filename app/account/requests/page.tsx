import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import { hasDatabaseUrl } from "@/lib/db";
import { getAccountRequests, getAccountUser } from "@/lib/server/account-data";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function AccountRequestsPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Заявки появятся после подключения базы данных"
        description="Раздел покажет запросы цены, сервисные обращения и работу менеджера по каждой заявке."
        steps={[
          "Добавьте DATABASE_URL в .env.",
          "Примените Prisma-схему через prisma db push или prisma migrate dev.",
          "Запустите prisma db seed, чтобы загрузить стартовые обращения.",
        ]}
      />
    );
  }

  const user = await getAccountUser();

  if (!user) {
    return null;
  }

  const requests = await getAccountRequests(user.id);

  const rows = requests.map((request) => ({
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
        <p className="text-xs text-[var(--muted)]">{request.type}</p>
      </div>
    ),
    status: <StatusBadge tone="warning">{request.status}</StatusBadge>,
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
  }));

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
          { key: "status", label: "Статус" },
          { key: "manager", label: "Менеджер" },
        ]}
        rows={rows}
        caption="Заявки"
        emptyMessage="Когда вы отправите первое обращение, оно появится здесь."
      />
    </div>
  );
}
