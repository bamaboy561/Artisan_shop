import { Search } from "lucide-react";

// Строка общего поиска по админке. Обычная форма: работает без скриптов и
// открывает страницу результатов.
export function AdminSearchForm({
  defaultValue = "",
  className = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <form action="/admin/search" role="search" className={className}>
      <label className="relative block">
        <span className="sr-only">Поиск по клиентам, заказам и заявкам</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          minLength={2}
          maxLength={120}
          placeholder="Имя, телефон или номер заказа"
          className="h-10 w-full rounded-full border border-[color:var(--line)] bg-white pr-4 pl-10 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[color:var(--solid)]"
        />
      </label>
    </form>
  );
}
