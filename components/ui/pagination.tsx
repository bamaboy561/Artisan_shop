import Link from "next/link";

import { cn } from "@/lib/utils";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  getHref?: (page: number) => string;
  className?: string;
};

export function Pagination({
  currentPage,
  totalPages,
  getHref,
  className,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      aria-label="Пагинация"
      className={cn(
        "flex flex-nowrap items-center gap-2 overflow-x-auto pb-1",
        className,
      )}
    >
      {pages.map((page) => {
        const isActive = page === currentPage;
        const sharedClassName =
          "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-semibold transition sm:h-10 sm:min-w-10 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none";

        if (getHref) {
          return (
            <Link
              key={page}
              href={getHref(page)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                sharedClassName,
                isActive
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                  : "border-[color:var(--line)] bg-white/78 text-[var(--foreground)] hover:border-[color:var(--line-strong)]",
              )}
            >
              {page}
            </Link>
          );
        }

        return (
          <span
            key={page}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              sharedClassName,
              isActive
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                : "border-[color:var(--line)] bg-white/78 text-[var(--foreground)]",
            )}
          >
            {page}
          </span>
        );
      })}
    </nav>
  );
}
