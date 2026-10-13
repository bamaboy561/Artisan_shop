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
    <div className="min-w-0 rounded-[20px] border border-[color:var(--line)] bg-white p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
        <span className={cn("size-2 rounded-full", toneMap[tone])} />
      </div>

      <p className="mt-3 text-2xl leading-none font-semibold text-[var(--foreground)] sm:mt-4 sm:text-[1.95rem]">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{detail}</p>
    </div>
  );
}
