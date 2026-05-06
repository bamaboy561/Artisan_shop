"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5 py-16">
      <div className="text-center">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
          Ошибка
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-4xl">
          Что-то пошло не так.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[var(--muted)]">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу или
          вернитесь на главную.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="accent" onClick={reset}>
            Попробовать снова
          </Button>
          <Link href="/">
            <Button variant="secondary">На главную</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
