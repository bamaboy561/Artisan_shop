import type { OperationEventDto } from "@/lib/server/operation-events";

type OperationTimelineProps = {
  events: OperationEventDto[];
  emptyMessage: string;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getEventDotClass(eventType: string) {
  switch (eventType) {
    case "created":
      return "bg-blue-500";
    case "status":
      return "bg-[#c65b3a]";
    case "manager":
      return "bg-amber-500";
    case "converted":
      return "bg-emerald-600";
    default:
      return "bg-neutral-400";
  }
}

export function OperationTimeline({
  events,
  emptyMessage,
}: OperationTimelineProps) {
  return (
    <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Журнал действий
        </h2>
        <span className="rounded-full border border-[color:var(--line)] px-2.5 py-1 text-xs text-[var(--muted)]">
          {events.length}
        </span>
      </div>

      {events.length > 0 ? (
        <div className="mt-5 space-y-4">
          {events.map((event) => (
            <article
              key={event.id}
              className="grid grid-cols-[12px_minmax(0,1fr)] gap-3"
            >
              <span
                className={`mt-1.5 size-3 rounded-full ${getEventDotClass(
                  event.eventType,
                )}`}
              />
              <div className="min-w-0 border-b border-[color:var(--line)] pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-[var(--foreground)]">
                    {event.title}
                  </p>
                  <span className="text-xs text-[var(--muted)]">
                    {formatDate(event.createdAt)}
                  </span>
                </div>
                {event.description ? (
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    {event.description}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {event.actorName ?? "Система"}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
