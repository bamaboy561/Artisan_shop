import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full border border-[color:var(--line)] bg-[var(--surface-strong)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/70 sm:h-11 sm:px-4 focus:border-[color:var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
