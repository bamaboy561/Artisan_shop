import {
  getOneCAuthError,
  getOneCDatabaseError,
  getOneCOrders,
  parseDateParam,
  parseOrderStatusParam,
  parseTakeParam,
} from "@/lib/server/one-c-exchange";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = getOneCAuthError(request);

  if (authError) {
    return Response.json(authError.body, { status: authError.status });
  }

  const databaseError = getOneCDatabaseError();

  if (databaseError) {
    return Response.json(databaseError.body, { status: databaseError.status });
  }

  const searchParams = new URL(request.url).searchParams;
  const orders = await getOneCOrders({
    updatedSince: parseDateParam(searchParams.get("updatedSince")),
    status: parseOrderStatusParam(searchParams.get("status")),
    take: parseTakeParam(searchParams.get("take"), 200, 500),
  });

  return Response.json({
    ok: true,
    count: orders.length,
    orders,
  });
}
