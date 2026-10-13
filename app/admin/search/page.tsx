import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSearchForm } from "@/components/admin/admin-search-form";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  orderStatusLabels,
  requestStatusLabels,
  requestTypeLabels,
} from "@/features/admin/operations-filters";
import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin, getAdminHomePath } from "@/lib/auth/roles";
import { formatPrice } from "@/lib/commerce";
import { hasDatabaseUrl } from "@/lib/db";
import { searchAdmin } from "@/lib/server/admin-search";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Bishkek",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function Group({
  title,
  count,
  limit,
  children,
}: {
  title: string;
  count: number;
  limit: number;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#e3ddd2] bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-[#e3ddd2] px-5 py-3">
        <h2 className="text-base font-semibold text-[#1b1c19]">{title}</h2>
        <span className="text-xs text-[#6b665e]">
          {count === 0
            ? "ничего не найдено"
            : count >= limit
              ? `первые ${limit}, уточните запрос`
              : `найдено: ${count}`}
        </span>
      </div>
      {count > 0 ? (
        <ul className="divide-y divide-[#eee9df]">{children}</ul>
      ) : null}
    </section>
  );
}

function Row({
  href,
  title,
  detail,
  aside,
}: {
  href: string;
  title: string;
  detail: string;
  aside: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-[#faf8f4]"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[#1b1c19]">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-[#6b665e]">
            {detail}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs text-[#6b665e]">
          {aside}
        </span>
      </Link>
    </li>
  );
}

export default async function AdminSearchPage({
  searchParams,
}: SearchPageProps) {
  const session = await requireAdminSession("/login?next=/admin/search");

  // В результатах есть телефоны клиентов: их видят менеджеры и
  // администраторы, не цех.
  if (!canAccessGeneralAdmin(session.roleCode)) {
    redirect(getAdminHomePath(session.roleCode));
  }

  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? "";
  const result = hasDatabaseUrl() ? await searchAdmin(query) : null;

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Поиск"
        description="Ищет сразу по клиентам, заказам и заявкам: имя, компания, телефон в любом виде, номер заказа или заявки."
        titleClassName="text-2xl sm:text-3xl"
        descriptionClassName="max-w-3xl text-sm leading-7"
      />
      <AdminSearchForm defaultValue={query} autoFocus className="max-w-xl" />

      {!result ? (
        <p className="text-sm text-[#6b665e]">
          {query.trim()
            ? "Введите хотя бы два знака."
            : "Введите имя, телефон или номер."}
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <Group
            title="Клиенты"
            count={result.clients.length}
            limit={result.limit}
          >
            {result.clients.map((client) => (
              <Row
                key={client.id}
                href={`/admin/users/${client.id}`}
                title={
                  [client.firstName, client.lastName]
                    .filter(Boolean)
                    .join(" ") ||
                  client.companyName ||
                  "Клиент без имени"
                }
                detail={[client.phone, client.companyName]
                  .filter(Boolean)
                  .join(" · ")}
                aside={
                  client.isActive
                    ? `${client.loyaltyPointsBalance} баллов`
                    : "отключён"
                }
              />
            ))}
          </Group>
          <Group
            title="Заказы"
            count={result.orders.length}
            limit={result.limit}
          >
            {result.orders.map((order) => (
              <Row
                key={order.id}
                href={`/admin/orders/${order.id}`}
                title={`${order.number ?? "Заказ"} · ${order.contactName}`}
                detail={`${orderStatusLabels[order.status]} · ${formatPrice(order.total)} · ${order.contactPhone}`}
                aside={dateFormatter.format(order.createdAt)}
              />
            ))}
          </Group>
          <Group
            title="Заявки и распил"
            count={result.requests.length}
            limit={result.limit}
          >
            {result.requests.map((request) => (
              <Row
                key={request.id}
                href={`/admin/requests/${request.id}`}
                title={`${request.number ?? "Заявка"} · ${request.contactName}`}
                detail={`${requestStatusLabels[request.status]} · ${requestTypeLabels[request.type]} · ${request.subject}`}
                aside={dateFormatter.format(request.createdAt)}
              />
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}
