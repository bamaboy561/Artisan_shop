import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteBrandAction, updateBrandAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminSession } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { ensureBrandLogoColumn } from "@/lib/server/brand-schema";

export const dynamic = "force-dynamic";

type EditBrandPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditBrandPage({ params }: EditBrandPageProps) {
  if (!hasDatabaseUrl()) notFound();

  await requireAdminSession("/login?next=/admin/brands");

  const { id } = await params;
  const db = getDb();
  await ensureBrandLogoColumn(db);

  const brand = await db.brand.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!brand) notFound();

  const logoStyle = brand.logoUrl
    ? { backgroundImage: `url(${brand.logoUrl})` }
    : undefined;

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/brands"
              className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase transition hover:text-[#9d573d]"
            >
              ← К списку брендов
            </Link>
            <SectionHeading
              title={brand.name}
              description={`Редактирование бренда. Связанных товаров: ${brand._count.products}.`}
              titleClassName="mt-2 text-2xl sm:text-3xl"
              descriptionClassName="text-sm leading-7"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/brands/${brand.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center border border-[var(--line-strong)] px-4 font-mono text-[11px] tracking-[0.16em] text-[var(--foreground)] uppercase transition hover:border-[var(--foreground)]"
            >
              Открыть на сайте
            </Link>
            <form action={deleteBrandAction}>
              <input type="hidden" name="id" value={brand.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={brand._count.products > 0}
                className="h-10 px-4 text-red-600 hover:bg-red-50 disabled:text-[var(--muted)]"
              >
                Удалить бренд
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[22px] border border-[color:var(--line)] bg-white/70 p-4 sm:flex-row sm:items-center">
          <div
            className="flex h-16 w-36 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[#171614] bg-contain bg-center bg-no-repeat text-lg font-semibold text-white"
            style={logoStyle}
            aria-label={`Логотип ${brand.name}`}
          >
            {brand.logoUrl ? null : brand.name.trim().slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
              Логотип бренда
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Вставьте ссылку на SVG, PNG или JPG логотип. Он появится в
              админке, на главной и на странице брендов.
            </p>
          </div>
        </div>

        <form action={updateBrandAction} className="grid gap-4">
          <input type="hidden" name="id" value={brand.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Название
              <Input name="name" defaultValue={brand.name} required />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Slug
              <Input name="slug" defaultValue={brand.slug} required />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Страна
              <Input
                name="country"
                defaultValue={brand.country ?? ""}
                placeholder="Швейцария / Польша"
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Сайт
              <Input
                name="website"
                type="url"
                defaultValue={brand.website ?? ""}
                placeholder="https://brand.com"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            URL логотипа
            <Input
              name="logoUrl"
              type="url"
              defaultValue={brand.logoUrl ?? ""}
              placeholder="https://brand.com/logo.svg"
            />
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Описание
            <Textarea
              name="description"
              rows={5}
              defaultValue={brand.description ?? ""}
              placeholder="Короткое описание бренда для страницы и карточек."
            />
          </label>

          <AdminSubmitButton
            type="submit"
            variant="accent"
            className="w-full sm:w-auto"
            idleLabel="Сохранить изменения"
            pendingLabel="Сохраняем..."
          />
        </form>
      </section>
    </div>
  );
}
