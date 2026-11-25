"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition, type FormEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Фильтры применяются сами: списки — сразу, поиск — через полсекунды после
// последней буквы. Кнопка «Найти» больше не нужна (Enter тоже работает).
export function AutoFilterForm({
  action,
  className,
  children,
}: {
  action: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      const text = String(value).trim();
      if (text && text !== "all") params.set(key, text);
    }
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${action}?${query}` : action, { scroll: false });
    });
  }

  return (
    <form
      action={action}
      aria-busy={pending}
      className={cn(className, pending && "opacity-80")}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        window.clearTimeout(timer.current);
        apply(event.currentTarget);
      }}
      onChange={(event) => {
        const form = event.currentTarget;
        const target = event.target as unknown as HTMLInputElement;
        const typing = target.tagName === "INPUT" && target.type !== "date";
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => apply(form), typing ? 500 : 0);
      }}
    >
      {children}
    </form>
  );
}
