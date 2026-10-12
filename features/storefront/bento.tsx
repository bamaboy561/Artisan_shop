import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { PublicPromotion } from "@/lib/server/promotions-public";
import { companyContacts, cuttingSiteIncentive } from "@/lib/site-config";
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

export function StorefrontBento({
  promotion,
}: {
  promotion?: PublicPromotion;
}) {
  const offers = cuttingSiteIncentive?.offers ?? [];
  return (
    <section
      className={`${s.container} ${s.bento}`}
      aria-label="Artisan в Бишкеке"
    >
      <div className={`${s.tile} ${s.heroTile}`}>
        <div className={s.tileBody}>
          <p className={s.tileTag}>
            <i />
            {companyContacts.hours} ·{" "}
            {companyContacts.address.replace(/^г\. Бишкек, (ул\. )?/, "")}
          </p>
          <h1>ЛДСП, МДФ, фурнитура и распил в Бишкеке</h1>
          <p>
            Соберите материалы, отправьте детали на распил и заберите готовое.
            Без предоплаты на сайте.
          </p>
          <div className={s.heroActions}>
            <Link href="/calculator" className={s.primaryButton}>
              Рассчитать распил <ArrowRight size={19} />
            </Link>
            <Link href="/catalog" className={s.ghostButton}>
              Открыть каталог
            </Link>
          </div>
          {offers.length > 0 && (
            <div className={s.offerPills}>
              {offers.map((offer) => (
                <Link key={offer.label} href="/calculator">
                  <del>{offer.was}</del>
                  <strong>{offer.now}</strong>
                  <span>
                    {offer.label}, {offer.unit}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Link
        href="/catalog?brand=extravert"
        className={`${s.tile} ${s.imageTile}`}
      >
        <Image
          src="/storefront/interior-1.webp"
          alt="Кухня из декоров Extravert"
          fill
          unoptimized
          priority
          sizes="(max-width: 1150px) 50vw, 30vw"
          className={s.tileImage}
        />
        <span className={s.tileShade} />
        <span className={s.tileBody}>
          <span className={s.tileTag}>
            <i />
            Декоры в интерьере
          </span>
          <h2>ЛДСП Extravert</h2>
          <p>
            Смотреть декоры <ArrowUpRight size={15} />
          </p>
        </span>
      </Link>
      {promotion ? (
        <Link href={promotion.href} className={`${s.tile} ${s.promoTile}`}>
          <span className={s.tileTag}>
            <i />
            {promotion.endsAt
              ? `Акция до ${promotion.endsAt.toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                })}`
              : "Акция"}
          </span>
          <span className={s.promoValue}>{promotionValue(promotion)}</span>
          <strong>{promotion.name}</strong>
          <span>{promotion.hrefLabel} →</span>
        </Link>
      ) : (
        <Link href="/account" className={`${s.tile} ${s.promoTile}`}>
          <span className={s.tileTag}>
            <i />
            Программа лояльности
          </span>
          <span className={s.promoValue}>Баллы</span>
          <strong>за каждую покупку, ими можно оплатить часть заказа</strong>
          <span>Узнать условия →</span>
        </Link>
      )}
      <div className={`${s.tile} ${s.colorTile}`}>
        <div>
          <p className={s.eyebrow}>Подбор декора</p>
          <h2>Выберите по цвету</h2>
          <p>ЛДСП и МДФ нужного оттенка в одно касание</p>
        </div>
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
      </div>
    </section>
  );
}
