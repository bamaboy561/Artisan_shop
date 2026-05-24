"use client";

import Link from "next/link";
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
    return "Без срока";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
  }).format(new Date(date));
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
      <section className="relative z-30 border-b border-white/10 bg-[#15110d] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-2 px-4 py-2.5 text-center sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p className="text-[12px] leading-5 sm:text-left">
            <span className="mr-2 rounded-full bg-[#d36a45] px-2.5 py-1 font-mono text-[9px] tracking-[0.16em] uppercase">
              {primaryPromotion.badgeText ?? "Акция"}
            </span>
            <span className="font-semibold">{primaryPromotion.name}</span>
            {primaryPromotion.promoCode ? (
              <span className="ml-2 text-white/70">
                Промокод: {primaryPromotion.promoCode}
              </span>
            ) : null}
          </p>
          <Link
            href="/catalog"
            className="font-mono text-[10px] font-semibold tracking-[0.16em] text-white/78 uppercase transition hover:text-white"
          >
            Смотреть предложения
          </Link>
        </div>
      </section>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-end bg-black/42 px-3 py-4 backdrop-blur-[2px] sm:place-items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Акция Artisan"
        >
          <div className="animate-modal-in w-full max-w-[520px] overflow-hidden rounded-[28px] bg-[#f6f0e6] shadow-[0_34px_110px_rgba(0,0,0,0.34)]">
            <div className="grid min-h-[15rem] content-between bg-[#15110d] p-6 text-white sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.24em] text-white/52 uppercase">
                    Специальное предложение
                  </p>
                  <h2 className="mt-3 text-3xl leading-none font-semibold tracking-[-0.06em] sm:text-5xl">
                    {formatPromoOffer(primaryPromotion)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closePopup}
                  className="grid size-10 place-items-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white hover:text-[#15110d]"
                  aria-label="Закрыть акцию"
                >
                  ×
                </button>
              </div>

              <div>
                <h3 className="max-w-sm text-2xl leading-tight font-semibold tracking-[-0.04em]">
                  {primaryPromotion.name}
                </h3>
                {primaryPromotion.description ? (
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/70">
                    {primaryPromotion.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:p-6">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#15110d]/10 bg-white/72 p-3">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-[#82776b] uppercase">
                    Срок
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#15110d]">
                    до {formatEndsAt(primaryPromotion.endsAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#15110d]/10 bg-white/72 p-3">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-[#82776b] uppercase">
                    Условие
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#15110d]">
                    {primaryPromotion.minOrderTotal
                      ? `от ${new Intl.NumberFormat("ru-RU").format(
                          primaryPromotion.minOrderTotal,
                        )} сом`
                      : "без порога"}
                  </p>
                </div>
              </div>

              {primaryPromotion.promoCode ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#d36a45] bg-white px-4 py-3">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-[#82776b] uppercase">
                    Промокод
                  </span>
                  <span className="font-mono text-sm font-semibold tracking-[0.18em] text-[#15110d]">
                    {primaryPromotion.promoCode}
                  </span>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Link
                  href="/catalog"
                  onClick={closePopup}
                  className="inline-flex h-12 items-center justify-center bg-[#15110d] px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-white uppercase transition hover:bg-[#d36a45]"
                >
                  Перейти в каталог
                </Link>
                <button
                  type="button"
                  onClick={closePopup}
                  className="inline-flex h-12 items-center justify-center border border-[#15110d]/16 px-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[#15110d] uppercase transition hover:border-[#15110d] hover:bg-white"
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
