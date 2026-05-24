import { handleTelegramUpdate } from "@/lib/server/telegram-bot";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "Artisan Telegram webhook",
  });
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (secret) {
    const incomingSecret = request.headers.get(
      "x-telegram-bot-api-secret-token",
    );

    if (incomingSecret !== secret) {
      return Response.json({ ok: false }, { status: 401 });
    }
  }

  const update = await request.json().catch(() => null);

  if (!update) {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    await handleTelegramUpdate(update);
  } catch (error) {
    console.error("[telegram:webhook]", error);
  }

  return Response.json({ ok: true });
}
