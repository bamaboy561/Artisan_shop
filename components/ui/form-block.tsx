import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FormBlockProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function FormBlock({
  eyebrow,
  title,
  description,
  children,
  actions,
  className,
}: FormBlockProps) {
  return (
    <section
      className={cn(
        "border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 sm:p-6 lg:p-8",
        className,
      )}
    >
      <div className="max-w-2xl space-y-3">
        <p className="font-mono text-xs tracking-[0.28em] text-[var(--accent)] uppercase">
          {eyebrow}
        </p>
        <h3 className="text-[1.35rem] leading-[1.08] font-semibold text-[var(--foreground)] sm:text-2xl">
          {title}
        </h3>
        {description ? (
          <p className="text-sm leading-6 text-[var(--muted)] sm:leading-7">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-5 sm:mt-6">{children}</div>
      {actions ? (
        <div className="mt-5 border-t border-[color:var(--line)] pt-5 sm:mt-6 sm:pt-6">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
