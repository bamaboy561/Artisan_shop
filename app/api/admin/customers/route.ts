import { NextResponse } from "next/server";

import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { getSalesFloorCustomers } from "@/lib/server/sales-floor";
import { verifyClientQrPayload } from "@/lib/server/client-qr";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getOptionalSession();

  // Телефоны и почты клиентов видят менеджеры и администраторы, не цех.
  if (!session?.userId || !canAccessGeneralAdmin(session.roleCode)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ customers: [] });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = verifyClientQrPayload(rawQuery)?.userId ?? rawQuery;
  const customers = await getSalesFloorCustomers(query, 30);

  return NextResponse.json({ customers });
}
