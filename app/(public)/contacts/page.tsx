import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { BranchStatus } from "@/app/(public)/contacts/branch-status";
import { ContactForm } from "@/app/(public)/contacts/contact-form";
import { ContactsFaq } from "@/app/(public)/contacts/faq";
import { StructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata, organizationJsonLd } from "@/lib/seo";
import { companyBranches, companyContacts } from "@/lib/site-config";

export const metadata: Metadata = createSeoMetadata({
  title: "Контакты Artisan — материалы и распил в Бишкеке",
  description:
    "Контакты Artisan в Бишкеке: ЛДСП, МДФ, фурнитура, расчет распила, WhatsApp, телефон, график работы и адреса филиалов.",
  path: "/contacts",
});

const contactTopics = [
  "Подбор материала",
  "Расчет распила",
  "Запрос цены",
  "Комплектация проекта",
];

export default function ContactsPage() {
  return (
    <div className="bg-[#f1eee8]">
      <StructuredData data={organizationJsonLd()} />
      <section className="relative overflow-hidden border-b border-[color:var(--line)] bg-gradient-to-b from-[#f6f1e7] via-[#efeadf] to-[#f1eee8]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--foreground)]/12 to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle_at_1px_1px,#151411_1px,transparent_0)] [background-size:18px_18px]" />

        <div className="relative mx-auto flex max-w-[1500px] flex-col gap-7 px-4 pt-12 pb-10 sm:gap-10 sm:px-8 sm:pt-20 sm:pb-14 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:px-10 lg:pt-24 lg:pb-16">
          <div className="max-w-[42rem]">
            <p className="font-mono text-[10px] tracking-[0.28em] text-[var(--accent)] uppercase sm:text-[11px]">
              Контакты
            </p>
            <h1 className="mt-3 text-[2.1rem] leading-[0.96] font-semibold tracking-[-0.045em] text-balance text-[var(--foreground)] sm:mt-4 sm:text-[3.4rem] lg:text-[3.8rem]">
              Свяжитесь с Artisan.
            </h1>
            <p className="mt-4 max-w-[36rem] text-[14px] leading-[1.7] text-[var(--muted)] sm:mt-5 sm:text-[15px]">
              Подберём материалы, согласуем распил и комплектацию проекта. Отвечаем по телефону, в WhatsApp и на встречах в наших филиалах.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              href={`tel:${companyContacts.phoneTel}`}
              className="inline-flex h-11 items-center gap-2 bg-[var(--foreground)] px-6 font-mono text-[11px] tracking-[0.16em] text-white uppercase transition hover:bg-[#9d573d]"
            >
              <Phone className="size-3.5" />
              Позвонить
            </Link>
            <Link
              href={companyContacts.whatsapp}
              className="inline-flex h-11 items-center gap-2 border border-[var(--foreground)] px-6 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:bg-[var(--foreground)] hover:text-white"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-3.5" />
              WhatsApp
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-7 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-3 sm:grid-cols-3 sm:gap-4">
          <a
            href={`tel:${companyContacts.phoneTel}`}
            className="group flex flex-col gap-2 border border-[color:var(--line)] bg-white/72 px-5 py-5 transition hover:border-[var(--foreground)] hover:bg-white sm:px-6 sm:py-6"
          >
            <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
              <Phone className="size-3" />
              Телефон
            </span>
            <span className="text-[1.1rem] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[1.25rem]">
              {companyContacts.phone}
            </span>
            <span className="text-[12px] leading-5 text-[var(--muted)]">
              {companyContacts.hours}
            </span>
          </a>

          <a
            href={`mailto:${companyContacts.email}`}
            className="group flex flex-col gap-2 border border-[color:var(--line)] bg-white/72 px-5 py-5 transition hover:border-[var(--foreground)] hover:bg-white sm:px-6 sm:py-6"
          >
            <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
              <Mail className="size-3" />
              Email
            </span>
            <span className="text-[1.1rem] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[1.25rem]">
              {companyContacts.email}
            </span>
            <span className="text-[12px] leading-5 text-[var(--muted)]">
              Для коммерческих и проектных запросов.
            </span>
          </a>

          <a
            href={companyContacts.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col gap-2 border border-[color:var(--line)] bg-white/72 px-5 py-5 transition hover:border-[var(--foreground)] hover:bg-white sm:px-6 sm:py-6"
          >
            <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
              <MessageCircle className="size-3" />
              WhatsApp
            </span>
            <span className="text-[1.1rem] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[1.25rem]">
              {companyContacts.phone}
            </span>
            <span className="text-[12px] leading-5 text-[var(--muted)]">
              Быстрая переписка и отправка карты раскроя.
            </span>
          </a>
        </div>
      </section>

      <section className="border-y border-[color:var(--line)] bg-[var(--surface-strong)] px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                Где мы находимся
              </p>
              <h2 className="mt-3 text-[1.65rem] leading-[1.05] font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[2.1rem]">
                Три филиала в Бишкеке.
              </h2>
            </div>
            <p className="max-w-[28rem] text-[13px] leading-6 text-[var(--muted)] sm:text-[14px]">
              Заходите за консультацией, образцами или забрать готовый заказ. Каждая точка открывается в 2GIS одним кликом.
            </p>
          </div>

          <div className="relative mt-7 overflow-hidden border border-[color:var(--line-strong)]/40 bg-white/70 sm:mt-9">
            <div className="aspect-[16/8] w-full sm:aspect-[16/6] lg:aspect-[16/5]">
              <iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=74.5500%2C42.8200%2C74.6800%2C42.9000&amp;layer=mapnik"
                title="Карта филиалов Artisan в Бишкеке"
                className="block h-full w-full grayscale-[15%]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 mix-blend-multiply [background-image:linear-gradient(180deg,rgba(245,239,225,0.18)_0%,rgba(245,239,225,0)_24%,rgba(245,239,225,0)_72%,rgba(21,20,17,0.06)_100%)]" />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-white/95 via-white/80 to-transparent p-4 sm:p-5">
              <div className="pointer-events-auto">
                <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                  Карта Бишкека
                </p>
                <p className="mt-1.5 text-[13px] leading-5 text-[var(--foreground)] sm:text-[14px]">
                  Все три точки — в шаговой доступности друг от друга, в районе Кулатова и Льва Толстого.
                </p>
              </div>
              <Link
                href="https://2gis.kg/bishkek/search/Artisan"
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto inline-flex h-10 items-center gap-2 border border-[var(--foreground)] bg-white px-4 font-mono text-[10px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:bg-[var(--foreground)] hover:text-white sm:h-11 sm:px-5 sm:text-[11px]"
              >
                Открыть в 2GIS
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:mt-6 lg:grid-cols-3">
            {companyBranches.map((branch, index) => (
              <article
                key={branch.slug}
                className="group relative flex h-full flex-col overflow-hidden border border-[color:var(--line)] bg-white/85 p-5 transition hover:border-[var(--foreground)] hover:bg-white sm:p-6"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-4 -right-2 select-none font-serif text-[7.5rem] leading-none font-light tracking-[-0.06em] text-[var(--foreground)]/[0.045] transition group-hover:text-[var(--foreground)]/[0.07] sm:-top-5 sm:-right-3 sm:text-[9rem]"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="relative flex items-start justify-between gap-3">
                  <span className="font-mono text-[10px] tracking-[0.22em] text-[var(--muted)] uppercase">
                    {`0${index + 1} / ${String(companyBranches.length).padStart(2, "0")}`}
                  </span>
                  <BranchStatus schedule={branch.schedule} />
                </div>

                <h3 className="relative mt-4 text-[1.3rem] leading-[1.1] font-semibold tracking-[-0.025em] text-[var(--foreground)] sm:text-[1.45rem]">
                  {branch.name}
                </h3>

                <div className="relative mt-5 space-y-3 text-[13px] leading-6 sm:text-[14px]">
                  <p className="flex items-start gap-3 text-[var(--foreground)]">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" />
                    <span>{branch.address}</span>
                  </p>
                  <p className="flex items-start gap-3 text-[var(--muted)]">
                    <Clock className="mt-0.5 size-4 shrink-0" />
                    <span>{branch.hours}</span>
                  </p>
                </div>

                {branch.services.length > 0 ? (
                  <div className="relative mt-5 flex flex-wrap gap-1.5">
                    {branch.services.map((service) => (
                      <span
                        key={service}
                        className="inline-flex items-center border border-[color:var(--line-strong)]/40 bg-[#f6f1e7]/70 px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-[var(--foreground)]/80 uppercase"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                ) : null}

                <Link
                  href={branch.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="relative mt-6 inline-flex items-center justify-between border-t border-[color:var(--line-strong)]/40 pt-4 font-mono text-[11px] tracking-[0.18em] text-[var(--foreground)] uppercase transition group-hover:text-[#9d573d]"
                >
                  <span>Открыть в 2GIS</span>
                  <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="border border-[color:var(--line)] bg-white/82 p-5 sm:p-6">
              <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                Темы обращения
              </p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
                Подскажите задачу — менеджер подберёт подходящий маршрут и материалы.
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
                    <p className="p-4 text-sm leading-6 text-[var(--foreground)]">
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

      <ContactsFaq />
    </div>
  );
}
