import { handleTelegramClientUpdate } from "@/lib/server/telegram-client";
import type { TelegramUpdate } from "@/lib/server/telegram-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isValidTelegramSecret(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!expectedSecret) {
    return true;
  }

  return (
    request.headers.get("x-telegram-bot-api-secret-token") === expectedSecret
  );
}

export async function POST(request: Request) {
  if (!isValidTelegramSecret(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    await handleTelegramClientUpdate(update);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[telegram-webhook]", error);

    return Response.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    webhook: "Artisan Telegram client bot endpoint",
  });
}
