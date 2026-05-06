import Link from "next/link";

import { cn } from "@/lib/utils";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav
      className={cn("text-sm text-[var(--muted)]", className)}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.href ? (
            <Link href={item.href} className="hover:text-[var(--foreground)]">
              {item.label}
            </Link>
          ) : (
            <span className="text-[var(--foreground)]">{item.label}</span>
          )}
          {index < items.length - 1 ? " / " : null}
        </span>
      ))}
    </nav>
  );
}
