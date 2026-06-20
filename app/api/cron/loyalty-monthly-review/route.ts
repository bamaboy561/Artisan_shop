import { runMonthlyLoyaltyReview } from "@/lib/server/loyalty-monthly-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function getCronAuthError(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return Response.json(
      {
        ok: false,
        message: "CRON_SECRET is not configured.",
      },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      {
        ok: false,
        message: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  return null;
}

export async function GET(request: Request) {
  const authError = getCronAuthError(request);

  if (authError) {
    return authError;
  }

  const searchParams = new URL(request.url).searchParams;
  const result = await runMonthlyLoyaltyReview({
    force: searchParams.get("force") === "1",
    notify: searchParams.get("notify") !== "0",
  });

  return Response.json(result, { status: result.ok ? 200 : 500 });
}
