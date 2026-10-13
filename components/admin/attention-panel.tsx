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

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#e3ddd2] bg-white shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
      <div className="flex items-center gap-3 border-b border-[#e3ddd2] px-5 py-4">
        {groups.length > 0 ? (
          <TriangleAlert className="size-5 shrink-0 text-[#c4532b]" />
        ) : (
          <CircleCheck className="size-5 shrink-0 text-[#3f7d58]" />
        )}
        <h2 className="text-lg font-semibold text-[#1b1c19]">
          Требует внимания
        </h2>
      </div>
      {groups.length === 0 ? (
        <p className="px-5 py-4 text-sm text-[#6b665e]">
          Зависших заказов и заявок нет.
        </p>
      ) : (
        <div className="grid gap-px bg-[#e3ddd2] md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((group) => (
            <div key={group.key} className="bg-white px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={group.href}
                  className="text-sm font-semibold text-[#1b1c19] transition hover:text-[#c4532b]"
                >
                  {group.title}
                </Link>
                <span className="text-2xl font-semibold text-[#c4532b]">
                  {group.count}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#6b665e]">{group.hint}</p>
              <ul className="mt-3 grid gap-1.5 text-sm">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-baseline justify-between gap-3 transition hover:text-[#c4532b]"
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                      <span className="shrink-0 text-xs text-[#6b665e]">
                        {item.detail}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {group.count > group.items.length ? (
                <Link
                  href={group.href}
                  className="mt-2 inline-block text-xs font-medium text-[#c4532b] hover:text-[#9f4327]"
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
