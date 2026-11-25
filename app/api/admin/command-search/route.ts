import { NextResponse } from "next/server";

import {
  orderStatusLabels,
  requestStatusLabels,
} from "@/features/admin/operations-filters";
import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { searchAdmin } from "@/lib/server/admin-search";

export const dynamic = "force-dynamic";

// Поиск для окна Ctrl+K: те же правила, что у страницы «Поиск» — телефоны
// клиентов видят только менеджеры и администраторы.
export async function GET(request: Request) {
  const session = await getOptionalSession();

  if (!session?.userId || !canAccessGeneralAdmin(session.roleCode)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (!hasDatabaseUrl() || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const found = await searchAdmin(query);
  if (!found) return NextResponse.json({ results: [] });

  const money = new Intl.NumberFormat("ru-RU");
  const results = [
    ...found.orders.slice(0, 5).map((order) => ({
      kind: "order" as const,
      href: `/admin/orders/${order.id}`,
      title: `${order.number ?? "Заказ"} · ${order.contactName}`,
      detail: `${orderStatusLabels[order.status]} · ${money.format(order.total)} сом`,
    })),
    ...found.requests.slice(0, 5).map((item) => ({
      kind: "request" as const,
      href: `/admin/requests/${item.id}`,
      title: `${item.number ?? "Заявка"} · ${item.contactName}`,
      detail: `${requestStatusLabels[item.status]} · ${item.subject}`,
    })),
    ...found.clients.slice(0, 5).map((client) => ({
      kind: "client" as const,
      href: `/admin/users/${client.id}`,
      title:
        [client.firstName, client.lastName].filter(Boolean).join(" ") ||
        client.companyName ||
        client.email,
      detail: [client.phone, client.companyName].filter(Boolean).join(" · "),
    })),
  ];

  return NextResponse.json({ results });
}
