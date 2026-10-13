import { cn } from "@/lib/utils";

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
};

export function SectionIntro({
  eyebrow,
  title,
  description,
  className,
}: SectionIntroProps) {
  return (
    <div className={cn("max-w-3xl space-y-3", className)}>
      <p className="text-xs text-[var(--accent)] font-medium">
        {eyebrow}
      </p>
      <h2 className="text-2xl leading-tight font-semibold text-balance text-[var(--foreground)] sm:text-3xl">
        {title}
      </h2>
      <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}
