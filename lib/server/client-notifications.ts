import "server-only";

import {
  sendPushDirectMessage,
  type PushDirectPayload,
} from "@/lib/server/push-notifications";
import { sendTelegramDirectMessage } from "@/lib/server/telegram-bot";

export async function sendClientDirectMessage(
  userId: string | null | undefined,
  payload: PushDirectPayload,
) {
  const [telegram, push] = await Promise.allSettled([
    sendTelegramDirectMessage(userId, payload),
    sendPushDirectMessage(userId, payload),
  ]);

  if (telegram.status === "rejected") {
    console.error("[client-notification:telegram]", telegram.reason);
  }
  if (push.status === "rejected") {
    console.error("[client-notification:push]", push.reason);
  }

  return {
    telegramSent: telegram.status === "fulfilled" && telegram.value,
    telegramFailed: telegram.status === "rejected",
    push:
      push.status === "fulfilled"
        ? push.value
        : { configured: false, sent: 0, failed: 1, skipped: 0 },
  };
}
