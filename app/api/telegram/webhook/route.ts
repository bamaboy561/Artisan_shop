import { handleTelegramUpdate } from "@/lib/server/telegram-bot";
import {
  claimTelegramUpdate,
  completeTelegramUpdate,
  releaseTelegramUpdate,
} from "@/lib/server/telegram-update-receipts";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "Artisan Telegram webhook",
  });
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!secret && process.env.VERCEL_ENV === "production") {
    console.error("[telegram:webhook:secret-missing]");
    return Response.json({ ok: false }, { status: 503 });
  }

  if (secret) {
    const incomingSecret = request.headers.get(
      "x-telegram-bot-api-secret-token",
    );

    if (incomingSecret !== secret) {
      console.warn("[telegram:webhook:secret-mismatch]", {
        hasIncomingSecret: Boolean(incomingSecret),
      });
      return Response.json({ ok: false }, { status: 401 });
    }
  }

  const update = await request.json().catch(() => null);

  if (!update) {
    console.warn("[telegram:webhook:invalid-json]");
    return Response.json({ ok: false }, { status: 400 });
  }

  const updateId =
    typeof update === "object" &&
    update !== null &&
    "update_id" in update &&
    typeof update.update_id === "number" &&
    Number.isSafeInteger(update.update_id)
      ? update.update_id
      : null;

  if (updateId !== null) {
    const claim = await claimTelegramUpdate(updateId);

    if (claim === "completed") {
      return Response.json({ ok: true, duplicate: true });
    }

    if (claim === "processing") {
      return Response.json({ ok: false, processing: true }, { status: 503 });
    }
  }

  try {
    await handleTelegramUpdate(update);
  } catch (error) {
    console.error("[telegram:webhook]", error);
    if (updateId !== null) {
      await releaseTelegramUpdate(updateId).catch((releaseError) =>
        console.error("[telegram:webhook:release]", releaseError),
      );
    }
    return Response.json({ ok: false }, { status: 500 });
  }

  if (updateId !== null) {
    await completeTelegramUpdate(updateId).catch((error) => {
      console.error("[telegram:webhook:complete]", error);
      throw error;
    });
  }

  return Response.json({ ok: true });
}
