import { MessageCircle, ShieldCheck } from "lucide-react";

import {
  disconnectTelegramAction,
  startTelegramLinkAction,
} from "@/app/account/actions";
import { Button } from "@/components/ui/button";

type TelegramConnectCardProps = {
  telegramUsername?: string | null;
  telegramLinkedAt?: Date | null;
};

function formatLinkedAt(value?: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function TelegramConnectCard({
  telegramUsername,
  telegramLinkedAt,
}: TelegramConnectCardProps) {
  const isLinked = Boolean(telegramLinkedAt);
  const linkedAt = formatLinkedAt(telegramLinkedAt);

  return (
    <section className="rounded-[24px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_14px_34px_rgba(17,17,17,0.04)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--foreground)] text-white">
            {isLinked ? (
              <ShieldCheck className="size-5" strokeWidth={1.9} />
            ) : (
              <MessageCircle className="size-5" strokeWidth={1.9} />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Telegram
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              {isLinked ? "Бот подключен" : "Подключить Telegram"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {isLinked
                ? `Кабинет привязан${telegramUsername ? ` к @${telegramUsername}` : ""}${linkedAt ? ` · ${linkedAt}` : ""}.`
                : "Клиент будет получать статусы заказов, заявки на распил, начисления бонусов и сможет проверить баланс командами /bonus, /orders и /requests."}
            </p>
          </div>
        </div>

        <form
          action={isLinked ? disconnectTelegramAction : startTelegramLinkAction}
          className="shrink-0"
        >
          <Button
            type="submit"
            variant={isLinked ? "secondary" : "accent"}
            className="w-full sm:w-auto"
          >
            {isLinked ? "Отключить" : "Подключить"}
          </Button>
        </form>
      </div>
    </section>
  );
}
