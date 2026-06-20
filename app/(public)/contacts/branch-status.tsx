"use client";

import { useEffect, useState } from "react";

import type { CompanyBranchSchedule } from "@/lib/site-config";

const BISHKEK_OFFSET_HOURS = 6;

function getBishkekNow(): { day: number; minutes: number } {
  const utcMs = Date.now();
  const bishkekMs = utcMs + BISHKEK_OFFSET_HOURS * 60 * 60 * 1000;
  const bishkek = new Date(bishkekMs);
  return {
    day: bishkek.getUTCDay(),
    minutes: bishkek.getUTCHours() * 60 + bishkek.getUTCMinutes(),
  };
}

function isOpen(
  schedule: CompanyBranchSchedule[],
  now: { day: number; minutes: number },
) {
  return schedule.some(
    (slot) =>
      slot.days.includes(now.day) &&
      now.minutes >= slot.open * 60 &&
      now.minutes < slot.close * 60,
  );
}

export function BranchStatus({
  schedule,
}: {
  schedule: CompanyBranchSchedule[];
}) {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const tick = () => setOpen(isOpen(schedule, getBishkekNow()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [schedule]);

  if (open === null) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-[var(--muted)] uppercase">
        <span className="size-1.5 rounded-full bg-[var(--muted)]/40" />
        Расписание
      </span>
    );
  }

  return open ? (
    <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-[var(--accent)] uppercase">
      <span className="relative flex size-1.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)]/60" />
        <span className="relative size-1.5 rounded-full bg-[var(--accent)]" />
      </span>
      Открыто сейчас
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-[var(--muted)] uppercase">
      <span className="size-1.5 rounded-full bg-[var(--muted)]/45" />
      Закрыто
    </span>
  );
}
