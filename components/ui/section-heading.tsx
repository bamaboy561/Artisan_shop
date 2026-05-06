import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  title: string;
  description?: string;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function SectionHeading({
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
}: SectionHeadingProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <h2
        className={cn(
          "text-3xl font-semibold text-[var(--foreground)] sm:text-4xl",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn("text-base text-[var(--muted)]", descriptionClassName)}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
