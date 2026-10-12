import { NextResponse } from "next/server";

import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { getSalesFloorProducts } from "@/lib/server/sales-floor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getOptionalSession();

  if (!session?.userId || !canAccessGeneralAdmin(session.roleCode)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ products: [] });
  }

  const { searchParams } = new URL(request.url);
  const products = await getSalesFloorProducts(searchParams.get("q") ?? "", 60);

  return NextResponse.json({ products });
}
