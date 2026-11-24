import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { PublicPromotion } from "@/lib/server/promotions-public";
import { buildCuttingSiteIncentive } from "@/features/cutting/site-prices";
import { getSiteCuttingPrices } from "@/lib/server/cutting-pricing";
import { companyContacts } from "@/lib/site-config";
import { CuttingMap } from "./cutting-map";
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
  const priceLine = offers
    .map((offer) => `${offer.label.toLowerCase()} ${offer.now} ${offer.unit}`)
    .join(", ");
  return (
    <>
      <section
        className={`${s.container} ${s.drawHero}`}
        aria-label="Artisan в Бишкеке"
      >
        <div className={s.drawText}>
          <h1>ЛДСП, фурнитура и распил в Бишкеке</h1>
          <p>
            Пришлите размеры деталей, мы разложим их на листе, распилим и
            поклеим кромку. Забираете готовое на {address}, оплата при
            получении.
          </p>
          {priceLine && <p className={s.drawPrices}>Сейчас {priceLine}</p>}
          <div className={s.drawActions}>
            <Link href="/calculator" className={s.primaryButton}>
              Рассчитать распил <ArrowRight size={19} />
            </Link>
            <Link href="/catalog" className={s.drawLink}>
              Каталог материалов
            </Link>
          </div>
        </div>
        <CuttingMap />
      </section>
      {promotion && (
        <Link href={promotion.href} className={`${s.container} ${s.drawPromo}`}>
          <strong>{promotionValue(promotion)}</strong> {promotion.name}
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
