"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AccountError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-[#f1eee8] px-4 py-10">
      <div className="w-full max-w-[760px] rounded-[28px] border border-[#151411]/10 bg-white p-6 text-center shadow-[0_24px_70px_rgba(21,20,17,0.08)] sm:p-10">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
          Кабинет временно недоступен
        </p>
        <h1 className="mx-auto mt-3 max-w-[15ch] text-[2rem] leading-[0.96] font-semibold tracking-[-0.05em] text-[var(--foreground)] sm:text-[3rem]">
          Не удалось загрузить профиль.
        </h1>
        <p className="mx-auto mt-4 max-w-[34rem] text-sm leading-7 text-[var(--muted)] sm:text-base">
          История заказов, бонусы и QR клиента хранятся в базе данных. Когда
          подключение восстановится, кабинет снова покажет актуальные данные.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" variant="accent" onClick={() => reset()}>
            Повторить
          </Button>
          <Link href="/">
            <Button type="button" variant="secondary">
              На главную
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
