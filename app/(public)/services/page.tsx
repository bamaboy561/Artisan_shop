import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  Drill,
  Palette,
  Scissors,
  SquareStack,
  Truck,
} from "lucide-react";

import { ServiceRequestForm } from "@/components/services/service-request-form";
import { ButtonLink } from "@/components/ui/button-link";
import { formatPrice } from "@/lib/commerce";
import { getPublicCalculatorMaterials } from "@/lib/server/calculator-config";

export const metadata: Metadata = {
  title: "Услуги распила и кромления",
  description:
    "Распил ЛДСП и МДФ, кромка, сверление и подбор декора в Artisan. Калькулятор, расчёт и заявка в одной системе.",
};

const services = [
  {
    icon: Scissors,
    title: "Прямой распил",
    detail:
      "ЛДСП, МДФ, фанера и компакт-плита. Точность ±1 мм, рез по карте или по файлу.",
  },
  {
    icon: SquareStack,
    title: "Кромление",
    detail:
      "ABS-кромка 0.4 / 1 / 2 мм в цвет декора, аккуратная подача и торцы.",
  },
  {
    icon: Drill,
    title: "Сверление и фрезеровка",
    detail:
      "Присадка под петли и направляющие, отверстия под ручки, разметка по чертежу.",
  },
  {
    icon: Palette,
    title: "Подбор декора",
    detail:
      "Помогаем выбрать декор из каталога 1500+ позиций под цвет, стиль и бюджет проекта.",
  },
  {
    icon: Boxes,
    title: "Сборка комплектов",
    detail:
      "Пакетирование и маркировка под проект — снимает нагрузку с цеха клиента.",
  },
  {
    icon: Truck,
    title: "Доставка",
    detail:
      "Самовывоз с филиала, доставка по Бишкеку или отправка через ТК в регионы.",
  },
];

const workflowSteps = [
  {
    title: "Передайте файл",
    detail:
      "PDF, Excel или чертёж. Укажите материал, формат листа и количество.",
  },
  {
    title: "Согласуем расчёт",
    detail:
      "Менеджер сверяет параметры, считает раскрой и присылает короткое КП.",
  },
  {
    title: "Запускаем в цех",
    detail:
      "Распил, кромление, маркировка деталей и контроль геометрии перед отгрузкой.",
  },
  {
    title: "Получаете заказ",
    detail:
      "Самовывоз в удобный слот или доставка под адрес — со снятием по позициям.",
  },
];

const faqItems = [
  {
    question: "В каком формате прислать чертёж?",
    answer:
      "Удобнее всего PDF или Excel со списком деталей: длина × ширина × количество × материал + по сторонам, где нужна кромка. Если есть карта в CAD — пришлите DXF или PDF, мы переведём в производственный формат сами.",
  },
  {
    question: "Сколько хранится готовый заказ на складе?",
    answer:
      "После готовности — 7 дней бесплатного хранения. Дальше — по согласованию, чтобы не блокировать площадку. Менеджер заранее напоминает о дате отгрузки.",
  },
  {
    question: "Какой минимальный заказ по распилу?",
    answer:
      "Жёсткого минимума нет, но при заказе ниже 5 000 сом включается небольшая setup-fee на запуск партии. Конкретная сумма видна в КП ещё до подтверждения.",
  },
  {
    question: "Можно ли срочный распил «на сегодня»?",
    answer:
      "Зависит от загрузки цеха и объёма заказа. Отметьте срочность в заявке — менеджер сразу подтвердит, в какой слот возьмём, и предупредит, если сроки не реальны.",
  },
];

export default async function ServicesPage() {
  const materials = await getPublicCalculatorMaterials();
  const hasPricing = materials.length > 0;

  return (
    <div className="bg-[#f1eee8]">
      <section className="relative overflow-hidden border-b border-[color:var(--line)] bg-gradient-to-b from-[#f6f1e7] via-[#efeadf] to-[#f1eee8]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--foreground)]/12 to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle_at_1px_1px,#151411_1px,transparent_0)] [background-size:18px_18px]" />

        <div className="relative mx-auto flex max-w-[1500px] flex-col gap-7 px-4 pt-12 pb-10 sm:gap-10 sm:px-8 sm:pt-20 sm:pb-14 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:px-10 lg:pt-24 lg:pb-16">
          <div className="max-w-[44rem]">
            <p className="font-mono text-[10px] tracking-[0.28em] text-[var(--accent)] uppercase sm:text-[11px]">
              Услуги
            </p>
            <h1 className="mt-3 text-[2.1rem] leading-[0.96] font-semibold tracking-[-0.045em] text-balance text-[var(--foreground)] sm:mt-4 sm:text-[3.4rem] lg:text-[3.8rem]">
              Распил, кромка и&nbsp;комплектация заказа.
            </h1>
            <p className="mt-4 max-w-[36rem] text-[14px] leading-[1.7] text-[var(--muted)] sm:mt-5 sm:text-[15px]">
              Загрузите чертёж — соберём комплект под ваш проект. Калькулятор для предрасчёта, точный распил с допусками ±1 мм, кромление, сверление и доставка.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <ButtonLink
              href="/calculator"
              variant="contrast"
              className="bg-[var(--foreground)] text-white hover:bg-[#9d573d]"
            >
              Открыть калькулятор
            </ButtonLink>
            <ButtonLink
              href="#service-request"
              variant="secondary"
              className="border-[var(--foreground)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
            >
              Оставить заявку
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                Что делаем
              </p>
              <h2 className="mt-3 text-[1.65rem] leading-[1.05] font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[2.1rem]">
                Полный цикл — от распила до отгрузки.
              </h2>
            </div>
            <p className="max-w-[26rem] text-[13px] leading-6 text-[var(--muted)] sm:text-[14px]">
              Берём проект целиком: материалы, точность реза, кромление и пакетирование — без перекладывания на цех клиента.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:mt-9 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service, index) => (
              <article
                key={service.title}
                className="group relative flex h-full flex-col overflow-hidden border border-[color:var(--line)] bg-white/82 p-5 transition hover:border-[var(--foreground)] hover:bg-white sm:p-6"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-3 -right-2 select-none font-serif text-[6rem] leading-none font-light tracking-[-0.06em] text-[var(--foreground)]/[0.04] transition group-hover:text-[var(--foreground)]/[0.07] sm:text-[7rem]"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="relative inline-flex size-10 items-center justify-center border border-[color:var(--line-strong)]/45 bg-[#f6f1e7]/70 text-[var(--accent)]">
                  <service.icon className="size-5" strokeWidth={1.5} />
                </span>

                <h3 className="relative mt-4 text-[1.15rem] leading-[1.2] font-semibold tracking-[-0.025em] text-[var(--foreground)] sm:text-[1.25rem]">
                  {service.title}
                </h3>
                <p className="relative mt-2 text-[13px] leading-[1.6] text-[var(--muted)] sm:text-[14px]">
                  {service.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[color:var(--line)] bg-[var(--surface-strong)] px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
                Ориентир по цене
              </p>
              <h2 className="mt-3 text-[1.65rem] leading-[1.05] font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[2.1rem]">
                Базовые тарифы.
              </h2>
            </div>
            <p className="max-w-[28rem] text-[13px] leading-6 text-[var(--muted)] sm:text-[14px]">
              {hasPricing
                ? "Точная стоимость — после расчёта по вашему файлу. Это ориентир по материалу и операциям."
                : "Тарифы появятся после настройки калькулятора. Сейчас стоимость уточняется после расчёта по вашему файлу."}
            </p>
          </div>

          <div className="mt-7 overflow-hidden border border-[color:var(--line)] bg-white sm:mt-9">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f6f1e7]/70 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                <tr>
                  <th className="px-4 py-3 sm:px-5">Материал</th>
                  <th className="px-4 py-3 text-right sm:px-5">
                    Материал, м²
                  </th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell sm:px-5">
                    Рез, пог. м
                  </th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell sm:px-5">
                    Кромка, пог. м
                  </th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell sm:px-5">
                    Setup-fee
                  </th>
                </tr>
              </thead>
              <tbody>
                {hasPricing ? (
                  materials.map((material) => (
                    <tr
                      key={material.id}
                      className="border-t border-[color:var(--line)]"
                    >
                      <td className="px-4 py-4 align-top sm:px-5">
                        <p className="font-semibold text-[var(--foreground)]">
                          {material.label}
                        </p>
                        {material.thicknessMm ? (
                          <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-[var(--muted)] uppercase">
                            {material.thicknessMm} мм
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-right align-top text-[var(--foreground)] sm:px-5">
                        {formatPrice(material.pricePerSqM)}
                      </td>
                      <td className="hidden px-4 py-4 text-right align-top text-[var(--foreground)] sm:table-cell sm:px-5">
                        {formatPrice(material.cutRatePerMeter)}
                      </td>
                      <td className="hidden px-4 py-4 text-right align-top text-[var(--foreground)] sm:table-cell sm:px-5">
                        {material.edgeRatePerMeter > 0
                          ? formatPrice(material.edgeRatePerMeter)
                          : "—"}
                      </td>
                      <td className="hidden px-4 py-4 text-right align-top text-[var(--foreground)] sm:table-cell sm:px-5">
                        {material.setupFee > 0
                          ? formatPrice(material.setupFee)
                          : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-[color:var(--line)]">
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center sm:px-5 sm:py-14"
                    >
                      <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
                        Цены пока не настроены
                      </p>
                      <p className="mx-auto mt-3 max-w-[28rem] text-[14px] leading-[1.7] text-[var(--muted)]">
                        Стоимость по конкретному заказу пришлёт менеджер в ответном КП.
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-3">
                        <ButtonLink
                          href="/calculator"
                          variant="contrast"
                          className="bg-[var(--foreground)] text-white hover:bg-[#9d573d]"
                        >
                          Открыть калькулятор
                        </ButtonLink>
                        <ButtonLink
                          href="#service-request"
                          variant="secondary"
                          className="border-[var(--foreground)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
                        >
                          Запросить расчёт
                        </ButtonLink>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hasPricing ? (
            <p className="mt-5 max-w-[42rem] text-[12px] leading-5 text-[var(--muted)]">
              Цены указаны в KGS. Кромка ABS 1 мм входит в стоимость метра. Толщина 2 мм и услуги фрезеровки рассчитываются индивидуально.
            </p>
          ) : null}
        </div>
      </section>

      <section className="px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:gap-16">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Процесс
            </p>
            <h2 className="mt-3 text-[1.65rem] leading-[1.05] font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[2.1rem]">
              От файла до отгрузки за 4 шага.
            </h2>
            <p className="mt-4 max-w-[26rem] text-[13px] leading-[1.7] text-[var(--muted)] sm:text-[14px]">
              Никаких лишних созвонов: менеджер ведёт заявку от расчёта до выдачи и держит вас в курсе по WhatsApp.
            </p>
          </div>

          <div className="border-t border-[color:var(--line-strong)]/40">
            {workflowSteps.map((step, index) => (
              <div
                key={step.title}
                className="grid gap-4 border-b border-[color:var(--line-strong)]/40 py-5 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-6 sm:py-6"
              >
                <span className="font-mono text-[10px] tracking-[0.22em] text-[var(--muted)] uppercase">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-[16px] leading-[1.3] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[18px]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[var(--muted)] sm:text-[14px]">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[color:var(--line)] bg-[var(--surface-strong)] px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:gap-16">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Частые вопросы
            </p>
            <h2 className="mt-3 text-[1.65rem] leading-[1.05] font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[2.1rem]">
              Что чаще всего спрашивают перед заказом.
            </h2>
            <p className="mt-4 max-w-[26rem] text-[13px] leading-[1.7] text-[var(--muted)] sm:text-[14px]">
              Не нашли ответ — напишите в форме ниже или в WhatsApp. Отвечаем в рабочее время.
            </p>
            <Link
              href="/contacts"
              className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-[var(--foreground)] uppercase transition hover:text-[#9d573d]"
            >
              Все контакты
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="border-t border-[color:var(--line-strong)]/40">
            {faqItems.map((item, index) => (
              <details
                key={item.question}
                className="group border-b border-[color:var(--line-strong)]/40 [&[open]>summary>span:last-child]:rotate-45"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 transition hover:text-[#9d573d] sm:py-6">
                  <span className="flex items-start gap-4 sm:gap-6">
                    <span className="font-mono text-[10px] tracking-[0.22em] text-[var(--muted)] uppercase">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15px] leading-[1.4] font-medium text-[var(--foreground)] transition sm:text-[17px]">
                      {item.question}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 inline-flex size-5 shrink-0 items-center justify-center text-[18px] font-light text-[var(--muted)] transition-transform duration-300"
                  >
                    +
                  </span>
                </summary>
                <div className="pb-6 pl-8 sm:pl-14">
                  <p className="max-w-[34rem] text-[14px] leading-[1.7] text-[var(--muted)]">
                    {item.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section
        id="service-request"
        className="px-4 py-10 sm:px-8 sm:py-14 lg:px-10"
      >
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-7 max-w-[36rem]">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
              Оставить заявку
            </p>
            <h2 className="mt-3 text-[1.65rem] leading-[1.05] font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[2.1rem]">
              Передайте чертёж — менеджер вернётся с расчётом.
            </h2>
            <p className="mt-3 max-w-[32rem] text-[13px] leading-[1.7] text-[var(--muted)] sm:text-[14px]">
              Заполните форму: материал, формат, количество и комментарий. Файл прикладывать необязательно — расчёт можно начать и по списку деталей.
            </p>
          </div>

          <ServiceRequestForm />
        </div>
      </section>
    </div>
  );
}
