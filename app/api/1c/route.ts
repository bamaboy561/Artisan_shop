import {
  getOneCAuthError,
  getOneCDatabaseError,
} from "@/lib/server/one-c-exchange";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = getOneCAuthError(request);

  if (authError) {
    return Response.json(authError.body, { status: authError.status });
  }

  const databaseError = getOneCDatabaseError();

  return Response.json({
    ok: !databaseError,
    service: "Artisan 1C exchange",
    database: databaseError ? "unavailable" : "ok",
    endpoints: [
      "/api/1c/products",
      "/api/1c/orders",
      "/api/1c/orders/statuses",
      "/api/1c/loyalty",
    ],
  });
}
