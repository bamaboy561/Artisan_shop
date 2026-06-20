import {
  getOneCAuthError,
  getOneCDatabaseError,
  getOneCProducts,
  oneCProductSyncSchema,
  parseDateParam,
  parseOneCBody,
  parseTakeParam,
  syncOneCProducts,
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
  const products = await getOneCProducts({
    updatedSince: parseDateParam(searchParams.get("updatedSince")),
    take: parseTakeParam(searchParams.get("take"), 500, 1000),
  });

  return Response.json({
    ok: true,
    count: products.length,
    products,
  });
}

export async function POST(request: Request) {
  const authError = getOneCAuthError(request);

  if (authError) {
    return Response.json(authError.body, { status: authError.status });
  }

  const databaseError = getOneCDatabaseError();

  if (databaseError) {
    return Response.json(databaseError.body, { status: databaseError.status });
  }

  const parsed = await parseOneCBody(request, oneCProductSyncSchema);

  if (!parsed.ok) {
    return Response.json(parsed.error.body, { status: parsed.error.status });
  }

  const result = await syncOneCProducts(parsed.data);

  return Response.json({
    ok: true,
    ...result,
  });
}
