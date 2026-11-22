import Link from "next/link";
import { CircleCheck, TriangleAlert } from "lucide-react";

import { getAttentionSummary } from "@/lib/server/attention";

// «Требует внимания» на главной админки: что зависло и куда нажать.
export async function AttentionPanel() {
  let summary: Awaited<ReturnType<typeof getAttentionSummary>> = null;

  try {
    summary = await getAttentionSummary();
  } catch (error) {
    console.error("[admin:attention]", error);
  }

  if (!summary) {
    return null;
  }

  const groups = summary.groups.filter((group) => group.count > 0);
  const layout = attentionGridLayout(groups.length);

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--line)] bg-white shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
      <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-4">
        {groups.length > 0 ? (
          <TriangleAlert className="size-5 shrink-0 text-[var(--accent)]" />
        ) : (
          <CircleCheck className="size-5 shrink-0 text-[#3f7d58]" />
        )}
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Требует внимания
        </h2>
      </div>
      {groups.length === 0 ? (
        <p className="px-5 py-4 text-sm text-[var(--muted)]">
          Зависших заказов и заявок нет.
        </p>
      ) : (
        <div
          className={`grid grid-cols-1 gap-px bg-[var(--line)] ${layout.grid}`}
        >
          {groups.map((group, index) => (
            <div
              key={group.key}
              className={`flex min-w-0 flex-col bg-white px-5 py-4 ${
                index === groups.length - 1 ? layout.last : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={group.href}
                    className="block text-sm font-semibold text-[var(--foreground)] transition hover:text-[var(--accent-strong)]"
                  >
                    {group.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {group.hint}
                  </p>
                </div>
                <span className="shrink-0 text-2xl leading-none font-semibold text-[var(--accent)] tabular-nums">
                  {group.count}
                </span>
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 text-sm">
                {group.items.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <Link
                      href={item.href}
                      title={item.label}
                      className="flex min-w-0 items-baseline gap-3 transition hover:text-[var(--accent-strong)]"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      <span className="shrink-0 text-right text-xs whitespace-nowrap text-[var(--muted)] tabular-nums">
                        {item.detail}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {group.count > group.items.length ? (
                <Link
                  href={group.href}
                  className="mt-3 self-start text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  Показать все: {group.count}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Сетка без пустых дыр: 4 группы — 2×2, а последняя карточка растягивается
// на оставшиеся колонки ряда. Классы написаны целиком, чтобы Tailwind их увидел.
function attentionGridLayout(count: number) {
  const mdCols = count >= 2 ? 2 : 1;
  const wideCols = count === 4 ? 2 : Math.min(Math.max(count, 1), 3);
  const mdSpan = mdCols - (count % mdCols || mdCols) + 1;
  const wideSpan = wideCols - (count % wideCols || wideCols) + 1;

  const grid = [
    mdCols === 2 ? "md:grid-cols-2" : "",
    wideCols === 3
      ? "2xl:grid-cols-3"
      : wideCols === 2
        ? "2xl:grid-cols-2"
        : "2xl:grid-cols-1",
  ].join(" ");
  const last = [
    mdSpan === 2 ? "md:col-span-2" : "",
    wideSpan === 3
      ? "2xl:col-span-3"
      : wideSpan === 2
        ? "2xl:col-span-2"
        : "2xl:col-span-1",
  ].join(" ");

  return { grid, last };
}
