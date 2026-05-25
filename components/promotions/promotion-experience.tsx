"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { PublicPromotion } from "@/lib/server/promotions-public";

type PromotionExperienceProps = {
  promotions: PublicPromotion[];
};

function formatPromoOffer(promotion: PublicPromotion) {
  if (promotion.discountType === "FIXED_AMOUNT") {
    return `-${new Intl.NumberFormat("ru-RU").format(
      promotion.discountValue,
    )} сом`;
  }

  if (promotion.discountType === "FIXED_PRICE") {
    return `${new Intl.NumberFormat("ru-RU").format(
      promotion.discountValue,
    )} сом`;
  }

  return `-${promotion.discountValue}%`;
}

function formatEndsAt(date: Date | string | null) {
  if (!date) {
    return "без срока";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
  }).format(new Date(date));
}

function formatMinOrderTotal(value: number | null) {
  if (!value) {
    return "без порога";
  }

  return `от ${new Intl.NumberFormat("ru-RU").format(value)} сом`;
}

export function PromotionExperience({ promotions }: PromotionExperienceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const primaryPromotion = promotions[0];
  const popupStorageKey = useMemo(
    () => (primaryPromotion ? `artisan-promo-${primaryPromotion.id}` : ""),
    [primaryPromotion],
  );

  useEffect(() => {
    if (!primaryPromotion || !popupStorageKey) {
      return;
    }

    if (window.localStorage.getItem(popupStorageKey) === "closed") {
      return;
    }

    const timer = window.setTimeout(() => setIsOpen(true), 5200);

    return () => window.clearTimeout(timer);
  }, [primaryPromotion, popupStorageKey]);

  if (!primaryPromotion) {
    return null;
  }

  function closePopup() {
    if (popupStorageKey) {
      window.localStorage.setItem(popupStorageKey, "closed");
    }
    setIsOpen(false);
  }

  return (
    <>
      <section className="promo-alert relative z-30 overflow-hidden border-b border-black/15 bg-[#f22222] text-white">
        <div className="promo-alert__shine" aria-hidden />
        <div className="mx-auto grid max-w-[1500px] gap-2 px-4 py-3 text-center sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-8 sm:text-left lg:px-10">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#ffe500] px-3 py-1 text-[#17110d] shadow-[0_8px_24px_rgba(0,0,0,0.18)] sm:mx-0">
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] font-black tracking-[0.18em] uppercase">
              {primaryPromotion.badgeText ?? "Акция"}
            </span>
          </div>

          <p className="min-w-0 text-sm leading-5 font-semibold sm:text-base">
            <span className="mr-2 inline-flex rounded bg-black px-2 py-0.5 font-mono text-[11px] tracking-[0.12em] text-[#ffe500] uppercase">
              {formatPromoOffer(primaryPromotion)}
            </span>
            <span>{primaryPromotion.name}</span>
            {primaryPromotion.promoCode ? (
              <span className="ml-2 rounded-full bg-white/18 px-2 py-0.5 text-xs text-white">
                Промокод: {primaryPromotion.promoCode}
              </span>
            ) : null}
          </p>

          <Link
            href={primaryPromotion.href}
            className="group inline-flex h-9 items-center justify-center gap-2 bg-white px-4 font-mono text-[10px] font-black tracking-[0.16em] text-[#17110d] uppercase shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition hover:bg-[#ffe500]"
          >
            {primaryPromotion.hrefLabel}
            <ArrowRight
              aria-hidden
              className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </section>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-end bg-black/55 px-3 py-4 backdrop-blur-[3px] sm:place-items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Акция Artisan"
        >
          <div className="animate-modal-in w-full max-w-[620px] overflow-hidden bg-white shadow-[0_34px_110px_rgba(0,0,0,0.38)]">
            <div className="relative grid min-h-[16rem] content-between overflow-hidden bg-[#f22222] p-6 text-white sm:p-8">
              <div className="promo-alert__shine" aria-hidden />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="inline-flex rounded-full bg-[#ffe500] px-3 py-1 font-mono text-[10px] font-black tracking-[0.2em] text-[#17110d] uppercase">
                    {primaryPromotion.badgeText ?? "Специальное предложение"}
                  </p>
                  <h2 className="mt-5 text-6xl leading-none font-black text-white sm:text-7xl">
                    {formatPromoOffer(primaryPromotion)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closePopup}
                  className="grid size-10 place-items-center bg-black/20 text-white transition hover:bg-white hover:text-[#17110d]"
                  aria-label="Закрыть акцию"
                >
                  <X aria-hidden className="h-5 w-5" />
                </button>
              </div>

              <div className="relative">
                <h3 className="max-w-lg text-2xl leading-tight font-black sm:text-4xl">
                  {primaryPromotion.name}
                </h3>
                {primaryPromotion.description ? (
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/88 sm:text-base">
                    {primaryPromotion.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:p-6">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="border border-[#17110d]/12 bg-[#fff8d8] p-4">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-[#91780a] uppercase">
                    Срок
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#15110d]">
                    до {formatEndsAt(primaryPromotion.endsAt)}
                  </p>
                </div>
                <div className="border border-[#17110d]/12 bg-[#fff8d8] p-4">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-[#91780a] uppercase">
                    Условие
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#15110d]">
                    {formatMinOrderTotal(primaryPromotion.minOrderTotal)}
                  </p>
                </div>
              </div>

              {primaryPromotion.promoCode ? (
                <div className="flex items-center justify-between gap-3 border-2 border-dashed border-[#f22222] bg-white px-4 py-3">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-[#8a8175] uppercase">
                    Промокод
                  </span>
                  <span className="font-mono text-sm font-semibold tracking-[0.18em] text-[#15110d]">
                    {primaryPromotion.promoCode}
                  </span>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Link
                  href={primaryPromotion.href}
                  onClick={closePopup}
                  className="inline-flex h-12 items-center justify-center gap-2 bg-[#17110d] px-5 font-mono text-[11px] font-black tracking-[0.14em] text-white uppercase transition hover:bg-[#f22222]"
                >
                  {primaryPromotion.hrefLabel}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={closePopup}
                  className="inline-flex h-12 items-center justify-center border border-[#15110d]/16 px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[#15110d] uppercase transition hover:border-[#15110d] hover:bg-[#fff8d8]"
                >
                  Позже
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
