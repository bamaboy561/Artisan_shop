import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ContactForm } from "@/app/(public)/contacts/contact-form";
import { importedExtravertProducts } from "@/features/catalog/data";

export const metadata: Metadata = {
  title: "Контакты",
  description:
    "Свяжитесь с Artisan по вопросам подбора материалов, расчета распила и комплектации проекта.",
};

const contactTopics = [
  "Подбор материала",
  "Расчет распила",
  "Запрос цены",
  "Комплектация проекта",
];

export default function ContactsPage() {
  const heroImage = importedExtravertProducts[2]?.image || "";

  return (
    <div className="bg-background">
      <section className="relative overflow-hidden bg-[var(--hero)] text-white">
        <Image
          src={heroImage}
          alt="Контакты Artisan"
          fill
          priority
          className="object-cover opacity-28"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.46)_52%,rgba(0,0,0,0.82)_100%)]" />
        <div className="relative mx-auto flex min-h-[44svh] max-w-[1500px] flex-col justify-end px-5 pt-20 pb-8 sm:px-8 lg:px-10">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-[36rem]">
              <p className="font-mono text-[10px] tracking-[0.22em] text-white/58 uppercase">
                Контакты
              </p>
              <h1 className="mt-3 text-[2.15rem] leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-[3rem]">
                Свяжитесь с Artisan.
              </h1>
              <p className="mt-4 max-w-[32rem] text-sm leading-6 text-white/72">
                Материалы, распил и проектные запросы.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link
                href="/catalog"
                className="inline-flex h-11 items-center border border-white/42 px-8 font-mono text-[11px] tracking-[0.14em] text-white uppercase transition hover:bg-white hover:text-black"
              >
                Каталог
              </Link>
              <Link
                href="/services#service-request"
                className="inline-flex h-11 items-center border border-white/24 px-8 font-mono text-[11px] tracking-[0.14em] text-white uppercase transition hover:bg-white hover:text-black"
              >
                Заявка
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="border border-[color:var(--line)] bg-[var(--surface-strong)] p-5">
              <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                Темы обращения
              </p>
              <div className="mt-5 grid gap-0 border border-[color:var(--line)]">
                {contactTopics.map((topic, index) => (
                  <div
                    key={topic}
                    className="grid grid-cols-[58px_minmax(0,1fr)] border-b border-[color:var(--line)] last:border-b-0"
                  >
                    <span className="border-r border-[color:var(--line)] p-4 font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
                      0{index + 1}
                    </span>
                    <p className="p-4 text-sm leading-6 text-foreground">
                      {topic}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <ContactForm />
        </div>
      </section>
    </div>
  );
}
