"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

type AdminSubmitButtonProps = Omit<ButtonProps, "children"> & {
  idleLabel: string;
  pendingLabel: string;
};

export function AdminSubmitButton({
  idleLabel,
  pendingLabel,
  disabled,
  ...props
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} {...props}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
