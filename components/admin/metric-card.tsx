import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string | number;
  detail: string;
  tone?: "accent" | "success" | "warning" | "neutral";
};

const toneMap = {
  accent: "bg-[var(--accent)]",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  neutral: "bg-black/16",
} as const;

export function MetricCard({
  label,
  value,
  detail,
  tone = "accent",
}: MetricCardProps) {
  return (
    <div className="surface-glow rounded-[20px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_20px_56px_rgba(17,17,17,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
          {label}
        </p>
        <span className={cn("size-2 rounded-full", toneMap[tone])} />
      </div>

      <p className="mt-4 text-[1.95rem] font-semibold leading-none text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{detail}</p>
    </div>
  );
}
