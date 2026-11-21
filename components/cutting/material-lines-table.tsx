import {
  materialLineQuantityText,
  materialLineSizeText,
  type MaterialLine,
} from "@/features/cutting/material-lines";
import { cn } from "@/lib/utils";

// Таблица «Листы» и «Кромка» заказа: карточка заявки, маршрутный лист и
// станции цеха. Привозное выделено, чтобы цех не искал его на складе.
export function MaterialLinesTable({
  lines,
  compact = false,
  print = false,
}: {
  lines: MaterialLine[];
  compact?: boolean;
  print?: boolean;
}) {
  if (!lines.length) return null;
  const groups = [
    ["Листы", lines.filter((line) => line.kind === "SHEET")],
    ["Кромка", lines.filter((line) => line.kind === "EDGE")],
  ] as const;

  return (
    <div className={cn("grid", print ? "gap-[3mm]" : "gap-4")}>
      {groups.map(([title, list]) =>
        list.length ? (
          <div key={title} className="min-w-0">
            <p
              className={cn(
                "font-semibold text-[var(--foreground)]",
                print ? "text-[10px] uppercase" : "text-sm",
              )}
            >
              {title}
            </p>
            <table
              className={cn(
                "mt-1 w-full table-fixed border-collapse text-left",
                print ? "text-[10px] leading-4" : "text-sm",
              )}
            >
              <thead>
                <tr className="text-[var(--muted)]">
                  <th className="w-7 border-b border-[color:var(--line)] py-1 pr-2 font-normal">
                    №
                  </th>
                  <th className="border-b border-[color:var(--line)] py-1 pr-2 font-normal">
                    Материал
                  </th>
                  {compact ? null : (
                    <th
                      className={cn(
                        "border-b border-[color:var(--line)] py-1 pr-2 font-normal",
                        print ? "w-[32mm]" : "w-36",
                      )}
                    >
                      Размер
                    </th>
                  )}
                  <th
                    className={cn(
                      "border-b border-[color:var(--line)] py-1 pr-2 text-right font-normal whitespace-nowrap",
                      print ? "w-[18mm]" : "w-20",
                    )}
                  >
                    Кол-во
                  </th>
                  <th
                    className={cn(
                      "border-b border-[color:var(--line)] py-1 font-normal",
                      print ? "w-[22mm]" : "w-24",
                    )}
                  >
                    Откуда
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((line, index) => {
                  const size = materialLineSizeText(line);
                  return (
                    <tr key={index} className="align-top">
                      <td className="border-b border-[color:var(--line)] py-1.5 pr-2 text-[var(--muted)]">
                        {index + 1}
                      </td>
                      <td className="border-b border-[color:var(--line)] py-1.5 pr-2 break-words">
                        <span className="font-medium text-[var(--foreground)]">
                          {line.name}
                        </span>
                        {line.sku ? (
                          <span className="ml-1 text-xs text-[var(--muted)]">
                            {line.sku}
                          </span>
                        ) : null}
                        {compact && size ? (
                          <span className="block text-xs text-[var(--muted)]">
                            {size}
                          </span>
                        ) : null}
                        {line.note ? (
                          <span className="block text-xs text-[var(--muted)]">
                            {line.note}
                          </span>
                        ) : null}
                      </td>
                      {compact ? null : (
                        <td className="border-b border-[color:var(--line)] py-1.5 pr-2 break-words">
                          {size ?? "—"}
                        </td>
                      )}
                      <td className="border-b border-[color:var(--line)] py-1.5 pr-2 text-right font-semibold whitespace-nowrap">
                        {materialLineQuantityText(line) ?? "—"}
                      </td>
                      <td className="border-b border-[color:var(--line)] py-1.5 whitespace-nowrap">
                        {line.source === "CLIENT" ? (
                          <span
                            className={cn(
                              "font-semibold",
                              print
                                ? "border border-black px-1"
                                : "bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900",
                            )}
                          >
                            Привозной
                          </span>
                        ) : (
                          <span
                            className={cn(
                              print
                                ? ""
                                : "bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800",
                            )}
                          >
                            Магазин
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null,
      )}
    </div>
  );
}
