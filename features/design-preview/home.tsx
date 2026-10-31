"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Drill,
  Ruler,
  Scissors,
} from "lucide-react";
import { useState } from "react";
import { brands, catalogHref, categories, liveRoot, products } from "./data";
import { PreviewCard } from "./shell";
import s from "./preview.module.css";

const interiors = [
  {
    image: "/design-preview/interior-1.webp",
    label: "Поверхности Slotex",
    brand: "slotex",
  },
  {
    image: "/design-preview/interior-0.webp",
    label: "Материалы Extravert",
    brand: "extravert",
  },
  {
    image: "/design-preview/interior-2.webp",
    label: "Декоры Extravert",
    brand: "extravert",
  },
];

export function PreviewHome() {
  const [slide, setSlide] = useState(0);
  const active = interiors[slide];
  return (
    <>
      <section className={s.hero} aria-label="Материалы Artisan">
        <Image
          key={active.image}
          src={active.image}
          alt={active.label + " в интерьере кухни и мебели"}
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
            <Link href={catalogHref()} className={s.lightButton}>
              Открыть каталог <ArrowUpRight size={22} />
            </Link>
          </div>
          <div className={s.heroPager}>
            <Link href={catalogHref({ brand: active.brand })}>
              {active.label}
              <ArrowUpRight size={16} />
            </Link>
            <div>
              <span>
                0{slide + 1}
                <small> / 03</small>
              </span>
              <button
                aria-label="Предыдущий интерьер"
                title="Предыдущий интерьер"
                onClick={() =>
                  setSlide((slide + interiors.length - 1) % interiors.length)
                }
              >
                <ChevronLeft size={21} />
              </button>
              <button
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

      <section className={`${s.section} ${s.container}`}>
        <div className={s.sectionHeading}>
          <div>
            <p className={s.eyebrow}>Всё начинается с материала</p>
            <h2>Основа красивой мебели</h2>
          </div>
          <Link href={catalogHref()} className={s.textLink}>
            Весь каталог <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className={s.categoryGrid}>
          {categories.slice(0, 4).map((category, index) => (
            <Link
              key={category.slug}
              href={catalogHref({ category: category.slug })}
              className={s.categoryTile}
            >
              <div>
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  sizes="(max-width: 600px) 50vw, 25vw"
                  unoptimized
                  className={index === 2 ? s.contain : s.cover}
                />
                <span>0{index + 1}</span>
              </div>
              <h3>
                {category.name}
                <ArrowUpRight size={20} />
              </h3>
              <p>{category.subtitle}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className={s.collectionBand}>
        <div className={`${s.container} ${s.section}`}>
          <div className={s.sectionHeading}>
            <div>
              <p className={s.eyebrow}>Палитра вашего проекта</p>
              <h2>Цвет. Фактура. Характер.</h2>
            </div>
            <Link
              href={catalogHref({ category: "mdf" })}
              className={s.textLink}
            >
              Все МДФ панели <ArrowUpRight size={19} />
            </Link>
          </div>
          <div className={s.homeProducts}>
            {products.slice(0, 4).map((product) => (
              <PreviewCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section id="brands" className={`${s.container} ${s.section}`}>
        <div className={s.sectionHeading}>
          <div>
            <p className={s.eyebrow}>Партнёры Artisan</p>
            <h2>Имена, за которыми качество</h2>
          </div>
          <span className={s.muted}>Материалы и фурнитура</span>
        </div>
        <div className={s.brandGrid}>
          {brands.map((brand) => (
            <Link
              href={catalogHref({ brand: brand.slug })}
              key={brand.slug}
              title={`Товары ${brand.name}`}
            >
              {brand.slug === "albero" ? (
                <Image
                  src="/design-preview/albero.webp"
                  alt="Albero"
                  width={150}
                  height={42}
                  unoptimized
                />
              ) : (
                <span>{brand.name}</span>
              )}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      </section>

      <section id="services" className={s.serviceBand}>
        <div className={`${s.container} ${s.serviceGrid}`}>
          <div className={s.serviceVisual}>
            <Image
              src="/design-preview/interior-2.webp"
              alt="Мебель из декоров Extravert"
              fill
              unoptimized
              sizes="(max-width: 700px) 100vw, 50vw"
              className={s.cover}
            />
          </div>
          <div className={s.serviceText}>
            <p className={s.eyebrow}>От замысла к готовой детали</p>
            <h2>
              Ваш материал.
              <br />
              Наша точность.
            </h2>
            <p>Распил, кромление и присадка для вашего проекта.</p>
            <div className={s.serviceSteps}>
              <span>
                <Scissors size={22} />
                Распил
              </span>
              <span>
                <Ruler size={22} />
                Кромление
              </span>
              <span>
                <Drill size={22} />
                Присадка
              </span>
            </div>
            <a
              href={`${liveRoot}/calculator`}
              target="_blank"
              rel="noreferrer"
              className={s.lightButton}
            >
              Рассчитать распил <ArrowUpRight size={21} />
            </a>
          </div>
        </div>
      </section>

      <section className={`${s.container} ${s.contactBand}`}>
        <div>
          <p className={s.eyebrow}>Вместе найдём нужное</p>
          <h2>Обсудим ваш проект?</h2>
        </div>
        <a
          href="https://wa.me/996502788118"
          target="_blank"
          rel="noreferrer"
          className={s.primaryButton}
        >
          Связаться с нами <ArrowRight size={21} />
        </a>
        <ArrowDownRight size={48} strokeWidth={1} className={s.contactArrow} />
      </section>
    </>
  );
}
