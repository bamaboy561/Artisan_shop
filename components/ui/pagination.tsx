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
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);
  const mobileButtonClassName =
    "inline-flex h-10 items-center justify-center border border-[color:var(--line)] bg-white/80 px-4 font-mono text-[10px] font-semibold tracking-[0.14em] text-[var(--foreground)] uppercase transition";

  return (
    <nav aria-label="Пагинация" className={cn("w-full min-w-0", className)}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:hidden">
        {getHref ? (
          <Link
            href={getHref(prevPage)}
            aria-disabled={currentPage === 1}
            className={cn(
              mobileButtonClassName,
              currentPage === 1 && "pointer-events-none opacity-40",
            )}
          >
            Назад
          </Link>
        ) : (
          <span
            aria-disabled={currentPage === 1}
            className={cn(
              mobileButtonClassName,
              currentPage === 1 && "opacity-40",
            )}
          >
            Назад
          </span>
        )}

        <span className="px-1 text-center font-mono text-[10px] tracking-[0.14em] whitespace-nowrap text-[var(--muted)] uppercase">
          {currentPage} / {totalPages}
        </span>

        {getHref ? (
          <Link
            href={getHref(nextPage)}
            aria-disabled={currentPage === totalPages}
            className={cn(
              mobileButtonClassName,
              currentPage === totalPages && "pointer-events-none opacity-40",
            )}
          >
            Далее
          </Link>
        ) : (
          <span
            aria-disabled={currentPage === totalPages}
            className={cn(
              mobileButtonClassName,
              currentPage === totalPages && "opacity-40",
            )}
          >
            Далее
          </span>
        )}
      </div>

      <div className="hidden max-w-full min-w-0 overflow-x-auto pb-1 sm:block">
        <div className="flex w-max flex-nowrap items-center gap-2">
          {pages.map((page) => {
            const isActive = page === currentPage;
            const sharedClassName =
              "inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none";

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
        </div>
      </div>
    </nav>
  );
}
