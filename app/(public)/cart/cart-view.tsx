"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/providers/cart-provider";
import { SaveCartAsProject } from "@/components/account/save-cart-project";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import type { FeaturedProduct } from "@/features/catalog/types";
import { formatPrice } from "@/lib/commerce";

function NoteInput({
  productSlug,
  note,
  onSave,
}: {
  productSlug: string;
  note: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 font-mono text-[9px] tracking-[0.12em] text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
      >
        {note ? `📋 ${note}` : "+ заметка"}
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") { setDraft(note); setEditing(false); }
        }}
        placeholder="например: для левого шкафа"
        className="h-7 min-w-0 flex-1 border-b border-[var(--line)] bg-transparent px-1 font-mono text-[10px] text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
        autoFocus
      />
      <button type="button" onClick={() => { onSave(draft); setEditing(false); }} className="font-mono text-[9px] tracking-[0.1em] text-[var(--accent)] uppercase">
        OK
      </button>
    </div>
  );
}

export function CartView({ products }: { products: FeaturedProduct[] }) {
  const { items, subtotal, updateQuantity, removeItem, updateNote } = useCart();

  const rows = items
    .map((item) => {
      const product = products.find((p) => p.slug === item.productSlug);
      if (!product) return null;
      return { ...item, product };
    })
    .filter((item): item is { productSlug: string; quantity: number; note?: string; product: FeaturedProduct } => item !== null);

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <SectionHeading title="Корзина" description="Проверьте товары, количество и переходите к оформлению заказа." />

      {rows.length === 0 ? (
        <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-8 text-center">
          <p className="text-lg font-semibold text-[var(--foreground)]">Корзина пока пустая</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Добавьте товары из каталога, чтобы оформить заказ.</p>
          <Link href="/catalog" className="mt-6 inline-flex"><Button>Перейти в каталог</Button></Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-3">
            {rows.map((row) => (
              <article key={row.productSlug} className="surface-glow flex flex-col gap-4 rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--muted)]">{row.product.brand}</p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{row.product.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {typeof row.product.price === "number" ? formatPrice(row.product.price) : row.product.action}
                  </p>
                  <NoteInput productSlug={row.productSlug} note={row.note ?? ""} onSave={(value) => updateNote(row.productSlug, value || undefined)} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => updateQuantity(row.productSlug, Math.max(1, row.quantity - 1))}>-</Button>
                  <span className="min-w-10 text-center text-sm font-semibold">{row.quantity}</span>
                  <Button variant="secondary" size="sm" onClick={() => updateQuantity(row.productSlug, row.quantity + 1)}>+</Button>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(row.productSlug)}>Удалить</Button>
                </div>
              </article>
            ))}

            <SaveCartAsProject items={items} />
          </section>

          <aside className="surface-glow h-fit rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Итого</h3>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-sm text-[var(--muted)]">Сумма заказа</span>
              <span className="text-2xl font-semibold text-[var(--foreground)]">{formatPrice(subtotal)}</span>
            </div>
            <Link href="/checkout" className="mt-6 inline-flex w-full">
              <Button className="w-full" variant="accent">Оформить заказ</Button>
            </Link>
          </aside>
        </div>
      )}
    </Container>
  );
}