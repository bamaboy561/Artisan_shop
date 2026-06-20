import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full border border-[color:var(--line)] bg-[var(--surface-strong)] px-3.5 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/70 focus:border-[color:var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 sm:px-4",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
