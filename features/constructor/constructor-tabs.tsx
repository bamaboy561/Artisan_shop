"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

import {
  CABINET_KINDS,
  type CabinetKind,
} from "@/features/services/cabinet-builder";
import { cn } from "@/lib/utils";
import type {
  ConstructorDecor,
  ConstructorFittingProduct,
} from "@/lib/server/constructor-decors";

import { BlockIcon } from "./kitchen-blocks";

// Кухня и шкаф — разные конструкторы: грузим только тот, что открыт.
const loading = () => (
  <div className="h-[44svh] min-h-[300px] animate-pulse rounded-[20px] bg-[var(--surface-strong)] lg:h-[clamp(520px,calc(100svh-280px),820px)]" />
);
const FurnitureConstructor = dynamic(
  () => import("./furniture-constructor").then((m) => m.FurnitureConstructor),
  { ssr: false, loading },
);
const KitchenConstructor = dynamic(
  () => import("./kitchen-constructor").then((m) => m.KitchenConstructor),
  { ssr: false, loading },
);

type Product = "kitchen" | "wardrobe";

// Что собираем — первое, что выбирает человек: кухня или шкаф. Купе —
// выбор дверей внутри шкафа; тумбы и навесные собираются блоками кухни.
const PRODUCTS: Array<{ id: Product; label: string }> = [
  { id: "kitchen", label: "Кухня" },
  { id: "wardrobe", label: CABINET_KINDS.wardrobe.label },
];

// Старые ссылки: /konstruktor#kupe — шкаф-купе, #base и #wall — кухня.
function fromHash(hash: string): { product: Product; kind: CabinetKind } {
  if (hash === "kitchen" || hash === "base" || hash === "wall") {
    return { product: "kitchen", kind: "wardrobe" };
  }
  return { product: "wardrobe", kind: hash === "kupe" ? "kupe" : "wardrobe" };
}

function ProductIcon({ id }: { id: Product }) {
  const icon =
    id === "kitchen"
      ? { row: "base" as const, type: "sink" }
      : { row: "base" as const, type: "tallPantry" };
  return <BlockIcon row={icon.row} type={icon.type} className="size-6" />;
}

// Один конструктор: выбор изделия сверху, дальше шаги справа и 3D слева.
export function ConstructorTabs({
  title,
  ...props
}: {
  title?: ReactNode;
  decors: ConstructorDecor[];
  fittingProducts: ConstructorFittingProduct[];
}) {
  const [product, setProduct] = useState<Product>("wardrobe");
  // Распашной шкаф или купе: помним, пока человек ходит между вкладками.
  const [kind, setKind] = useState<CabinetKind>("wardrobe");
  // Переход по ссылке с другим #… собирает шкаф заново.
  const [linkVisit, setLinkVisit] = useState(0);
  useEffect(() => {
    const read = () => {
      const next = fromHash(window.location.hash.slice(1));
      setProduct(next.product);
      setKind(next.kind);
      setLinkVisit((current) => current + 1);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const choose = (next: Product) => {
    setProduct(next);
    window.history.replaceState(
      null,
      "",
      `#${next === "wardrobe" && kind === "kupe" ? "kupe" : next}`,
    );
  };

  return (
    <div className="grid gap-4 sm:gap-5">
      <div className="grid gap-3 lg:flex lg:items-center lg:justify-between lg:gap-6">
        {title}
        <div
          role="tablist"
          aria-label="Что собираем"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
        >
          {PRODUCTS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={product === item.id}
              onClick={() => choose(item.id)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border pr-4 pl-2.5 text-[14px] font-medium transition-colors",
                product === item.id
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)] [&_svg]:text-[var(--surface)]"
                  : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--foreground)] hover:border-[var(--foreground)]",
              )}
            >
              <ProductIcon id={item.id} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {product === "kitchen" ? (
        <KitchenConstructor {...props} />
      ) : (
        <FurnitureConstructor
          key={linkVisit}
          {...props}
          kind={kind}
          onKindChange={(next) => {
            setKind(next);
            window.history.replaceState(null, "", `#${next}`);
          }}
        />
      )}
    </div>
  );
}
