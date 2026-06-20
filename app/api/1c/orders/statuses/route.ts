import {
  getOneCAuthError,
  getOneCDatabaseError,
  oneCOrderStatusSyncSchema,
  parseOneCBody,
  syncOneCOrderStatuses,
} from "@/lib/server/one-c-exchange";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = getOneCAuthError(request);

  if (authError) {
    return Response.json(authError.body, { status: authError.status });
  }

  const databaseError = getOneCDatabaseError();

  if (databaseError) {
    return Response.json(databaseError.body, { status: databaseError.status });
  }

  const parsed = await parseOneCBody(request, oneCOrderStatusSyncSchema);

  if (!parsed.ok) {
    return Response.json(parsed.error.body, { status: parsed.error.status });
  }

  const result = await syncOneCOrderStatuses(parsed.data);

  return Response.json({
    ok: true,
    ...result,
  });
}
