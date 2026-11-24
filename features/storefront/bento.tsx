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
  const address = companyContacts.address.replace(/^г\. Бишкек, (ул\. )?/, "");
  return (
    <>
      <section
        className={`${s.container} ${s.stage}`}
        aria-label="Artisan в Бишкеке"
      >
        <div className={s.stageMedia}>
          <Image
            src="/storefront/interior-1.webp"
            alt="Кухня из декоров Extravert"
            fill
            unoptimized
            priority
            sizes="100vw"
            className={s.cover}
          />
        </div>
        <div className={s.stageBody}>
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
        </div>
        <ul className={s.stageFacts}>
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
      </section>
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
        className={`${s.container} ${s.swatchBand} ${s.reveal}`}
        aria-labelledby="swatch-title"
      >
        <h2 id="swatch-title">Подберите декор по цвету</h2>
        <div className={s.swatches}>
          {swatches.map((swatch) => (
            <Link
              key={swatch.query}
              href={`/catalog?q=${encodeURIComponent(swatch.query)}`}
            >
              <i style={{ background: swatch.background }} />
              {swatch.label}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
