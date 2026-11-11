import type { Metadata } from "next";

import { FurnitureConstructor } from "@/features/constructor/furniture-constructor";
import { getConstructorDecors } from "@/lib/server/constructor-decors";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Конструктор мебели онлайн: шкаф, тумба, навесной шкаф в 3D",
  description:
    "Соберите шкаф, тумбу или навесной шкаф на сайте Artisan: размеры, полки, двери, декор ЛДСП из каталога, 3D-макет и детали с кромкой и присадкой сразу в распил в Бишкеке.",
  path: "/konstruktor",
});

export default async function ConstructorPage() {
  const decors = await getConstructorDecors();

  return (
    <div className="bg-[var(--surface)]">
      <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12 lg:px-10">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
          Конструктор мебели
        </p>
        <h1 className="mt-2 max-w-3xl text-3xl leading-tight font-semibold text-[var(--foreground)] sm:text-4xl">
          Соберите мебель и сразу отправьте в распил
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Выберите шкаф, тумбу или навесной шкаф, задайте размеры и декор из
          нашего каталога. Макет в 3D меняется сразу, а детали с кромкой и
          присадкой уходят в калькулятор распила одной кнопкой.
        </p>
        <div className="mt-6">
          <FurnitureConstructor decors={decors} />
        </div>
      </section>
    </div>
  );
}
