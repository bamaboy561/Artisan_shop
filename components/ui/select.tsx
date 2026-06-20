import { forwardRef, type SelectHTMLAttributes } from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => {
    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        <select
          ref={ref}
          className={cn(
            "h-10 w-full appearance-none border border-[color:var(--line)] bg-[var(--surface-strong)] px-3.5 pr-10 text-sm text-[var(--foreground)] focus:border-[color:var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 sm:h-11 sm:px-4",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[var(--muted)]"
          aria-hidden="true"
        />
      </div>
    );
  },
);

Select.displayName = "Select";
