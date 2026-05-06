import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5 py-16">
      <div className="text-center">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-4xl">
          Страница не найдена.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[var(--muted)]">
          Возможно, страница была перемещена или удалена. Проверьте адрес или
          вернитесь на главную.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/">
            <Button variant="accent">На главную</Button>
          </Link>
          <Link href="/catalog">
            <Button variant="secondary">В каталог</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
