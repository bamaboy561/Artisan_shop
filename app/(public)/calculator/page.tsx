import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button-link";
import { CutCalculator } from "@/features/services/cut-calculator";
import { getCalculatorBundle } from "@/lib/server/calculator-config";
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
  const [productContext, bundle] = await Promise.all([
    productSlug
      ? getCalculatorContextBySlug(productSlug)
      : Promise.resolve(null),
    getCalculatorBundle(),
  ]);

  return (
    <div className="bg-[#f6f2eb]">
      <section className="px-4 pt-3 pb-5 sm:px-8 sm:pt-7 sm:pb-10 lg:px-10 lg:pt-8 lg:pb-12">
        <div className="mx-auto max-w-[1600px] border-t border-[#151411]/10 pt-3 sm:pt-5">
          <div className="flex items-end justify-between gap-4">
            <div className="max-w-[34rem]">
              <p className="font-mono text-[9px] tracking-[0.18em] text-[var(--accent)] uppercase">
                Калькулятор распила
              </p>
              <h1 className="mt-1.5 text-[1.05rem] leading-[1.04] font-semibold tracking-[-0.045em] text-[#151411] sm:mt-3 sm:max-w-[14ch] sm:text-[2.2rem]">
                Раскрой листа и карта деталей.
              </h1>
            </div>

            <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:gap-3">
              <ButtonLink
                href="#cut-request-form"
                variant="primary"
                className="justify-center sm:w-auto"
              >
                Отправить заявку
              </ButtonLink>
              <ButtonLink
                href="/catalog"
                variant="secondary"
                className="justify-center sm:w-auto"
              >
                Перейти в каталог
              </ButtonLink>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-[1600px] sm:mt-7">
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
