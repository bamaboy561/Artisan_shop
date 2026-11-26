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

type Product = "kitchen" | CabinetKind;

// Что собираем — первое, что выбирает человек. Порядок: кухня, потом
// отдельные корпуса. Ссылка /konstruktor#kupe сразу открывает купе.
const PRODUCTS: Array<{ id: Product; label: string }> = [
  { id: "kitchen", label: "Кухня" },
  { id: "wardrobe", label: CABINET_KINDS.wardrobe.label },
  { id: "kupe", label: CABINET_KINDS.kupe.label },
  { id: "base", label: CABINET_KINDS.base.label },
  { id: "wall", label: CABINET_KINDS.wall.label },
];

const isProduct = (value: string): value is Product =>
  PRODUCTS.some((item) => item.id === value);

function ProductIcon({ id }: { id: Product }) {
  const icon =
    id === "kitchen"
      ? { row: "base" as const, type: "sink" }
      : id === "base"
        ? { row: "base" as const, type: "drawers" }
        : id === "wall"
          ? { row: "top" as const, type: "doors" }
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
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      setProduct(isProduct(hash) ? hash : "wardrobe");
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const choose = (next: Product) => {
    setProduct(next);
    window.history.replaceState(null, "", `#${next}`);
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
        <FurnitureConstructor key={product} {...props} kind={product} />
      )}
    </div>
  );
}
