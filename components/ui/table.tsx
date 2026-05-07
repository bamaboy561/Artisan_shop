import type { ReactNode } from "react";

type Column = {
  key: string;
  label: string;
};

type Row = Record<string, ReactNode>;

type DataTableProps = {
  columns: Column[];
  rows: Row[];
  caption?: string;
  emptyMessage?: string;
  variant?: "card" | "embedded";
};

export function DataTable({
  columns,
  rows,
  caption,
  emptyMessage = "Данные появятся здесь после первых операций.",
  variant = "card",
}: DataTableProps) {
  const isEmbedded = variant === "embedded";

  return (
    <div
      className={
        isEmbedded
          ? "max-w-full overflow-hidden bg-white"
          : "max-w-full overflow-hidden rounded-xl border border-[#e6e2dc] bg-white shadow-[0_18px_50px_rgba(30,28,25,0.04)]"
      }
    >
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-[640px] border-collapse text-left text-sm lg:min-w-full">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-white">
            <tr className="border-b border-[#e6e2dc]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-5 py-3 text-xs font-medium text-[#77736c]"
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
                  className="border-b border-[#ece8e2] text-[#24221f] transition last:border-0 hover:bg-[#faf8f5]"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="max-w-[18rem] px-5 py-3.5 align-middle break-words"
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="border-t border-[#e6e2dc] text-[#77736c]">
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
