import { ButtonLink } from "@/components/ui/button-link";

type CtaBlockProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: {
    href: string;
    label: string;
  };
  secondaryCta?: {
    href: string;
    label: string;
  };
};

export function CtaBlock({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
}: CtaBlockProps) {
  return (
    <section className="overflow-hidden rounded-[24px] bg-[var(--hero)] p-8 text-white sm:p-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
        <div className="space-y-3">
          <p className="font-mono text-xs tracking-[0.3em] text-white/52 uppercase">
            {eyebrow}
          </p>
          <h2 className="font-display text-2xl leading-tight text-balance sm:text-3xl">
            {title}
          </h2>
        </div>
        <div className="space-y-4">
          <p className="max-w-xl text-sm leading-6 text-white/72">
            {description}
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={primaryCta.href} variant="contrast" icon>
              {primaryCta.label}
            </ButtonLink>
            {secondaryCta ? (
              <ButtonLink
                href={secondaryCta.href}
                variant="secondary"
                className="border-white/16 bg-white/10 text-white hover:border-white/32 hover:bg-white/16"
              >
                {secondaryCta.label}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
