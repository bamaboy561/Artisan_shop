import {
  BannerPlacement,
  PageStatus,
  type Banner,
  type SitePage,
} from "@/generated/prisma";
import {
  createBannerAction,
  createSitePageAction,
  deleteBannerAction,
  deleteSitePageAction,
  updateBannerAction,
  updateSitePageAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { MetricCard } from "@/components/admin/metric-card";
import { SetupState } from "@/components/admin/setup-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminSession } from "@/lib/auth/dal";
import { hasDatabaseUrl } from "@/lib/db";
import { getAdminContentOverview } from "@/lib/server/content-admin";

export const dynamic = "force-dynamic";

const pageStatusLabels: Record<PageStatus, string> = {
  [PageStatus.DRAFT]: "Черновик",
  [PageStatus.PUBLISHED]: "Опубликована",
};

const bannerPlacementLabels: Record<BannerPlacement, string> = {
  [BannerPlacement.HOME_HERO]: "Главная: hero",
  [BannerPlacement.HOME_SECONDARY]: "Главная: блок",
  [BannerPlacement.CATALOG]: "Каталог",
  [BannerPlacement.SERVICES]: "Услуги",
  [BannerPlacement.CONTACTS]: "Контакты",
};

function toDateInputValue(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Без срока";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function PageEditor({ page }: { page: SitePage }) {
  return (
    <article className="rounded-[24px] border border-[color:var(--line)] bg-white/86 p-4 shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
      <form action={updateSitePageAction} className="grid gap-3">
        <input type="hidden" name="id" value={page.id} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] tracking-[0.18em] text-[var(--accent)] uppercase">
              Страница
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              {page.title}
            </h3>
            <p className="text-xs text-[var(--muted)]">/{page.slug}</p>
          </div>
          <Select
            name="status"
            defaultValue={page.status}
            className="h-9 w-40 text-xs"
          >
            {Object.values(PageStatus).map((status) => (
              <option key={status} value={status}>
                {pageStatusLabels[status]}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            Заголовок
            <Input name="title" defaultValue={page.title} className="h-10" />
          </label>
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            Адрес страницы
            <Input name="slug" defaultValue={page.slug} className="h-10" />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
          Короткое описание
          <Textarea
            name="excerpt"
            rows={2}
            defaultValue={page.excerpt ?? ""}
            placeholder="Текст для карточек и вступительного блока."
          />
        </label>

        <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
          Основной текст
          <Textarea
            name="body"
            rows={5}
            defaultValue={page.body ?? ""}
            placeholder="Основной контент страницы."
          />
        </label>

        <details className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] p-3">
          <summary className="cursor-pointer font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
            SEO
          </summary>
          <div className="mt-3 grid gap-3">
            <Input
              name="seoTitle"
              defaultValue={page.seoTitle ?? ""}
              placeholder="SEO title"
            />
            <Textarea
              name="seoDescription"
              rows={2}
              defaultValue={page.seoDescription ?? ""}
              placeholder="SEO description"
            />
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <AdminSubmitButton
            type="submit"
            variant="accent"
            size="sm"
            idleLabel="Сохранить страницу"
            pendingLabel="Сохраняем..."
          />
          <button
            type="submit"
            formAction={deleteSitePageAction}
            className="inline-flex h-9 items-center justify-center px-4 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Удалить
          </button>
        </div>
      </form>
    </article>
  );
}

function BannerEditor({ banner }: { banner: Banner }) {
  return (
    <article className="rounded-[24px] border border-[color:var(--line)] bg-white/86 p-4 shadow-[0_18px_50px_rgba(30,28,25,0.04)]">
      <form action={updateBannerAction} className="grid gap-3">
        <input type="hidden" name="id" value={banner.id} />
        <div className="grid gap-3 lg:grid-cols-[1fr_13rem]">
          <div className="rounded-[20px] border border-[#15110d]/10 bg-[#15110d] p-4 text-white">
            <p className="font-mono text-[9px] tracking-[0.2em] text-white/48 uppercase">
              {bannerPlacementLabels[banner.placement]}
            </p>
            <h3 className="mt-4 text-2xl leading-tight font-semibold tracking-[-0.05em]">
              {banner.title}
            </h3>
            {banner.subtitle ? (
              <p className="mt-2 text-sm leading-6 text-white/66">
                {banner.subtitle}
              </p>
            ) : null}
            {banner.ctaLabel ? (
              <p className="mt-4 inline-flex border border-white/18 px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-white/76 uppercase">
                {banner.ctaLabel}
              </p>
            ) : null}
          </div>
          <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
            <p className="font-semibold text-[var(--foreground)]">
              {banner.isActive ? "Активен" : "Выключен"}
            </p>
            <p className="mt-2">Порядок: {banner.sortOrder}</p>
            <p className="mt-2">
              {formatDate(banner.startsAt)} → {formatDate(banner.endsAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            Заголовок
            <Input name="title" defaultValue={banner.title} className="h-10" />
          </label>
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            Ключ
            <Input name="key" defaultValue={banner.key} className="h-10" />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            Размещение
            <Select name="placement" defaultValue={banner.placement}>
              {Object.values(BannerPlacement).map((placement) => (
                <option key={placement} value={placement}>
                  {bannerPlacementLabels[placement]}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            Порядок
            <Input
              name="sortOrder"
              type="number"
              defaultValue={banner.sortOrder}
              className="h-10"
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
          Подзаголовок
          <Textarea
            name="subtitle"
            rows={2}
            defaultValue={banner.subtitle ?? ""}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            CTA
            <Input
              name="ctaLabel"
              defaultValue={banner.ctaLabel ?? ""}
              placeholder="Открыть каталог"
              className="h-10"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            Ссылка CTA
            <Input
              name="ctaHref"
              defaultValue={banner.ctaHref ?? ""}
              placeholder="/catalog"
              className="h-10"
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
          Изображение
          <Input
            name="imageUrl"
            defaultValue={banner.imageUrl ?? ""}
            placeholder="https://..."
            className="h-10"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            Старт
            <Input
              name="startsAt"
              type="date"
              defaultValue={toDateInputValue(banner.startsAt)}
              className="h-10"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
            Окончание
            <Input
              name="endsAt"
              type="date"
              defaultValue={toDateInputValue(banner.endsAt)}
              className="h-10"
            />
          </label>
        </div>

        <Checkbox
          name="isActive"
          value="on"
          defaultChecked={banner.isActive}
          label="Показывать баннер"
          description="Если выключить, баннер останется в админке, но не будет использоваться на витрине."
          className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3"
        />

        <div className="flex flex-wrap gap-2">
          <AdminSubmitButton
            type="submit"
            variant="accent"
            size="sm"
            idleLabel="Сохранить баннер"
            pendingLabel="Сохраняем..."
          />
          <button
            type="submit"
            formAction={deleteBannerAction}
            className="inline-flex h-9 items-center justify-center px-4 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Удалить
          </button>
        </div>
      </form>
    </article>
  );
}

export default async function AdminContentPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Контент сайта активируется после подключения базы"
        description="После подключения PostgreSQL здесь будут страницы, баннеры и быстрые блоки витрины."
        steps={[
          "Проверьте DATABASE_URL.",
          "Примените Prisma-схему.",
          "Создайте первый баннер или страницу.",
        ]}
      />
    );
  }

  await requireAdminSession("/login?next=/admin/content");

  const { pages, banners } = await getAdminContentOverview();
  const activeBanners = banners.filter((banner) => banner.isActive);
  const publishedPages = pages.filter(
    (page) => page.status === PageStatus.PUBLISHED,
  );

  return (
    <div className="space-y-5">
      <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-7">
        <SectionHeading
          title="Контент сайта"
          description="Единое место для текстов, SEO, баннеров и визуальных блоков. Менеджер меняет контент без правки кода."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-3xl text-sm leading-7"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Страницы"
          value={pages.length}
          detail={`${publishedPages.length} опубликовано`}
        />
        <MetricCard
          label="Баннеры"
          value={banners.length}
          detail={`${activeBanners.length} активны на витрине`}
        />
        <MetricCard
          label="Контроль"
          value="1 экран"
          detail="Тексты, SEO и визуальные блоки рядом"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
          <SectionHeading
            title="Новая страница"
            description="Создайте страницу, черновик или SEO-заготовку."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-7"
          />
          <form action={createSitePageAction} className="mt-5 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
                Заголовок
                <Input name="title" placeholder="Доставка и оплата" required />
              </label>
              <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
                Адрес
                <Input name="slug" placeholder="delivery" />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
              Короткое описание
              <Textarea name="excerpt" rows={2} />
            </label>
            <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
              Текст страницы
              <Textarea name="body" rows={5} />
            </label>
            <Select name="status" defaultValue={PageStatus.DRAFT}>
              {Object.values(PageStatus).map((status) => (
                <option key={status} value={status}>
                  {pageStatusLabels[status]}
                </option>
              ))}
            </Select>
            <AdminSubmitButton
              type="submit"
              variant="accent"
              idleLabel="Создать страницу"
              pendingLabel="Создаем..."
            />
          </form>
        </article>

        <article className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6">
          <SectionHeading
            title="Новый баннер"
            description="Баннеры нужны для главной, каталога, услуг и контактных блоков."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-7"
          />
          <form action={createBannerAction} className="mt-5 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
                Заголовок
                <Input name="title" placeholder="Раскрой за 1 день" required />
              </label>
              <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
                Ключ
                <Input name="key" placeholder="cutting-fast" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                name="placement"
                defaultValue={BannerPlacement.HOME_SECONDARY}
              >
                {Object.values(BannerPlacement).map((placement) => (
                  <option key={placement} value={placement}>
                    {bannerPlacementLabels[placement]}
                  </option>
                ))}
              </Select>
              <Input name="sortOrder" type="number" placeholder="100" />
            </div>
            <Textarea
              name="subtitle"
              rows={2}
              placeholder="Короткий текст баннера."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="ctaLabel" placeholder="Рассчитать" />
              <Input name="ctaHref" placeholder="/calculator" />
            </div>
            <Input name="imageUrl" placeholder="https://..." />
            <Checkbox
              name="isActive"
              value="on"
              defaultChecked
              label="Активный баннер"
              description="Баннер можно выключить без удаления."
              className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3"
            />
            <AdminSubmitButton
              type="submit"
              variant="accent"
              idleLabel="Создать баннер"
              pendingLabel="Создаем..."
            />
          </form>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <SectionHeading
            title="Страницы"
            description="Редактирование текста, статуса и SEO без перехода в код."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-7"
          />
          {pages.length > 0 ? (
            <div className="grid gap-3">
              {pages.map((page) => (
                <PageEditor key={page.id} page={page} />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-[color:var(--line)] bg-white/66 p-8 text-sm text-[var(--muted)]">
              Страницы появятся после создания первого материала.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SectionHeading
            title="Баннеры"
            description="Быстро меняйте заголовки, ссылки, изображения и периоды показа."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm leading-7"
          />
          {banners.length > 0 ? (
            <div className="grid gap-3">
              {banners.map((banner) => (
                <BannerEditor key={banner.id} banner={banner} />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-[color:var(--line)] bg-white/66 p-8 text-sm text-[var(--muted)]">
              Баннеры появятся после создания первого визуального блока.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
