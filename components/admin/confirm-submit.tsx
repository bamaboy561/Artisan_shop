"use client";

import { type MouseEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmSubmitProps = {
  message: string;
  children: ReactNode;
  className?: string;
  variant?: "secondary" | "ghost" | "accent" | "primary";
  size?: "sm" | "md" | "lg";
  formAction?: (formData: FormData) => void | Promise<void>;
  disabled?: boolean;
};

/**
 * Submit button that asks the user to confirm before letting the form
 * fire. Use for destructive actions (delete, cancel).
 */
export function ConfirmSubmit({
  message,
  children,
  className,
  variant = "ghost",
  size = "sm",
  formAction,
  disabled,
}: ConfirmSubmitProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (!window.confirm(message)) {
      event.preventDefault();
    }
  };

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      onClick={handleClick}
      formAction={formAction}
      disabled={disabled}
      className={cn("text-red-600 hover:bg-red-50", className)}
    >
      {children}
    </Button>
  );
}
