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
};

export function DataTable({
  columns,
  rows,
  caption,
  emptyMessage = "Данные появятся здесь после первых операций.",
}: DataTableProps) {
  return (
    <div className="surface-glow overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-white/82">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-[var(--surface)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-[11px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase"
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
                  className="border-t border-[color:var(--line)] text-[var(--foreground)] transition hover:bg-black/[0.015]"
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3.5 align-top">
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="border-t border-[color:var(--line)] text-[var(--muted)]">
                <td colSpan={columns.length} className="px-4 py-10 text-center">
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
