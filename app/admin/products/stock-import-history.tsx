import { History } from "lucide-react";
import { undoStockImportAction } from "@/app/admin/products/stock-import-actions";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import type { StockImportHistoryItem } from "@/lib/server/stock-history";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Последние загрузки остатков. Отменить можно последнюю неотменённую:
// товары, которые после неё уже поменялись, остаются как есть.
export function StockImportHistory({
  items,
}: {
  items: StockImportHistoryItem[] | null;
}) {
  if (!items?.length) return null;
  const undoableId = items.find((item) => !item.undoneAt)?.id;
  return (
    <details className="min-w-0 border-y border-[color:var(--line)] bg-white p-3 sm:p-4">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
          <History className="size-5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            История загрузок
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">
            Если загрузили не тот файл, последнюю загрузку можно отменить
          </span>
        </span>
      </summary>
      <ul className="mt-4 divide-y divide-zinc-200 text-xs">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <span className="min-w-0">
              <span className="font-medium break-all">{item.fileName}</span>
              <span className="block text-zinc-600">
                {formatDate(item.createdAt)} · изменено товаров:{" "}
                {item.changedCount}
                {item.linkCount
                  ? ` · запомнено совпадений: ${item.linkCount}`
                  : ""}
              </span>
            </span>
            {item.undoneAt ? (
              <span className="text-zinc-500">
                Отменено {formatDate(item.undoneAt)}
              </span>
            ) : item.id === undoableId ? (
              <form action={undoStockImportAction}>
                <input type="hidden" name="id" value={item.id} />
                <ConfirmDeleteButton
                  confirmMessage={`Отменить загрузку «${item.fileName}»? Остатки вернутся как были до неё, кроме товаров, которые с тех пор уже поменялись.`}
                  className="rounded-full border border-zinc-300 px-2.5 py-1 font-medium whitespace-nowrap text-zinc-700 hover:border-zinc-500"
                >
                  Отменить
                </ConfirmDeleteButton>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
