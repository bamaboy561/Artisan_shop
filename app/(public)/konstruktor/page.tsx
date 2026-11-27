import type { Metadata } from "next";

import { ConstructorTabs } from "@/features/constructor/constructor-tabs";
import {
  getConstructorDecors,
  getConstructorFittingProducts,
} from "@/lib/server/constructor-decors";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Конструктор мебели онлайн: кухня, шкаф и шкаф-купе в 3D",
  description:
    "Соберите кухню, шкаф или шкаф-купе на сайте Artisan: размеры, наполнение, декор ЛДСП из каталога, 3D-макет, примерная цена и детали с кромкой и присадкой сразу в распил в Бишкеке.",
  path: "/konstruktor",
});

export default async function ConstructorPage() {
  const [decors, fittingProducts] = await Promise.all([
    getConstructorDecors(),
    getConstructorFittingProducts(),
  ]);

  return (
    <div className="bg-[var(--surface)]">
      <section className="mx-auto max-w-[1440px] px-4 pt-5 pb-8 sm:px-8 sm:pt-8 lg:px-10">
        <ConstructorTabs
          decors={decors}
          fittingProducts={fittingProducts}
          title={
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[30px]">
              Конструктор мебели
            </h1>
          }
        />
      </section>
    </div>
  );
}
