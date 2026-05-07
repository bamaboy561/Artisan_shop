import type { OperationEventDto } from "@/lib/server/operation-events";

type ClientOperationTimelineProps = {
  events: OperationEventDto[];
  emptyMessage: string;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function ClientOperationTimeline({
  events,
  emptyMessage,
}: ClientOperationTimelineProps) {
  const visibleEvents = events.slice(0, 4);

  if (visibleEvents.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {visibleEvents.map((event, index) => (
        <article
          key={event.id}
          className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-sm"
        >
          <span className="relative mt-1 flex size-4 items-center justify-center rounded-full border border-[color:var(--line-strong)] bg-white">
            <span className="size-1.5 rounded-full bg-[var(--accent)]" />
            {index < visibleEvents.length - 1 ? (
              <span className="absolute top-4 h-7 w-px bg-[var(--line)]" />
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-[var(--foreground)]">
              {event.title}
            </span>
            {event.description ? (
              <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">
                {event.description}
              </span>
            ) : null}
            <span className="mt-1 block font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
              {formatDate(event.createdAt)}
            </span>
          </span>
        </article>
      ))}
    </div>
  );
}
