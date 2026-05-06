"use client";

import { useEffect, type ReactNode } from "react";

import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="reveal-fade fixed inset-0 z-[80] flex items-end justify-center bg-black/55 px-0 py-0 sm:items-center sm:px-5 sm:py-10"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-modal-in max-h-[90svh] w-full overflow-y-auto rounded-t-[1.6rem] border-x-0 border-t border-b-0 border-white/20 bg-white p-5 shadow-[0_-24px_80px_rgba(8,18,29,0.24)] sm:max-h-[min(90svh,760px)] sm:max-w-xl sm:rounded-[28px] sm:border sm:p-8 sm:shadow-[0_44px_120px_rgba(8,18,29,0.34)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-[1.35rem] font-semibold text-[var(--foreground)] sm:text-2xl">
              {title}
            </h3>
            {description ? (
              <p className="text-sm leading-6 text-[var(--muted)] sm:leading-7">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--line)] p-2 text-[var(--muted)] transition hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            aria-label="Закрыть окно"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 sm:mt-6">{children}</div>
        {footer ? (
          <div className="mt-5 border-t border-[color:var(--line)] pt-5 sm:mt-6 sm:pt-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
