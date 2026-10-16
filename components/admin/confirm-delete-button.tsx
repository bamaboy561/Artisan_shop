"use client";

import { useState, type ButtonHTMLAttributes } from "react";

type ConfirmDeleteButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "onClick"
> & {
  confirmMessage: string;
};

// Кнопка удаления: сначала спрашивает подтверждение, и только потом
// отправляет форму. Подходит и для своей формы, и для formAction.
// Подтверждение показывается прямо на странице, а не окном браузера:
// окно браузер может заблокировать, и тогда нажатие молча пропадает.
export function ConfirmDeleteButton({
  confirmMessage,
  children,
  className,
  ...props
}: ConfirmDeleteButtonProps) {
  const [armed, setArmed] = useState(false);
  if (!armed)
    return (
      <button
        type="button"
        className={className}
        onClick={() => setArmed(true)}
        {...props}
      >
        {children}
      </button>
    );
  return (
    <span
      role="alertdialog"
      aria-live="assertive"
      className="inline-flex max-w-md flex-wrap items-center gap-2"
    >
      <span className="text-xs leading-5 text-zinc-700">{confirmMessage}</span>
      {/* Фокус переходит на подтверждение: с клавиатуры и экранного диктора
          видно, что нужен ещё один шаг. */}
      <button type="submit" autoFocus className={className} {...props}>
        Да,{" "}
        {typeof children === "string" ? children.toLowerCase() : "выполнить"}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-xs text-zinc-500 underline underline-offset-2"
      >
        Отмена
      </button>
    </span>
  );
}
