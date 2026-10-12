import { Gift, MapPin, Truck, Wallet } from "lucide-react";

import { purchaseTerms } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const rows = [
  { icon: Wallet, title: "Оплата", text: purchaseTerms.payment },
  { icon: MapPin, title: "Самовывоз", text: purchaseTerms.pickup },
  { icon: Truck, title: "Доставка", text: purchaseTerms.delivery },
  { icon: Gift, title: "Бонусы", text: purchaseTerms.bonus },
];

export function PurchaseInfo({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Оплата и доставка"
      className={cn(
        "grid gap-3 border-t border-[color:var(--line)] pt-4 text-sm leading-6",
        className,
      )}
    >
      {rows.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-start gap-3">
          <Icon className="mt-1 size-4 shrink-0 text-[var(--accent)]" />
          <p className="text-[var(--muted)]">
            <span className="font-semibold text-[var(--foreground)]">
              {title}.
            </span>{" "}
            {text}
          </p>
        </li>
      ))}
    </ul>
  );
}
