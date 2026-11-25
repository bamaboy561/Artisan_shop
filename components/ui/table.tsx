import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Column = {
  key: string;
  label: string;
  // В режиме layout="cards" поле занимает всю ширину карточки.
  wide?: boolean;
};

type Row = Record<string, ReactNode>;

type DataTableProps = {
  columns: Column[];
  rows: Row[];
  caption?: string;
  emptyMessage?: string;
  variant?: "card" | "embedded";
  // "alert" — строка подсвечивается красным (например, новая заявка с сайта).
  rowTones?: Array<"alert" | undefined>;
  // "cards" — карточки на любой ширине (для узких колонок, например в кабинете,
  // где 8 столбцов таблицы не помещаются и текст ломается по слову в строке).
  layout?: "auto" | "cards";
  // Плотные строки для рабочих списков админки.
  compact?: boolean;
};

export function DataTable({
  columns,
  rows,
  caption,
  emptyMessage = "Данные появятся здесь после первых операций.",
  variant = "card",
  rowTones,
  layout = "auto",
  compact = false,
}: DataTableProps) {
  const isEmbedded = variant === "embedded";
  const cardsOnly = layout === "cards";

  return (
    <div
      className={
        isEmbedded
          ? "max-w-full overflow-hidden bg-[var(--surface-strong)]"
          : "max-w-full overflow-hidden rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] shadow-[0_18px_50px_rgba(30,28,25,0.04)]"
      }
    >
      {rows.length > 0 ? (
        <div
          className={
            cardsOnly ? "grid gap-3 p-3 sm:p-4" : "grid gap-3 p-3 lg:hidden"
          }
        >
          {rows.map((row, rowIndex) => (
            <article
              key={`card-row-${rowIndex}`}
              className={
                rowTones?.[rowIndex] === "alert"
                  ? "rounded-[18px] border-2 border-red-500 bg-red-50 p-3.5 text-sm text-[var(--foreground)]"
                  : "rounded-[18px] border border-[color:var(--line)] bg-[#fbfaf8] p-3.5 text-sm text-[var(--foreground)]"
              }
            >
              <div
                className={
                  cardsOnly
                    ? "grid gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4 xl:grid-cols-3"
                    : "grid gap-3"
                }
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={
                      cardsOnly
                        ? `grid min-w-0 content-start gap-1 border-b border-[color:var(--line)] pb-2.5 last:border-0 last:pb-0 sm:border-0 sm:pb-0 ${column.wide ? "sm:col-span-2 xl:col-span-3" : ""}`
                        : "grid gap-1 border-b border-[color:var(--line)] pb-2.5 last:border-0 last:pb-0"
                    }
                  >
                    <p className="text-xs font-medium text-[var(--muted)]">
                      {column.label}
                    </p>
                    <div className="min-w-0 break-words">{row[column.key]}</div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div
          className={
            cardsOnly
              ? "px-5 py-10 text-center text-sm leading-6 text-[var(--muted)]"
              : "px-5 py-10 text-center text-sm leading-6 text-[var(--muted)] lg:hidden"
          }
        >
          {emptyMessage}
        </div>
      )}

      <div
        className={
          cardsOnly ? "hidden" : "hidden max-w-full overflow-x-auto lg:block"
        }
      >
        <table className="min-w-full border-collapse text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-[var(--surface-strong)]">
            <tr className="border-b border-[color:var(--line)]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "py-3 text-xs font-medium text-[var(--muted)]",
                    compact
                      ? "px-4 first:pl-5 last:pr-5 last:text-right"
                      : "px-5",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr
                  key={`row-${rowIndex}`}
                  className={
                    rowTones?.[rowIndex] === "alert" && compact
                      ? "border-b border-[color:var(--line)] bg-[#fffafa] text-[var(--foreground)] shadow-[inset_3px_0_0_#dc2626] transition last:border-b-0 hover:bg-red-50"
                      : rowTones?.[rowIndex] === "alert"
                        ? "border-b border-l-4 border-[color:var(--line)] border-l-red-600 bg-red-50 text-[var(--foreground)] transition last:border-b-0 hover:bg-red-100"
                        : "border-b border-[color:var(--line)] text-[var(--foreground)] transition last:border-0 hover:bg-[#faf8f5]"
                  }
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "align-middle break-words",
                        compact
                          ? "px-4 py-2.5 first:pl-5 last:pr-5"
                          : "max-w-[18rem] px-5 py-3.5",
                      )}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="border-t border-[color:var(--line)] text-[var(--muted)]">
                <td colSpan={columns.length} className="px-5 py-10 text-center">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
