"use client";

import type { ButtonHTMLAttributes } from "react";

type ConfirmDeleteButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "onClick"
> & {
  confirmMessage: string;
};

// Кнопка удаления: сначала спрашивает подтверждение, и только потом
// отправляет форму. Подходит и для своей формы, и для formAction.
export function ConfirmDeleteButton({
  confirmMessage,
  ...props
}: ConfirmDeleteButtonProps) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      {...props}
    />
  );
}
