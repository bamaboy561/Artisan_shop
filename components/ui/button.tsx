import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = {
  primary:
    "bg-[var(--foreground)] text-white hover:bg-[color:color-mix(in_srgb,var(--foreground)_88%,white)]",
  secondary:
    "border border-[color:var(--line-strong)] bg-transparent text-[var(--foreground)] hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white",
  accent: "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
  ghost: "text-[var(--foreground)] hover:bg-[var(--surface)]",
} as const;

const buttonSizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "size-10 sm:size-11",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function getButtonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold shadow-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={getButtonClassName(variant, size, className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
