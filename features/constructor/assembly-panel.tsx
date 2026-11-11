"use client";

import { useMemo, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";

import { useCart } from "@/components/providers/cart-provider";
import type { ConstructorFittingProduct } from "@/lib/server/constructor-decors";

import type { AssemblyStep, FittingLine } from "./assembly";

const priceFormatter = new Intl.NumberFormat("ru-RU");

// Бренды, которые часто пишут только в названии товара, без карточки
// бренда.
const KNOWN_BRANDS = [
  "Hettich",
  "Blum",
  "Italiana Ferramenta",
  "Hafele",
  "GTV",
  "FGV",
  "Boyard",
  "Samet",
];

// Бренд товара: из карточки, иначе — бренд из списка, названный в имени
// товара («Петля Hettich Sensys»).
export function productBrand(
  product: ConstructorFittingProduct,
  brands: string[] = [],
) {
  if (product.brand) return product.brand;
  const name = product.name.toLowerCase();
  return (
    [...brands, ...KNOWN_BRANDS].find((brand) =>
      name.includes(brand.toLowerCase()),
    ) ?? null
  );
}

// Бренды фурнитуры в каталоге: сначала те, у кого больше товаров.
export function fittingBrands(products: ConstructorFittingProduct[]) {
  const counts = new Map<string, { name: string; count: number }>();
  for (const product of products) {
    const brand = productBrand(product);
    if (!brand) continue;
    const key = brand.toLowerCase();
    const entry = counts.get(key) ?? { name: brand, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"))
    .map((entry) => entry.name);
}

const findIn = (line: FittingLine, products: ConstructorFittingProduct[]) =>
  products.find((product) => line.search.test(product.name)) ??
  products.find((product) => line.search.test(product.category)) ??
  null;

// Подходящий товар из каталога: сначала по названию товара, потом по
// названию категории. С выбранным брендом — сначала среди его товаров;
// чего у бренда нет, подбираем у других (fallback: true).
export function matchFittingProduct(
  line: FittingLine,
  products: ConstructorFittingProduct[],
  brand = "",
): { product: ConstructorFittingProduct | null; fallback: boolean } {
  if (brand) {
    const brands = fittingBrands(products);
    const wanted = brand.toLowerCase();
    const own = products.filter(
      (product) => productBrand(product, brands)?.toLowerCase() === wanted,
    );
    const product = findIn(line, own);
    if (product) return { product, fallback: false };
    const other = findIn(line, products);
    return { product: other, fallback: Boolean(other) };
  }
  return { product: findIn(line, products), fallback: false };
}

export function FittingsPanel({
  lines,
  products,
}: {
  lines: FittingLine[];
  products: ConstructorFittingProduct[];
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const brands = useMemo(() => fittingBrands(products), [products]);
  const [brand, setBrand] = useState("");
  const found = lines.map((line) => ({
    line,
    ...matchFittingProduct(line, products, brand),
  }));
  // Эксцентрик часто продают вместе со штоком: тогда шток отдельно не
  // кладём.
  const minifixSlug = found.find(({ line }) => line.key === "minifix")?.product
    ?.slug;
  const matched = found.map((item) => ({
    ...item,
    bundled:
      item.line.key === "minifixStem" &&
      Boolean(minifixSlug) &&
      item.product?.slug === minifixSlug,
  }));
  const total = matched.reduce(
    (sum, { line, product, bundled }) =>
      sum + (bundled ? 0 : (product?.price ?? 0) * line.count),
    0,
  );
  const inCatalog = matched.filter(
    ({ product, bundled }) => product && !bundled,
  );

  const addOne = async (line: FittingLine, slug: string) => {
    const ok = await addItem(slug, line.count);
    if (ok) setAdded((current) => new Set(current).add(line.key));
    return ok;
  };

  const addAll = async () => {
    setBusy(true);
    setMessage("");
    let failed = 0;
    // Один товар может подойти к двум строкам (саморезы) — кладём сумму.
    const bySlug = new Map<string, { count: number; keys: string[] }>();
    for (const { line, product } of inCatalog) {
      const entry = bySlug.get(product!.slug) ?? { count: 0, keys: [] };
      entry.count += line.count;
      entry.keys.push(line.key);
      bySlug.set(product!.slug, entry);
    }
    for (const [slug, entry] of bySlug) {
      const ok = await addItem(slug, entry.count);
      if (ok) {
        setAdded((current) => {
          const next = new Set(current);
          entry.keys.forEach((key) => next.add(key));
          return next;
        });
      } else failed += 1;
    }
    setBusy(false);
    setMessage(
      failed
        ? "Часть позиций не добавилась: их нет в нужном количестве. Остальное в корзине."
        : "Фурнитура в корзине.",
    );
  };

  return (
    <div className="rounded-xl border border-[color:var(--line)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Фурнитура для сборки</p>
        {brands.length > 0 ? (
          <label className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
            Бренд
            <select
              value={brand}
              onChange={(event) => {
                setBrand(event.target.value);
                setAdded(new Set());
                setMessage("");
              }}
              className="h-8 rounded-full border border-[color:var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)]"
            >
              <option value="">Любой</option>
              {brands.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <ul className="mt-2 grid gap-2 text-[13px]">
        {matched.map(({ line, product, bundled, fallback }) => (
          <li
            key={line.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-t border-[color:var(--line)] pt-2 first:border-t-0 first:pt-0"
          >
            <span>
              {line.label}{" "}
              <span className="text-[var(--muted)]">{line.note}</span>
            </span>
            <span className="text-right font-semibold tabular-nums">
              {line.count} шт.
            </span>
            {bundled ? (
              <span className="col-span-2 text-[12px] text-[var(--muted)]">
                Идёт в комплекте с эксцентриком.
              </span>
            ) : product ? (
              <span className="col-span-2 mt-0.5 flex items-center justify-between gap-2 text-[12px] text-[var(--muted)]">
                <a
                  href={`/product/${product.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate underline decoration-dotted underline-offset-2"
                  title={
                    fallback ? `У ${brand} нет — подобрали другой бренд` : ""
                  }
                >
                  {fallback ? "Другой бренд: " : ""}
                  {product.name}
                  {product.price
                    ? ` · ${priceFormatter.format(product.price)} сом/шт.`
                    : ""}
                </a>
                <button
                  type="button"
                  onClick={() => void addOne(line, product.slug)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--line)] px-2.5 py-1 text-[12px] font-medium text-[var(--foreground)]"
                >
                  {added.has(line.key) ? (
                    <Check className="size-3.5" />
                  ) : (
                    <ShoppingCart className="size-3.5" />
                  )}
                  {added.has(line.key) ? "В корзине" : "В корзину"}
                </button>
              </span>
            ) : (
              <span className="col-span-2 text-[12px] text-[var(--muted)]">
                Нет в каталоге — уточните у менеджера.
              </span>
            )}
          </li>
        ))}
      </ul>
      {inCatalog.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {total > 0 ? (
            <p className="text-[13px]">
              Примерно{" "}
              <span className="font-semibold">
                {priceFormatter.format(total)} сом
              </span>{" "}
              за фурнитуру из каталога.
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void addAll()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[color:var(--line-strong)] px-5 text-[14px] font-semibold disabled:opacity-50"
          >
            <ShoppingCart className="size-4" />
            {busy ? "Добавляем…" : "Вся фурнитура в корзину"}
          </button>
          {message ? (
            <p className="text-[12px] text-[var(--muted)]">{message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AssemblyStepCard({
  steps,
  step,
  onStep,
  onClose,
  onPrint,
}: {
  steps: AssemblyStep[];
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
  onPrint: () => void;
}) {
  const current = steps[step];
  if (!current) return null;
  return (
    <div className="grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[var(--surface-strong)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">
          Шаг {step + 1} из {steps.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] text-[var(--muted)] underline underline-offset-2"
        >
          Выйти из инструкции
        </button>
      </div>
      <p className="text-lg font-semibold">{current.title}</p>
      <p className="text-[14px] leading-6">{current.text}</p>
      {current.fittings.length > 0 ? (
        <ul className="grid gap-1 rounded-xl bg-[var(--surface)] p-3 text-[13px]">
          {current.fittings.map((item) => (
            <li key={item.label} className="flex justify-between gap-3">
              <span>{item.label}</span>
              <span className="font-semibold tabular-nums">
                {item.count} шт.
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => onStep(step - 1)}
          className="inline-flex h-10 items-center rounded-full border border-[color:var(--line)] px-4 text-[14px] font-medium disabled:opacity-40"
        >
          ← Назад
        </button>
        <button
          type="button"
          disabled={step === steps.length - 1}
          onClick={() => onStep(step + 1)}
          className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-5 text-[14px] font-semibold text-[var(--accent-ink)] disabled:opacity-40"
        >
          Дальше →
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="ml-auto inline-flex h-10 items-center rounded-full border border-[color:var(--line)] px-4 text-[14px] font-medium"
        >
          Распечатать / PDF
        </button>
      </div>
    </div>
  );
}

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Печатная инструкция: шаги с картинками, детали и фурнитура. Открывается
// в новой вкладке, оттуда печать или «Сохранить как PDF».
export function instructionHtml({
  title,
  subtitle,
  steps,
  images,
  fittings,
  parts,
}: {
  title: string;
  subtitle: string;
  steps: AssemblyStep[];
  images: Array<string | null>;
  fittings: FittingLine[];
  parts: Array<{ name: string; size: string; count: number }>;
}) {
  const fittingRows = fittings
    .map(
      (line) =>
        `<tr><td>${escape(line.label)} <span class="m">${escape(line.note)}</span></td><td class="n">${line.count} шт.</td></tr>`,
    )
    .join("");
  const partRows = parts
    .map(
      (part) =>
        `<tr><td>${escape(part.name)}</td><td>${escape(part.size)}</td><td class="n">${part.count}</td></tr>`,
    )
    .join("");
  const stepBlocks = steps
    .map((step, index) => {
      const image = images[index] ? `<img src="${images[index]}" alt="">` : "";
      const list = step.fittings.length
        ? `<ul>${step.fittings.map((item) => `<li>${escape(item.label)} — <b>${item.count} шт.</b></li>`).join("")}</ul>`
        : "";
      return `<section class="step">${image}<div><h3>Шаг ${index + 1}. ${escape(step.title)}</h3><p>${escape(step.text)}</p>${list}</div></section>`;
    })
    .join("");

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escape(title)} — инструкция по сборке</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d1a16;margin:24px;max-width:900px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}h3{font-size:16px;margin:0 0 6px}
.m{color:#7a7166}p{line-height:1.5;margin:0 0 8px}
table{border-collapse:collapse;width:100%;font-size:13px}td{border-top:1px solid #e3ddd3;padding:5px 4px}td.n{text-align:right;white-space:nowrap}
.step{display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start;padding:14px 0;border-top:1px solid #e3ddd3;break-inside:avoid}
.step img{width:300px;height:260px;object-fit:contain;border-radius:10px;background:#f3f0ea}
ul{margin:6px 0 0;padding-left:18px;font-size:13px}
.brand{color:#b5532c;font-weight:700;letter-spacing:.1em;font-size:12px}
@media print{body{margin:10mm}.noprint{display:none}}
</style></head><body>
<p class="brand">ARTISAN · artisan.shop.kg</p>
<h1>${escape(title)}</h1><p class="m">${escape(subtitle)}</p>
<button class="noprint" onclick="print()" style="margin:8px 0;padding:8px 16px;border-radius:999px;border:1px solid #ccc;background:#fff">Печать / сохранить PDF</button>
<h2>Фурнитура</h2><table>${fittingRows}</table>
<h2>Детали</h2><table>${partRows}</table>
<h2>Сборка по шагам</h2>${stepBlocks}
</body></html>`;
}
