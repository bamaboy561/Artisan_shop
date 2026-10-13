import QRCode from "qrcode";

import { getDb, hasDatabaseUrl } from "@/lib/db";
import { buildTelegramStartLink } from "@/lib/server/telegram-bot";

// QR-код для подключения Telegram-бота клиенту прямо у стойки: клиент
// наводит камеру, нажимает «Запустить» в боте и начинает получать
// оповещения о заказе, распиле и бонусах. Если бот уже подключён или
// клиент не зарегистрирован, блок не показывается.
export async function ClientTelegramConnect({
  userId,
}: {
  userId: string | null | undefined;
}) {
  if (!userId || !hasDatabaseUrl()) {
    return null;
  }

  let qrSvg = "";

  try {
    const user = await getDb().user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, isActive: true },
    });

    if (!user || !user.isActive || user.telegramChatId) {
      return null;
    }

    qrSvg = await QRCode.toString(buildTelegramStartLink(userId), {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    console.error("[admin:telegram-connect]", error);
    return null;
  }

  return (
    <div className="flex items-center gap-4 border border-[color:var(--line-strong)] bg-[#faf8f4] p-4 print:hidden">
      <div
        className="size-28 shrink-0 bg-white p-1.5 [&>svg]:size-full"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="min-w-0 text-sm leading-6">
        <p className="font-semibold text-[var(--foreground)]">
          У клиента не подключён Telegram-бот
        </p>
        <p className="mt-1 text-[var(--muted)]">
          Попросите его навести камеру телефона на код и нажать «Запустить» в
          Telegram. После этого статус заказа, готовность распила и бонусы будут
          приходить ему сами. Код действует 14 дней и подходит только этому
          клиенту.
        </p>
      </div>
    </div>
  );
}
