import { cn } from "@/lib/utils";

type PageHeadingProps = {
  title: string;
  description?: string;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function PageHeading({
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
}: PageHeadingProps) {
  return (
    <div className={cn("max-w-3xl space-y-3", className)}>
      <h1
        className={cn(
          "text-4xl leading-tight font-semibold text-balance text-[var(--foreground)] sm:text-5xl",
          titleClassName,
        )}
      >
        {title}
      </h1>
      {description ? (
        <p
          className={cn(
            "max-w-2xl text-base leading-7 text-[var(--muted)]",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
