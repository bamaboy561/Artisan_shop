"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import s from "./storefront.module.css";

const interiors = [
  {
    image: "/storefront/interior-1.webp",
    label: "Поверхности Slotex",
    brand: "slotex",
  },
  {
    image: "/storefront/interior-0.webp",
    label: "Материалы Extravert",
    brand: "extravert",
  },
  {
    image: "/storefront/interior-2.webp",
    label: "Декоры Extravert",
    brand: "extravert",
  },
];

export function StorefrontHero() {
  const [slide, setSlide] = useState(0);
  const active = interiors[slide];
  return (
    <section className={s.hero} aria-label="Материалы Artisan">
      <Image
        key={active.image}
        src={active.image}
        alt={active.label + " в интерьере"}
        fill
        unoptimized
        priority
        sizes="100vw"
        className={s.heroImage}
      />
      <div className={s.heroShade} />
      <div className={`${s.container} ${s.heroContent}`}>
        <div>
          <p className={s.heroEyebrow}>Для тех, кто создаёт пространство</p>
          <h1>ARTISAN</h1>
          <p className={s.heroSubtitle}>
            Материалы для мебели.
            <br />
            Возможности для ваших идей.
          </p>
          <Link href="/catalog" className={s.lightButton}>
            Открыть каталог <ArrowUpRight size={22} />
          </Link>
        </div>
        <div className={s.heroPager}>
          <Link href={`/catalog?brand=${active.brand}`}>
            {active.label}
            <ArrowUpRight size={16} />
          </Link>
          <div>
            <span>
              0{slide + 1}
              <small> / 03</small>
            </span>
            <button
              type="button"
              aria-label="Предыдущий интерьер"
              title="Предыдущий интерьер"
              onClick={() =>
                setSlide((slide + interiors.length - 1) % interiors.length)
              }
            >
              <ChevronLeft size={21} />
            </button>
            <button
              type="button"
              aria-label="Следующий интерьер"
              title="Следующий интерьер"
              onClick={() => setSlide((slide + 1) % interiors.length)}
            >
              <ChevronRight size={21} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
