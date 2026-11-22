import Link from "next/link";

type PageLinksProps = {
  // Ссылка на текущий срез без номера страницы.
  baseHref: string;
  page: number;
  pageCount: number;
};

function withPage(baseHref: string, page: number) {
  if (page <= 1) return baseHref;
  return `${baseHref}${baseHref.includes("?") ? "&" : "?"}page=${page}`;
}

function visiblePages(page: number, pageCount: number) {
  const pages = new Set<number>([1, pageCount]);
  for (let value = page - 2; value <= page + 2; value += 1) {
    if (value >= 1 && value <= pageCount) pages.add(value);
  }
  return [...pages].sort((left, right) => left - right);
}

export function PageLinks({ baseHref, page, pageCount }: PageLinksProps) {
  if (pageCount <= 1) return null;

  const pages = visiblePages(page, pageCount);
  const itemClass =
    "inline-flex h-9 min-w-9 items-center justify-center border px-3 text-sm transition";

  return (
    <nav
      aria-label="Страницы"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {page > 1 ? (
        <Link
          href={withPage(baseHref, page - 1)}
          scroll={false}
          className={`${itemClass} border-[color:var(--line-strong)] hover:border-[color:var(--foreground)]`}
        >
          ← Новее
        </Link>
      ) : null}
      {pages.map((value, index) => (
        <span key={value} className="contents">
          {index > 0 && value - pages[index - 1] > 1 ? (
            <span className="px-1 text-[var(--muted)]">…</span>
          ) : null}
          <Link
            href={withPage(baseHref, value)}
            scroll={false}
            aria-current={value === page ? "page" : undefined}
            className={
              value === page
                ? `${itemClass} border-[var(--foreground)] bg-[var(--foreground)] font-semibold text-white`
                : `${itemClass} border-[color:var(--line-strong)] hover:border-[color:var(--foreground)]`
            }
          >
            {value}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link
          href={withPage(baseHref, page + 1)}
          scroll={false}
          className={`${itemClass} border-[color:var(--line-strong)] hover:border-[color:var(--foreground)]`}
        >
          Дальше →
        </Link>
      ) : null}
    </nav>
  );
}
