import {
  getOneCAuthError,
  getOneCDatabaseError,
  getOneCLoyaltyProfile,
  oneCLoyaltySyncSchema,
  parseOneCBody,
  syncOneCLoyalty,
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
  const profile = await getOneCLoyaltyProfile({
    userId: searchParams.get("userId"),
    email: searchParams.get("email"),
    phone: searchParams.get("phone"),
  });

  if (!profile) {
    return Response.json(
      {
        ok: false,
        message: "Customer was not found.",
      },
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    profile,
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

  const parsed = await parseOneCBody(request, oneCLoyaltySyncSchema);

  if (!parsed.ok) {
    return Response.json(parsed.error.body, { status: parsed.error.status });
  }

  const result = await syncOneCLoyalty(parsed.data);

  return Response.json({
    ok: true,
    ...result,
  });
}
