import type { CuttingQuote } from "@/features/cutting/quote";
import { formatPrice } from "@/lib/commerce";

// Счёт по строкам: за что платит клиент.
export function CuttingQuoteLines({
  quote,
  compact = false,
}: {
  quote: CuttingQuote;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid gap-1 text-xs" : "grid gap-1.5 text-sm"}>
      <ul className="grid gap-1">
        {quote.lines.map((line) => (
          <li
            key={line.key}
            className="flex justify-between gap-3 border-b border-[color:var(--line)] pb-1"
          >
            <span>
              <span className="text-[var(--foreground)]">{line.label}</span>
              <span className="block text-[var(--muted)]">{line.detail}</span>
            </span>
            <span className="font-semibold whitespace-nowrap text-[var(--foreground)]">
              {line.amount === null ? "—" : formatPrice(line.amount)}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between gap-3 font-semibold text-[var(--foreground)]">
        <span>Итого за работы</span>
        <span className="whitespace-nowrap">{formatPrice(quote.total)}</span>
      </p>
      {quote.unpricedHoles > 0 ? (
        <p className="text-[var(--muted)]">
          Отверстий без цены: {quote.unpricedHoles}, их стоимость назовёт
          менеджер.
        </p>
      ) : null}
    </div>
  );
}
