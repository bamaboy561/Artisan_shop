import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { PublicPromotion } from "@/lib/server/promotions-public";
import { buildCuttingSiteIncentive } from "@/features/cutting/site-prices";
import { getSiteCuttingPrices } from "@/lib/server/cutting-pricing";
import { companyContacts } from "@/lib/site-config";
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
  const offers =
    buildCuttingSiteIncentive(await getSiteCuttingPrices())?.offers ?? [];
  const sheet = offers[0];
  const street = companyContacts.address.replace(/^г\. Бишкек, /, "");
  return (
    <>
      <section className={s.tsHero} aria-label="Artisan в Бишкеке">
        <div className={s.tsHeroText}>
          <h1>Материалы для мебели и распил ЛДСП в Бишкеке</h1>
          <p>
            ЛДСП, МДФ, столешницы и фурнитура со склада. Распилим по вашим
            размерам и поклеим кромку, оплата при получении.
          </p>
          {sheet && (
            <p className={s.tsFact}>
              <strong>
                {sheet.now} {sheet.unit}
              </strong>{" "}
              распил листа, было {sheet.was}
            </p>
          )}
          <div className={s.tsActions}>
            <Link href="/calculator" className={s.tsButton}>
              Рассчитать распил <ArrowRight size={18} />
            </Link>
            <Link href="/catalog" className={s.tsGhost}>
              Смотреть каталог
            </Link>
          </div>
        </div>
        <div className={s.tsHeroPhoto}>
          <Image
            src="/storefront/interior-1.webp"
            alt="Кухня из декоров Extravert"
            fill
            unoptimized
            priority
            sizes="55vw"
            className={s.cover}
          />
        </div>
      </section>
      {promotion && (
        <Link href={promotion.href} className={s.tsPromo}>
          <span className={s.tsWrap}>
            <strong>{promotionValue(promotion)}</strong> {promotion.name}
            <ArrowUpRight size={18} />
          </span>
        </Link>
      )}
      <section className={s.tsVisit} aria-labelledby="visit-title">
        <div className={s.tsWrap}>
          <h2 id="visit-title">Приезжайте на склад</h2>
          <p className={s.tsStreet}>{street}</p>
          <dl className={s.tsVisitFacts}>
            <div>
              <dt>Часы</dt>
              <dd>{companyContacts.hours.replace("-", "–")}</dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd>
                <a href={`tel:${companyContacts.phoneTel}`}>
                  {companyContacts.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt>Оплата</dt>
              <dd>При получении, без предоплаты на сайте</dd>
            </div>
          </dl>
          <div className={s.tsDecor}>
            <h3>Декоры по цвету</h3>
            <div>
              {swatches.map((swatch) => (
                <Link
                  key={swatch.query}
                  href={`/catalog?q=${encodeURIComponent(swatch.query)}`}
                  title={swatch.label}
                >
                  <i style={{ background: swatch.background }} />
                  {swatch.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
