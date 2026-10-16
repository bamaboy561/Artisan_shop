import { Download, ListPlus } from "lucide-react";
import Link from "next/link";
import {
  clearStockPendingItemsAction,
  dismissStockPendingItemAction,
} from "@/app/admin/products/stock-import-actions";
import { StockPendingLink } from "@/app/admin/products/stock-pending-link";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import type { StockPendingListItem } from "@/lib/server/stock-pending";

const VISIBLE_LIMIT = 500;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

// Позиции из отчётов остатков, которых ещё нет на сайте. Уходят из списка
// сами, когда появляется товар с тем же артикулом, или по кнопке «Не добавлять».
export function StockPendingList({
  items,
}: {
  items: StockPendingListItem[] | null;
}) {
  return (
    <details
      id="stock-pending"
      open={Boolean(items?.length)}
      className="min-w-0 border-y border-[color:var(--line)] bg-white p-3 sm:p-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
            <ListPlus className="size-5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              Нет на сайте
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">
              Позиции из отчётов остатков, для которых нужно завести карточку
            </span>
          </span>
        </span>
        <span className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] tabular-nums">
          {items ? items.length : "—"}
        </span>
      </summary>

      <div className="mt-4 min-w-0 space-y-3">
        {items === null ? (
          <p className="text-sm text-amber-800">
            Список ещё не подключён: примените схему базы (prisma db push).
          </p>
        ) : !items.length ? (
          <p className="text-sm text-[var(--muted)]">
            Пусто. После загрузки отчёта остатков сюда попадут позиции, которых
            нет на сайте.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
              <a
                href="/api/admin/products/pending-export"
                download
                className="inline-flex items-center gap-2 font-medium text-[var(--foreground)] underline underline-offset-4"
              >
                <Download className="size-4" />
                Или скачать всё в Excel
              </a>
              <form action={clearStockPendingItemsAction}>
                <ConfirmDeleteButton
                  confirmMessage={`Очистить список «Нет на сайте» (${items.length})? Позиции уберутся, а при следующей загрузке отчёта список соберётся заново. Запомненные совпадения «Это он» сохранятся.`}
                  className="rounded-full border border-zinc-300 px-2.5 py-1 font-medium whitespace-nowrap text-zinc-700 hover:border-zinc-500"
                >
                  Очистить список
                </ConfirmDeleteButton>
              </form>
              <span>
                Проще всего нажать «Добавить» у позиции: название, артикул и
                остаток подставятся сами. Если товар уже есть на сайте под
                другим названием, нажмите «Это он» и выберите его, затем снова
                проверьте файл: остаток запишется, и дальше товар найдётся сам.
              </span>
            </div>
            <div
              className="max-h-[28rem] overflow-auto border-y border-zinc-200"
              tabIndex={0}
              role="region"
              aria-label="Позиции, которых нет на сайте"
            >
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="sticky top-0 bg-zinc-100">
                  <tr>
                    <th className="p-2 font-medium">Позиция</th>
                    <th className="p-2 font-medium">Артикул</th>
                    <th className="p-2 text-right font-medium">В отчёте</th>
                    <th className="p-2 font-medium">Последний раз</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, VISIBLE_LIMIT).map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-zinc-200 align-top"
                    >
                      <td className="max-w-72 p-2 break-words">
                        <p className="font-medium">{item.name}</p>
                        {item.note ? (
                          <p className="mt-1 text-amber-800">{item.note}</p>
                        ) : null}
                        <StockPendingLink
                          id={item.id}
                          suggestions={item.suggestions}
                        />
                      </td>
                      <td className="p-2 font-mono break-all text-zinc-600">
                        {item.sku ?? "—"}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap tabular-nums">
                        {item.quantity === null
                          ? "—"
                          : item.quantity.toLocaleString("ru-RU")}{" "}
                        {item.unit ?? ""}
                      </td>
                      <td
                        className="p-2 whitespace-nowrap text-zinc-600"
                        title={item.sourceFile ?? undefined}
                      >
                        {formatDate(item.lastSeenAt)}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Link
                            href={`/admin/products?fromPending=${encodeURIComponent(item.id)}#new-product`}
                            className="rounded-full bg-[#171613] px-2.5 py-1 font-medium whitespace-nowrap text-white hover:bg-black"
                          >
                            Добавить
                          </Link>
                          <form action={dismissStockPendingItemAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <ConfirmDeleteButton
                              confirmMessage={`Не добавлять «${item.name}» на сайт? Позиция больше не появится в списке.`}
                              className="rounded-full border border-zinc-300 px-2.5 py-1 font-medium whitespace-nowrap text-zinc-600 hover:border-zinc-500"
                            >
                              Не добавлять
                            </ConfirmDeleteButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length > VISIBLE_LIMIT ? (
              <p className="text-xs text-zinc-500">
                Показано {VISIBLE_LIMIT} из {items.length}. Полный список в
                файле Excel.
              </p>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}
