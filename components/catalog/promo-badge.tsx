import { cn } from "@/lib/utils";

type PromoBadgeProps = {
  price?: number | null;
  oldPrice?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function getPromoDiscountPercent(
  price?: number | null,
  oldPrice?: number | null,
) {
  if (!price || !oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

// Bright «Акция!» sticker for products with an active promotion discount.
// Fixed colours on purpose: it has to shout on any card or theme.
export function PromoBadge({
  price,
  oldPrice,
  size = "md",
  className,
}: PromoBadgeProps) {
  const percent = getPromoDiscountPercent(price, oldPrice);

  return (
    <span
      className={cn(
        "promo-badge inline-flex items-center gap-1.5 font-extrabold tracking-[0.02em] whitespace-nowrap text-white uppercase shadow-[0_6px_16px_-6px_rgba(220,20,40,0.65)]",
        "bg-[linear-gradient(135deg,#ff2d3d_0%,#e3001b_60%,#c40018_100%)] ring-2 ring-white",
        size === "sm" && "px-1.5 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-1 text-xs sm:text-[13px]",
        size === "lg" && "px-3.5 py-1.5 text-sm sm:text-base",
        className,
      )}
    >
      Акция!
      {percent > 0 ? (
        <span
          className={cn(
            "bg-[#ffd400] font-black text-[#1a1a1a]",
            size === "sm" ? "px-1 text-[10px]" : "px-1.5 py-px",
          )}
        >
          −{percent}%
        </span>
      ) : null}
    </span>
  );
}
