type FaqItem = {
  question: string;
  answer: string;
};

const faqItems: FaqItem[] = [
  {
    question: "Можно ли приехать без записи?",
    answer:
      "Да, в часы работы любой точки. Если нужна точечная консультация по проекту — лучше предварительно написать или позвонить, чтобы менеджер подготовил образцы и спецификации.",
  },
  {
    question: "Как забрать готовый заказ?",
    answer:
      "Самовывоз доступен на главном филиале и в точке «Монолит». Менеджер пришлёт время готовности и адрес отгрузки в WhatsApp — приезжайте в удобный слот.",
  },
  {
    question: "Где посмотреть образцы декоров?",
    answer:
      "Полная палитра ЛДСП и МДФ хранится на «Стройпарке» и главном филиале. Можно сравнить декоры под дневным светом и забрать выкрасы для согласования с клиентом.",
  },
  {
    question: "Есть ли парковка рядом?",
    answer:
      "У всех трёх точек есть бесплатные парковочные места во дворе или на прилегающей улице. На «Стройпарке» удобнее заезжать со стороны Кулатова, на «Монолите» — со стороны Льва Толстого.",
  },
];

export function ContactsFaq() {
  return (
    <section className="border-t border-[color:var(--line)] px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
      <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:gap-16">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
            Частые вопросы
          </p>
          <h2 className="mt-3 text-[1.65rem] leading-[1.05] font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[2.1rem]">
            Что чаще всего спрашивают перед визитом.
          </h2>
          <p className="mt-4 max-w-[26rem] text-[13px] leading-[1.7] text-[var(--muted)] sm:text-[14px]">
            Если ответа нет ниже — напишите в WhatsApp или оставьте задачу через форму. Отвечаем в рабочее время.
          </p>
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
                    0{index + 1}
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
  );
}
