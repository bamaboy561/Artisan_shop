"use client";

import { useState } from "react";
import { linkStockPendingItemAction } from "@/app/admin/products/stock-import-actions";
import { StockProductPicker } from "@/app/admin/products/stock-product-picker";
import type { StockProductOption } from "@/features/admin/stock-import";

// «Это он» в списке «Нет на сайте»: позиция есть на сайте под другим
// названием. Связь запоминается для следующих загрузок.
export function StockPendingLink({
  id,
  suggestions,
}: {
  id: string;
  suggestions: StockProductOption[];
}) {
  const [chosen, setChosen] = useState<StockProductOption | null>(null);
  if (!chosen)
    return <StockProductPicker suggestions={suggestions} onPick={setChosen} />;
  return (
    <form
      action={linkStockPendingItemAction}
      className="mt-2 flex flex-wrap items-center gap-1.5"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="productId" value={chosen.id} />
      <span className="text-xs">
        На сайте: <strong>{chosen.name}</strong>{" "}
        <span className="font-mono text-zinc-500">{chosen.sku}</span>
      </span>
      <button
        type="submit"
        className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white hover:bg-emerald-800"
      >
        Связать
      </button>
      <button
        type="button"
        onClick={() => setChosen(null)}
        className="text-xs text-zinc-500 underline underline-offset-2"
      >
        Другой
      </button>
    </form>
  );
}
