type MetricCardProps = {
  label: string;
  value: string | number;
  detail: string;
};

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <div className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-white/82 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--muted)] uppercase">
          {label}
        </p>
        <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
      </div>

      <p className="mt-4 text-3xl font-semibold leading-none text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </div>
  );
}
