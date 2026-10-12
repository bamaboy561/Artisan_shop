import { NextResponse } from "next/server";

import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { getSalesFloorCustomers } from "@/lib/server/sales-floor";
import { verifyClientQrPayload } from "@/lib/server/client-qr";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getOptionalSession();

  if (!session?.userId || !canAccessAdmin(session.roleCode)) {
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
