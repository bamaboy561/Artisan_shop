import type { Metadata } from "next";

import { CalculatorHero } from "@/features/services/calculator-hero";
import { CutCalculator } from "@/features/services/cut-calculator";
import { getCalculatorBundle } from "@/lib/server/calculator-config";
import { getSiteCuttingPrices } from "@/lib/server/cutting-pricing";
import { getCalculatorContextBySlug } from "@/lib/server/catalog-public";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Онлайн-калькулятор распила ЛДСП и МДФ в Бишкеке",
  description:
    "Онлайн-калькулятор распила ЛДСП и МДФ Artisan: раскрой листа, кромка 1 мм, карта деталей, расчет в сомах и заявка на производство в Бишкеке.",
  path: "/calculator",
});

type CalculatorPageProps = {
  searchParams: Promise<{ product?: string | string[] | undefined }>;
};

function getSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CalculatorPage({
  searchParams,
}: CalculatorPageProps) {
  const resolvedSearchParams = await searchParams;
  const productSlug = getSearchParamValue(resolvedSearchParams.product);
  const [productContext, bundle, sitePrices] = await Promise.all([
    productSlug
      ? getCalculatorContextBySlug(productSlug)
      : Promise.resolve(null),
    getCalculatorBundle(),
    getSiteCuttingPrices(),
  ]);

  return (
    <div className="bg-[#f4f1eb]">
      <CalculatorHero prices={sitePrices} />
      <section className="px-4 pb-5 sm:px-8 sm:pb-10 lg:px-10 lg:pb-12">
        <div className="mx-auto max-w-[1600px]">
          <CutCalculator
            key={productContext?.slug ?? "manual"}
            productContext={productContext}
            materials={bundle.materials}
            sheets={bundle.sheets}
            presets={bundle.presets}
          />
        </div>
      </section>
    </div>
  );
}
