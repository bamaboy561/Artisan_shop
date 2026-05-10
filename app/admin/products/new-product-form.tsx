"use client";

import { useState, type ReactNode } from "react";

import {
  createProductAction,
  updateProductDetailsAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CategoryKind,
  InventoryStatus,
  ProductOrderMode,
  ProductStatus,
} from "@/generated/prisma";
import { cn } from "@/lib/utils";

const statusLabels: Record<ProductStatus, string> = {
  [ProductStatus.DRAFT]: "Черновик",
  [ProductStatus.ACTIVE]: "Опубликован",
  [ProductStatus.ARCHIVED]: "Архив",
};

const orderModeLabels: Record<ProductOrderMode, string> = {
  [ProductOrderMode.CART]: "В корзину",
  [ProductOrderMode.REQUEST_PRICE]: "Запрос цены",
  [ProductOrderMode.SERVICE]: "Сервисная заявка",
};

const inventoryLabels: Record<InventoryStatus, string> = {
  [InventoryStatus.IN_STOCK]: "В наличии",
  [InventoryStatus.LIMITED]: "Остаток ограничен",
  [InventoryStatus.OUT_OF_STOCK]: "Нет в наличии",
  [InventoryStatus.ON_REQUEST]: "Под запрос",
};

const THICKNESS_OPTIONS = [8, 10, 12, 16, 18, 22, 25];

type CategoryOption = { id: string; name: string; kind: CategoryKind };
type BrandOption = { id: string; name: string };
type SlugLabelOption = { slug: string; label: string };

export type ProductFormDefaults = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number | null;
  categoryId: string;
  brandId: string | null;
  status: ProductStatus;
  orderMode: ProductOrderMode;
  inventoryStatus: InventoryStatus;
  format: string | null;
  thicknessMm: number | null;
  imageUrl: string | null;
  calculatorMaterialId: string | null;
  calculatorSheetPresetId: string | null;
  summary: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  attributesText: string;
  isFeatured: boolean;
};

type Props = {
  categories: CategoryOption[];
  brands: BrandOption[];
  calculatorMaterials: SlugLabelOption[];
  calculatorSheetFormats: SlugLabelOption[];
  canUploadImages: boolean;
  defaults?: ProductFormDefaults;
};

function FieldHint({ children }: { children: ReactNode }) {
  return <span className="text-xs leading-5 text-[var(--muted)]">{children}</span>;
}

function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[22px] border border-[color:var(--line)] bg-white/72 p-4 sm:p-5",
        className,
      )}
    >
      <div className="border-b border-[color:var(--line)] pb-4">
        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
          {title}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {description}
        </p>
      </div>
      <div className="mt-5 grid min-w-0 gap-4">{children}</div>
    </section>
  );
}

export function NewProductForm({
  categories,
  brands,
  calculatorMaterials,
  calculatorSheetFormats,
  canUploadImages,
  defaults,
}: Props) {
  const isEdit = Boolean(defaults);
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");
  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const isFittings = selectedCategory?.kind === CategoryKind.FITTINGS;
  const showPlateFields = !isFittings;

  return (
    <form
      action={isEdit ? updateProductDetailsAction : createProductAction}
      encType="multipart/form-data"
      className="mt-5 grid min-w-0 gap-4"
    >
      {defaults ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      <FormSection
        title="Основное"
        description="Название, адрес страницы, артикул и привязка к разделу каталога."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_220px]">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Название
            <Input
              name="name"
              placeholder="Swiss Krono Кашемир"
              defaultValue={defaults?.name ?? ""}
              required
            />
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Адрес страницы
            <Input
              name="slug"
              placeholder="swiss-krono-kashmir"
              defaultValue={defaults?.slug ?? ""}
              required
            />
            <FieldHint>Часть ссылки после /product/. Латиница и дефисы.</FieldHint>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Артикул / SKU
            <Input
              name="sku"
              placeholder="SK-KASHMIR-16"
              defaultValue={defaults?.sku ?? ""}
              required
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Категория
            <Select
              name="categoryId"
              required
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="" disabled>
                Выберите категорию
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Бренд
            <Select name="brandId" defaultValue={defaults?.brandId ?? ""}>
              <option value="">Без бренда</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </FormSection>

      <FormSection
        title="Коммерция"
        description="Как товар продается: напрямую в корзину, через запрос цены или как сервисная заявка."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Статус
            <Select
              name="status"
              defaultValue={defaults?.status ?? ProductStatus.DRAFT}
            >
              {Object.values(ProductStatus).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Сценарий заказа
            <Select
              name="orderMode"
              defaultValue={defaults?.orderMode ?? ProductOrderMode.REQUEST_PRICE}
            >
              {Object.values(ProductOrderMode).map((mode) => (
                <option key={mode} value={mode}>
                  {orderModeLabels[mode]}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Наличие
            <Select
              name="inventoryStatus"
              defaultValue={
                defaults?.inventoryStatus ?? InventoryStatus.ON_REQUEST
              }
            >
              {Object.values(InventoryStatus).map((status) => (
                <option key={status} value={status}>
                  {inventoryLabels[status]}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Остаток, шт.
            <Input
              name="stockQuantity"
              type="number"
              min="0"
              placeholder="12"
              defaultValue={defaults?.stockQuantity ?? ""}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Цена, сом
            <Input
              name="price"
              type="number"
              min="0"
              placeholder="3150"
              defaultValue={defaults?.price ?? ""}
            />
            <FieldHint>Оставьте пустым, если товар работает по запросу цены.</FieldHint>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Старая цена, сом
            <Input
              name="compareAtPrice"
              type="number"
              min="0"
              placeholder="3500"
              defaultValue={defaults?.compareAtPrice ?? ""}
            />
            <FieldHint>Показывается как зачеркнутая цена, если она выше основной.</FieldHint>
          </label>
        </div>
      </FormSection>

      <FormSection
        title="Материал и калькулятор"
        description="Для плитных материалов задайте формат, толщину и пресеты расчета. Для фурнитуры эти поля можно не заполнять."
      >
        {showPlateFields ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
              Формат на витрине
              <Select name="format" defaultValue={defaults?.format ?? ""}>
                <option value="">Не указан</option>
                {calculatorSheetFormats.map((sheet) => (
                  <option key={sheet.slug} value={sheet.label}>
                    {sheet.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
              Толщина, мм
              <Select
                name="thicknessMm"
                defaultValue={defaults?.thicknessMm ?? ""}
              >
                <option value="">Не указана</option>
                {THICKNESS_OPTIONS.map((thickness) => (
                  <option key={thickness} value={thickness}>
                    {thickness} мм
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
              Материал расчета
              <Select
                name="calculatorMaterialId"
                defaultValue={defaults?.calculatorMaterialId ?? ""}
              >
                <option value="">Не привязывать</option>
                {calculatorMaterials.map((material) => (
                  <option key={material.slug} value={material.slug}>
                    {material.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
              Формат листа
              <Select
                name="calculatorSheetPresetId"
                defaultValue={defaults?.calculatorSheetPresetId ?? ""}
              >
                <option value="">Не привязывать</option>
                {calculatorSheetFormats.map((sheet) => (
                  <option key={sheet.slug} value={sheet.slug}>
                    {sheet.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        ) : (
          <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-4 text-sm leading-6 text-[var(--muted)]">
            Для выбранной категории это похоже на фурнитуру. Параметры листа и
            калькулятора скрыты, чтобы не мешать заполнению карточки.
          </div>
        )}
      </FormSection>

      <FormSection
        title="Медиа и тексты"
        description="Фото, описание карточки и характеристики, которые увидит клиент."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Загрузить изображение
            <Input
              name="imageFile"
              type="file"
              accept="image/avif,image/jpeg,image/png,image/webp"
              disabled={!canUploadImages}
            />
            <FieldHint>
              {canUploadImages
                ? "JPG, PNG, WebP или AVIF до 8 МБ. Файл сохранится в Vercel Blob."
                : "Загрузка файлов выключена: подключите Vercel Blob и переменную BLOB_READ_WRITE_TOKEN. Пока можно указать ссылку ниже."}
            </FieldHint>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Ссылка на изображение
            <Input
              name="imageUrl"
              placeholder="https://... или /images/product.jpg"
              defaultValue={defaults?.imageUrl ?? ""}
            />
            <FieldHint>
              Можно использовать вместо загрузки файла или оставить текущую
              ссылку при редактировании.
            </FieldHint>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Краткое описание
            <Textarea
              name="summary"
              rows={4}
              placeholder="Короткое коммерческое описание для карточки товара."
              defaultValue={defaults?.summary ?? ""}
            />
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Полное описание
            <Textarea
              name="description"
              rows={4}
              placeholder="Подробное описание для страницы товара."
              defaultValue={defaults?.description ?? ""}
            />
          </label>
        </div>

        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Характеристики
          <Textarea
            name="attributes"
            rows={5}
            placeholder={"Цвет: Кашемир\nПокрытие: Матовая поверхность\nТекстура: Однотонная"}
            defaultValue={defaults?.attributesText ?? ""}
          />
          <FieldHint>
            Каждая характеристика с новой строки в формате “Название: значение”.
          </FieldHint>
        </label>
      </FormSection>

      <FormSection
        title="SEO"
        description="Можно оставить пустым: сайт использует название и описание товара."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            SEO title
            <Input
              name="seoTitle"
              placeholder="Заголовок для поисковиков"
              defaultValue={defaults?.seoTitle ?? ""}
            />
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            SEO description
            <Input
              name="seoDescription"
              placeholder="Описание для поисковой выдачи"
              defaultValue={defaults?.seoDescription ?? ""}
            />
          </label>
        </div>
      </FormSection>

      <section className="surface-glow sticky bottom-3 z-10 flex flex-col gap-3 rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-4 shadow-[0_18px_50px_rgba(30,28,25,0.08)] sm:flex-row sm:items-center sm:justify-between">
        <Checkbox
          name="isFeatured"
          value="on"
          defaultChecked={defaults?.isFeatured ?? false}
          label="Показывать в подборках"
          description="Для главной, брендов и внутренних промо-блоков."
          className="rounded-2xl border border-[color:var(--line)] bg-white/72 px-4 py-3"
        />

        <AdminSubmitButton
          type="submit"
          variant="accent"
          className="w-full sm:w-auto"
          idleLabel={isEdit ? "Сохранить изменения" : "Добавить товар"}
          pendingLabel={isEdit ? "Сохраняем..." : "Добавляем..."}
        />
      </section>
    </form>
  );
}
