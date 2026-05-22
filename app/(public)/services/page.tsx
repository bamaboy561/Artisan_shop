import type { Metadata } from "next";

import { ProductImage } from "@/components/catalog/product-image";
import { ButtonLink } from "@/components/ui/button-link";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import {
  getPublicProductsByBrand,
  getPublicProductsByCategory,
} from "@/lib/server/catalog-public";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Распил ЛДСП и МДФ в Бишкеке",
  description:
    "Распил ЛДСП и МДФ в Бишкеке: расчет по файлу, кромка 1 мм, карта раскроя, ведомость, онлайн-калькулятор и заявка на производство.",
  path: "/services",
});

const serviceHighlights = [
  {
    name: "Распил по файлу",
    detail: "PDF, Excel и чертежи.",
  },
  {
    name: "Кромление",
    detail: "Кромка 1 мм и подготовка заказа.",
  },
  {
    name: "Предрасчет",
    detail: "Онлайн-калькулятор перед заявкой.",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Передайте файл",
    description: "Материал, формат и комментарии к заказу.",
  },
  {
    step: "02",
    title: "Уточним расчет",
    description: "Проверим параметры и подтвердим стоимость.",
  },
  {
    step: "03",
    title: "Запустим в работу",
    description: "После подтверждения передаем заказ в производство.",
  },
];

export default async function ServicesPage() {
  const [extravertProducts, mdfProducts] = await Promise.all([
    getPublicProductsByBrand("extravert"),
    getPublicProductsByCategory("mdf-panels"),
  ]);
  const heroImage = extravertProducts[3]?.image || mdfProducts[0]?.image || "";

  return (
    <div className="bg-[#f1eee8]">
      <section className="relative overflow-hidden bg-[#151411] text-white">
        <ProductImage
          src={heroImage}
          alt="Услуги распила Artisan"
          fill
          priority
          fallbackLabel="Услуги Artisan"
          className="object-cover opacity-30"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.46)_52%,rgba(0,0,0,0.82)_100%)]" />
        <div className="relative mx-auto flex min-h-[34svh] max-w-[1500px] flex-col justify-end px-4 pt-16 pb-6 sm:min-h-[42svh] sm:px-8 sm:pt-20 sm:pb-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-[36rem]">
              <p className="font-mono text-[10px] tracking-[0.22em] text-white/58 uppercase">
                Услуги
              </p>
              <h1 className="mt-3 text-[1.9rem] leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-[3rem]">
                Распил, кромление и подготовка заказа.
              </h1>
              <p className="mt-3 max-w-[32rem] text-sm leading-5 text-white/72 sm:mt-4 sm:leading-6">
                Передайте файл и параметры. Остальное уточним с менеджером.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:justify-end">
              <ButtonLink
                href="/calculator"
                variant="secondary"
                className="w-full border-white/42 text-white hover:bg-white hover:text-black sm:w-auto"
              >
                Калькулятор
              </ButtonLink>
              <ButtonLink
                href="#service-request"
                variant="contrast"
                className="w-full sm:w-auto"
              >
                Оставить заявку
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-4 md:grid-cols-3 md:gap-5">
          {serviceHighlights.map((service, index) => (
            <article
              key={service.name}
              className="view-rise border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 sm:p-5"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
                0{index + 1}
              </p>
              <h2 className="mt-3 text-base font-semibold text-[var(--foreground)] sm:text-lg">
                {service.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {service.detail}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[color:var(--line)] bg-[var(--surface-strong)] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-8">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Процесс
            </p>
            <h2 className="mt-3 text-[1.55rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[1.9rem]">
              От файла до запуска.
            </h2>
          </div>

          <div className="grid gap-0 border border-[color:var(--line)]">
            {workflowSteps.map((step) => (
              <div
                key={step.step}
                className="grid gap-3 border-b border-[color:var(--line)] bg-[#f1eee8] p-4 last:border-b-0 sm:grid-cols-[76px_minmax(0,1fr)] sm:gap-4 sm:p-5"
              >
                <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                  {step.step}
                </p>
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:leading-7">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="service-request"
        className="px-4 py-6 sm:px-8 sm:py-10 lg:px-10"
      >
        <div className="mx-auto max-w-[1500px]">
          <ServiceRequestForm />
        </div>
      </section>
    </div>
  );
}
