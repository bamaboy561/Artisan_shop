import type { Metadata } from "next";
import Link from "next/link";

import { type BrandProfile, getBrandProfiles } from "@/features/brands/data";

export const metadata: Metadata = {
  title: "Бренды",
  description:
    "Все бренды Artisan: EXTRAVERT, SWISS KRONO, AGT и другие — логотипы, описания и переход в каталог.",
};

function getBrandMonogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getWordmarkClass(name: string) {
  if (name.length > 18) {
    return "text-[1.8rem] sm:text-[2.2rem]";
  }

  if (name.length > 12) {
    return "text-[2.15rem] sm:text-[2.8rem]";
  }

  return "text-[2.5rem] sm:text-[3.2rem]";
}

function BrandCard({ profile }: { profile: BrandProfile }) {
  const logoStyle = profile.logoUrl
    ? { backgroundImage: `url(${profile.logoUrl})` }
    : undefined;

  return (
    <Link
      href={profile.brandPageHref}
      className="group view-rise block border border-[#151411]/10 bg-white/80 p-5 transition hover:border-[#151411] hover:bg-white"
    >
      <div className="relative flex min-h-[15.5rem] items-end overflow-hidden border border-[#151411]/8 bg-[#f6f2ea] p-5 sm:min-h-[17rem] sm:p-6">
        <div className="absolute inset-x-5 top-5 flex h-[8.7rem] items-center justify-center rounded-[28px] border border-[#151411]/8 bg-white/72 shadow-[0_24px_60px_rgba(21,20,17,0.08)] transition duration-500 group-hover:scale-[1.015] group-hover:bg-white/88 sm:inset-x-6 sm:top-6 sm:h-[9.5rem]">
          <div
            className={
              profile.logoUrl
                ? "h-full w-full bg-contain bg-center bg-no-repeat"
                : "flex h-full w-full items-center justify-center text-[3.6rem] leading-none font-semibold tracking-[-0.06em] text-[#151411] sm:text-[4.7rem]"
            }
            style={logoStyle}
            aria-label={`Логотип ${profile.name}`}
          >
            {profile.logoUrl ? null : getBrandMonogram(profile.name)}
          </div>
        </div>

        <div className="relative z-10">
          <p className="font-mono text-[10px] tracking-[0.16em] text-[#8a837b] uppercase">
            {profile.sectionName}
          </p>
          <h2
            className={`mt-3 max-w-[12ch] leading-[0.92] font-semibold tracking-[-0.06em] text-[#151411] ${getWordmarkClass(profile.name)}`}
          >
            {profile.name}
          </h2>
        </div>
      </div>

      <div className="pt-5">
        <p className="text-[15px] leading-7 text-[#5f5952]">
          {profile.headline}
        </p>
      </div>
    </Link>
  );
}

export default async function BrandsPage() {
  const profiles = await getBrandProfiles();

  return (
    <div className="bg-[#f1eee8]">
      <section className="px-5 pt-14 pb-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <div className="max-w-[46rem]">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[#9d573d] uppercase">
              Бренды
            </p>
            <h1 className="mt-3 text-[2.45rem] leading-[0.95] font-semibold tracking-[-0.05em] text-[#151411] sm:text-[3.6rem]">
              Бренды Artisan.
            </h1>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile, index) => (
              <div key={profile.slug} style={{ animationDelay: `${index * 60}ms` }}>
                <BrandCard profile={profile} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
