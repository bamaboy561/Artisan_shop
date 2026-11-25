import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { PublicPromotion } from "@/lib/server/promotions-public";
import {
  buildCuttingSiteIncentive,
  formatSitePrice,
} from "@/features/cutting/site-prices";
import { getSiteCuttingPrices } from "@/lib/server/cutting-pricing";
import { companyContacts } from "@/lib/site-config";
import { CutHero, type CutHeroStep } from "./cut-hero";
import s from "./storefront.module.css";

// Пока у товаров нет поля «оттенок», образцы ведут на поиск по слову.
const swatches = [
  { label: "Белые", query: "белый", background: "#f4f2ed" },
  { label: "Бежевые", query: "бежевый", background: "#dccfb8" },
  {
    label: "Светлый дуб",
    query: "дуб",
    background:
      "repeating-linear-gradient(100deg, #cdb593 0 6px, #c2a780 6px 9px, #d5bf9e 9px 15px)",
  },
  {
    label: "Орех",
    query: "орех",
    background:
      "repeating-linear-gradient(100deg, #6e4a2f 0 5px, #5c3d26 5px 8px, #7a5536 8px 14px)",
  },
  { label: "Серые", query: "серый", background: "#8d8b85" },
  {
    label: "Камень",
    query: "мрамор",
    background:
      "radial-gradient(circle at 30% 30%, #f1f0ec 0 18%, transparent 19%), linear-gradient(135deg, #d9d7d1, #a9a7a1 45%, #e6e4df)",
  },
  { label: "Бетон", query: "бетон", background: "#a7a39b" },
  { label: "Зелёные", query: "зеленый", background: "#3f5a4a" },
  { label: "Синие", query: "синий", background: "#25385a" },
  { label: "Чёрные", query: "черный", background: "#26272a" },
];

function promotionValue(promotion: PublicPromotion) {
  if (promotion.badgeText) return promotion.badgeText;
  if (promotion.discountType === "PERCENT")
    return `−${promotion.discountValue}%`;
  if (promotion.discountType === "FIXED_PRICE")
    return `${promotion.discountValue} с`;
  return `−${promotion.discountValue} с`;
}

export async function StorefrontBento({
  promotion,
}: {
  promotion?: PublicPromotion;
}) {
  const prices = await getSiteCuttingPrices();
  const offers = buildCuttingSiteIncentive(prices)?.offers ?? [];
  const address = companyContacts.address.replace(/^г\. Бишкек, (ул\. )?/, "");
  const steps: CutHeroStep[] = [
    {
      label: "Распил",
      title: "Лист 2800 × 2070 режем по вашим размерам",
      text: `Режем на немецких станках HOMAG и Altendorf. Распил через сайт — ${formatSitePrice(prices.sheet)} сом за лист.`,
      from: 0.1,
      to: 0.3,
    },
    {
      label: "Кромка",
      title: "Кромка в цвет декора на PUR-клей",
      text: `Немецкий клей: шов тоньше, не боится воды и жара. Кромление — ${formatSitePrice(prices.edge)} сом за метр.`,
      from: 0.37,
      to: 0.55,
    },
    {
      label: "Сборка",
      title: "Детали приходят готовыми к сборке",
      text: "Каждая деталь подписана, а при заказе из Базиса на наклейке есть QR-код: видно, куда она идёт.",
      from: 0.61,
      to: 0.86,
    },
  ];
  return (
    <>
      <CutHero
        steps={steps}
        intro={
          <>
            <h1>ЛДСП, фурнитура и&nbsp;распил в&nbsp;Бишкеке</h1>
            <p>
              Подберите декор, пришлите размеры деталей и&nbsp;заберите готовый
              раскрой на {address}. Оплата при получении.
            </p>
            <div className={s.stageActions}>
              <Link href="/calculator" className={s.primaryButton}>
                Рассчитать распил <ArrowRight size={19} />
              </Link>
              <Link href="/catalog" className={s.stageLink}>
                Каталог материалов <ArrowUpRight size={17} />
              </Link>
            </div>
            <span className={s.cutHint}>Прокрутите: лист станет шкафом</span>
          </>
        }
        finale={
          <>
            <h2>Один лист. Один шкаф. Ваши размеры.</h2>
            <p>
              Соберите раскрой в калькуляторе или пришлите файл из Базиса, а мы
              распилим, закромим и подпишем детали.
            </p>
            <div className={s.stageActions}>
              <Link href="/calculator" className={s.primaryButton}>
                Рассчитать распил <ArrowRight size={19} />
              </Link>
            </div>
          </>
        }
      />
      <ul className={`${s.container} ${s.cutFacts}`}>
        {offers.map((offer) => (
          <li key={offer.label}>
            <strong>
              {offer.now} <small>{offer.unit}</small>
            </strong>
            <span>
              {offer.label} <del>{offer.was}</del>
            </span>
          </li>
        ))}
        <li>
          <strong>0 сом</strong>
          <span>предоплаты на сайте</span>
        </li>
        <li>
          <strong>{companyContacts.hours.replace(/^Пн-Пт /, "")}</strong>
          <span>Пн–Пт, {address}</span>
        </li>
      </ul>
      {promotion && (
        <Link
          href={promotion.href}
          className={`${s.container} ${s.promoStrip}`}
        >
          <strong>{promotionValue(promotion)}</strong>
          <span>
            {promotion.name}
            {promotion.endsAt &&
              ` · до ${promotion.endsAt.toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
              })}`}
          </span>
          <ArrowUpRight size={18} />
        </Link>
      )}
      <section
        className={`${s.container} ${s.fanSection}`}
        aria-labelledby="fan-title"
      >
        <h2 id="fan-title">Декоры по цвету</h2>
        <div className={s.fan}>
          {swatches.map((swatch) => (
            <Link
              key={swatch.query}
              href={`/catalog?q=${encodeURIComponent(swatch.query)}`}
              style={{ background: swatch.background }}
            >
              <span>{swatch.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
