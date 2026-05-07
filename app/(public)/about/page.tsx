import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import {
  getCatalogMetrics,
  getPublicProductsByBrand,
  getPublicProductsByCategory,
} from "@/lib/server/catalog-public";
import { companyName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "О компании",
  description:
    "Artisan — рабочая платформа для материалов и сервиса. Каталог, расчет распила и заявки в одном маршруте.",
};

const principles = [
  {
    title: "Каталог без хаоса",
    text: "Панели, МДФ, услуги и распил в одной структуре.",
  },
  {
    title: "Рабочий сервис",
    text: "Подбор, расчет и заявка без лишних шагов.",
  },
  {
    title: "Основа для роста",
    text: "Каталог, сервис и коммерческая логика в одной системе.",
  },
];

export default async function AboutPage() {
  const [catalogMetrics, mdfProducts, extravertProducts] = await Promise.all([
    getCatalogMetrics(),
    getPublicProductsByCategory("mdf-panels"),
    getPublicProductsByBrand("extravert"),
  ]);
  const heroImage =
    mdfProducts[2]?.image || extravertProducts[0]?.image || "";

  return (
    <div className="bg-background">
      <section className="relative overflow-hidden bg-[var(--hero)] text-white">
        <Image
          src={heroImage}
          alt="Artisan"
          fill
          priority
          className="object-cover opacity-28"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.46)_52%,rgba(0,0,0,0.82)_100%)]" />
        <div className="relative mx-auto flex min-h-[48svh] max-w-[1500px] flex-col justify-end px-5 pt-20 pb-8 sm:px-8 lg:px-10">
          <div className="max-w-[38rem]">
            <p className="font-mono text-[10px] tracking-[0.22em] text-white/58 uppercase">
              О компании
            </p>
            <h1 className="mt-3 text-[2.15rem] leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-[3rem]">
              {companyName} для материалов и распила.
            </h1>
            <p className="mt-4 max-w-[33rem] text-sm leading-6 text-white/72">
              Каталог, распил и заявки в одном маршруте.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Подход
            </p>
            <h2 className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Меньше шума, больше дела.
            </h2>
          </div>

          <div className="grid gap-0 border border-[color:var(--line)] bg-[var(--surface-strong)]">
            {principles.map((item, index) => (
              <div
                key={item.title}
                className="grid gap-4 border-b border-[color:var(--line)] p-5 last:border-b-0 sm:grid-cols-[90px_minmax(0,1fr)]"
              >
                <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                  0{index + 1}
                </p>
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[color:var(--line)] bg-[var(--surface-strong)] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-5 sm:grid-cols-3">
          {[
            ["Материалов", catalogMetrics.productCount],
            ["Бренда", catalogMetrics.brandCount],
            ["Сценария", 3],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-l border-[color:var(--line)] pl-5"
            >
              <p className="text-3xl font-semibold text-[var(--foreground)]">
                {value}
              </p>
              <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 border border-[color:var(--line)] bg-[#151411] p-6 text-white sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[34rem]">
            <p className="font-mono text-[10px] tracking-[0.22em] text-white/50 uppercase">
              Далее
            </p>
            <h2 className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-[-0.04em]">
              Откройте каталог или рассчитайте распил.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className="inline-flex h-11 items-center border border-white/42 px-8 font-mono text-[11px] tracking-[0.14em] text-white uppercase transition hover:bg-white hover:text-black"
            >
              Каталог
            </Link>
            <Link
              href="/calculator"
              className="inline-flex h-11 items-center border border-white/24 px-8 font-mono text-[11px] tracking-[0.14em] text-white uppercase transition hover:bg-white hover:text-black"
            >
              Распил
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
