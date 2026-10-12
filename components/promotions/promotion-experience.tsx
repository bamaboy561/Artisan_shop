"use client";

import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { getButtonClassName } from "@/components/ui/button";
import type { PublicPromotion } from "@/lib/server/promotions-public";

function formatPromoOffer(promotion: PublicPromotion) {
  const value = new Intl.NumberFormat("ru-RU").format(promotion.discountValue);
  if (promotion.discountType === "FIXED_AMOUNT") return `-${value} сом`;
  if (promotion.discountType === "FIXED_PRICE") return `${value} сом`;
  return `-${value}%`;
}

export function PromotionExperience({
  promotions,
}: {
  promotions: PublicPromotion[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const promotion = promotions[0];
  if (!promotion) return null;

  return (
    <>
      <section
        className="border-b border-rose-200 bg-rose-50 text-rose-950"
        aria-label="Акция"
      >
        <div className="mx-auto flex min-h-11 max-w-[1500px] items-center gap-2 px-4 py-2 text-xs sm:gap-3 sm:px-8 sm:text-sm lg:px-10">
          <Tag className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
          <span className="shrink-0 font-semibold text-rose-700">
            {formatPromoOffer(promotion)}
          </span>
          <Link
            href={promotion.href}
            className="min-w-0 flex-1 truncate hover:underline"
            title={promotion.name}
          >
            {promotion.name}
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="shrink-0 py-1 underline underline-offset-4"
          >
            Условия
          </button>
        </div>
      </section>
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={promotion.name}
        footer={
          <Link
            href={promotion.href}
            onClick={() => setIsOpen(false)}
            className={getButtonClassName("accent", "md", "gap-2")}
          >
            {promotion.hrefLabel}
            <ArrowRight className="size-4" />
          </Link>
        }
      >
        <div className="space-y-4 text-sm leading-6">
          <p className="text-3xl font-semibold text-rose-700">
            {formatPromoOffer(promotion)}
          </p>
          {promotion.description ? <p>{promotion.description}</p> : null}
          <dl className="space-y-2 border-y border-[color:var(--line)] py-4">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-[var(--muted)]">Срок</dt>
              <dd>
                {promotion.endsAt
                  ? `До ${new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", timeZone: "Asia/Bishkek" }).format(new Date(promotion.endsAt))}`
                  : "Без ограничения срока"}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-[var(--muted)]">Сумма заказа</dt>
              <dd>
                {promotion.minOrderTotal
                  ? `От ${new Intl.NumberFormat("ru-RU").format(promotion.minOrderTotal)} сом`
                  : "Без минимальной суммы"}
              </dd>
            </div>
          </dl>
          {promotion.promoCode ? (
            <p className="break-all">
              Промокод: <strong>{promotion.promoCode}</strong>
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
