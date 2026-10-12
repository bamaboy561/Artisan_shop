"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { rankProductSearch } from "@/features/admin/product-search";

export type OrderProductPickerOption = {
  id: string;
  name: string;
  sku: string;
  brandName: string;
  categoryName: string;
  stockQuantity: number | null;
};

type OrderProductPickerProps = {
  products: OrderProductPickerOption[];
};

function getProductLabel(product: OrderProductPickerOption) {
  return [
    product.name,
    product.sku ? `арт. ${product.sku}` : "",
    product.brandName,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function OrderProductPicker({ products }: OrderProductPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const matchingProducts = useMemo(
    () => rankProductSearch(products, query),
    [products, query],
  );
  const selectedProduct = products.find(
    (product) => product.id === selectedProductId,
  );
  const visibleProducts = matchingProducts.slice(0, 100);
  const selectProducts =
    selectedProduct &&
    !visibleProducts.some((product) => product.id === selectedProduct.id)
      ? [selectedProduct, ...visibleProducts]
      : visibleProducts;

  return (
    <div className="grid min-w-0 gap-2">
      <label
        htmlFor="order-product-search"
        className="text-sm font-medium text-[var(--foreground)]"
      >
        Товар из каталога
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
        />
        <Input
          id="order-product-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Название, артикул, бренд или категория"
          className="h-10 pl-10"
        />
      </div>
      <Select
        name="newProductId"
        value={selectedProductId}
        onChange={(event) => setSelectedProductId(event.target.value)}
        disabled={selectProducts.length === 0}
        className="h-10 min-w-0"
      >
        <option value="">
          {matchingProducts.length === 0
            ? "Товары не найдены"
            : "Выберите товар"}
        </option>
        {selectProducts.map((product) => (
          <option key={product.id} value={product.id}>
            {getProductLabel(product)}
            {product.stockQuantity === null
              ? ""
              : ` · остаток ${product.stockQuantity}`}
          </option>
        ))}
      </Select>
      <p className="text-xs leading-5 text-[var(--muted)]">
        {query
          ? `Найдено: ${matchingProducts.length}.`
          : `Доступно товаров: ${products.length}.`}
        {matchingProducts.length > 100
          ? " Уточните запрос, чтобы сократить список."
          : ""}
      </p>
    </div>
  );
}
