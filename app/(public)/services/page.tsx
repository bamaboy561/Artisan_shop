import type { Metadata } from "next";

import Image from "next/image";
import { ArrowDown, Drill, Ruler, Scissors } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import { getSiteCuttingPrices } from "@/lib/server/cutting-pricing";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Распил ЛДСП и МДФ в Бишкеке",
  description:
    "Распил ЛДСП и МДФ в Бишкеке: расчет по файлу, кромка 1 мм, карта раскроя, ведомость, онлайн-калькулятор и заявка на производство.",
  path: "/services",
});

const services = [
  {
    icon: Scissors,
    name: "Распил",
    detail:
      "Форматно-раскроечные HOMAG и ALTENDORF. Карту раскроя покажем до запуска.",
  },
  {
    icon: Ruler,
    name: "Кромление",
    detail: "Кромка 1 мм на PUR-клей: шов тоньше и не боится влаги.",
  },
  {
    icon: Drill,
    name: "Присадка",
    detail: "Отверстия под петли, конфирматы и полкодержатели по вашему файлу.",
  },
];

const workflowSteps = [
  {
    title: "Пришлите детали",
    description:
      "Список размеров, файл Базиса, Excel или фото листа с размерами.",
  },
  {
    title: "Менеджер подтвердит расчёт",
    description: "Проверим материал и раскрой, назовём точную сумму и срок.",
  },
  {
    title: "Заберите готовые детали",
    description: "На Кулатова 3/1. Оплата при получении, предоплата не нужна.",
  },
];

function formatPrice(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export default async function ServicesPage() {
  const prices = await getSiteCuttingPrices();
  const facts = [
    {
      value: formatPrice(prices.sheet),
      unit: "сом/лист",
      regular: prices.sheetRegular,
      label: "Распил через сайт",
    },
    {
      value: formatPrice(prices.edge),
      unit: "сом/м",
      regular: prices.edgeRegular,
      label: "Кромление",
    },
    { value: "0 сом", label: "Предоплата" },
    { value: "09:00–17:00", label: "Пн–Пт, Кулатова 3/1" },
  ];

  return (
    <div>
      <section className="bg-[radial-gradient(ellipse_70%_80%_at_72%_40%,#fbf8f2_0%,#f4eee4_50%,#efe8dc_100%)]">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-4 pt-10 pb-8 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-14 lg:px-10 lg:pt-20 lg:pb-14">
          <div>
            <h1 className="max-w-[17ch] text-[clamp(34px,4.4vw,62px)] leading-[1.02] font-medium tracking-[-0.03em] text-balance text-[#1b1c19]">
              Распил, кромление и присадка в своём цехе
            </h1>
            <p className="mt-5 max-w-[34rem] text-[17px] leading-[1.6] text-[#6e6b63]">
              Пришлите размеры деталей или файл из Базиса. Посчитаем раскрой,
              распилим, закромим и подготовим к сборке.
            </p>
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <ButtonLink
                href="/calculator"
                variant="contrast"
                className="min-h-[52px] w-full px-6 sm:w-auto"
              >
                Рассчитать распил
              </ButtonLink>
              <a
                href="#service-request"
                className="inline-flex items-center gap-1.5 self-start border-b border-[#1b1c1959] pb-0.5 text-sm font-semibold text-[#1b1c19] transition hover:border-[#1b1c19]"
              >
                Отправить файл менеджеру <ArrowDown className="size-3.5" />
              </a>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] lg:aspect-[5/4]">
            <Image
              src="/storefront/interior-2.webp"
              alt="Мебель из ЛДСП после распила и кромления"
              fill
              priority
              unoptimized
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
          </div>
        </div>
        <ul className="mx-auto grid max-w-[1500px] grid-cols-2 border-t border-[#e3ddd2] px-4 sm:px-8 md:grid-cols-4 lg:px-10">
          {facts.map((fact) => (
            <li key={fact.label} className="py-5 pr-5">
              <strong className="block text-[21px] leading-[1.1] font-semibold tracking-[-0.01em] whitespace-nowrap tabular-nums sm:text-[26px]">
                {fact.value}
                {fact.unit ? (
                  <small className="font-mono text-[13px] font-normal">
                    {" "}
                    {fact.unit}
                  </small>
                ) : null}
                {fact.regular ? (
                  <del className="ml-1.5 font-mono text-[13px] font-normal text-[#6e6b63]">
                    {fact.regular}
                  </del>
                ) : null}
              </strong>
              <span className="mt-1.5 block text-[13px] text-[#6e6b63]">
                {fact.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 py-12 sm:px-8 sm:py-16 lg:px-10">
        <h2 className="text-[26px] leading-tight font-medium tracking-[-0.02em] sm:text-[32px]">
          Что делаем с вашими деталями
        </h2>
        <div className="mt-7 grid gap-x-10 gap-y-8 md:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article
                key={service.name}
                className="border-t border-[#1b1c19] pt-5"
              >
                <Icon className="size-6 text-[#c4532b]" strokeWidth={1.6} />
                <h3 className="mt-4 text-lg font-semibold">{service.name}</h3>
                <p className="mt-2 max-w-[30ch] text-[15px] leading-6 text-[#6e6b63]">
                  {service.detail}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-[#1f2b25] text-white">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-10">
          <h2 className="text-[26px] leading-tight font-medium tracking-[-0.02em] text-balance sm:text-[38px]">
            От размеров до готовых деталей за три шага
          </h2>
          <ol className="grid gap-0">
            {workflowSteps.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 border-b border-white/15 py-5 first:pt-0 last:border-b-0"
              >
                <span className="text-[26px] leading-none font-semibold text-[#f0a48f] tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-6 text-white/70">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="service-request"
        className="scroll-mt-24 px-4 py-12 sm:px-8 sm:py-16 lg:px-10"
      >
        <div className="mx-auto max-w-[1100px]">
          <ServiceRequestForm />
        </div>
      </section>
    </div>
  );
}
