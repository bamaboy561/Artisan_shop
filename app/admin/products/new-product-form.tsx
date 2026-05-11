"use client";

import { useState, type ReactNode } from "react";

import {
  createProductAction,
  updateProductDetailsAction,
} from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import {
  GeneratedSkuInput,
  GeneratedSlugInput,
  ManagerHelpCard,
} from "@/components/admin/generated-fields";
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
  const [name, setName] = useState(defaults?.name ?? "");
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");
  const [brandId, setBrandId] = useState(defaults?.brandId ?? "");
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedBrand = brands.find((item) => item.id === brandId);
  const productIdentity = [selectedBrand?.name, selectedCategory?.name, name]
    .filter(Boolean)
    .join(" ");
  const isFittings = selectedCategory?.kind === CategoryKind.FITTINGS;
  const showPlateFields = !isFittings;

  return (
    <form
      action={isEdit ? updateProductDetailsAction : createProductAction}
      encType="multipart/form-data"
      className="mt-5 grid min-w-0 gap-4"
    >
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <FormSection
        title="Основное"
        description="Название, категория и бренд. Адрес страницы и артикул можно оставить автоматическими."
      >
        <ManagerHelpCard title="Быстрое заполнение">
          Менеджеру достаточно заполнить название, категорию и бренд. Если
          артикула поставщика пока нет, система создаст внутренний SKU сама.
        </ManagerHelpCard>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_220px]">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Название товара
            <Input
              name="name"
              placeholder="Swiss Krono Kashmir"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <GeneratedSlugInput
            basePath="/product/"
            defaultValue={defaults?.slug}
            placeholder="swiss-krono-kashmir"
            sourceValue={productIdentity || name}
          />

          <GeneratedSkuInput
            defaultValue={defaults?.sku}
            sourceValue={productIdentity || name}
          />
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
            <Select
              name="brandId"
              value={brandId}
              onChange={(event) => setBrandId(event.target.value)}
            >
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
        title="Продажи"
        description="Выберите, как товар будет продаваться: через корзину, запрос цены или сервисную заявку."
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
            Остаток
            <Input
              name="stockQuantity"
              type="number"
              min="0"
              placeholder="0"
              defaultValue={defaults?.stockQuantity ?? ""}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Цена, KGS
            <Input
              name="price"
              type="number"
              min="0"
              placeholder="0"
              defaultValue={defaults?.price ?? ""}
            />
            <FieldHint>Если цена не указана, товар работает через запрос.</FieldHint>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Старая цена, KGS
            <Input
              name="compareAtPrice"
              type="number"
              min="0"
              placeholder="0"
              defaultValue={defaults?.compareAtPrice ?? ""}
            />
          </label>
        </div>

        <Checkbox
          name="isFeatured"
          defaultChecked={defaults?.isFeatured ?? false}
          label="Показывать в важных подборках"
          description="Подходит для главной страницы, витрин брендов и ручных подборок."
        />
      </FormSection>

      <FormSection
        title="Материал и калькулятор"
        description="Для плитных материалов укажите формат и привязку к калькулятору распила."
      >
        {showPlateFields ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
                Формат листа
                <Input
                  name="format"
                  placeholder="2800 x 2070 мм"
                  defaultValue={defaults?.format ?? ""}
                />
              </label>

              <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
                Толщина, мм
                <Select
                  name="thicknessMm"
                  defaultValue={defaults?.thicknessMm?.toString() ?? ""}
                >
                  <option value="">Не указана</option>
                  {THICKNESS_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value} мм
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
                Материал калькулятора
                <Select
                  name="calculatorMaterialId"
                  defaultValue={defaults?.calculatorMaterialId ?? ""}
                >
                  <option value="">Авто / не задан</option>
                  {calculatorMaterials.map((material) => (
                    <option key={material.slug} value={material.slug}>
                      {material.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
                Пресет листа
                <Select
                  name="calculatorSheetPresetId"
                  defaultValue={defaults?.calculatorSheetPresetId ?? ""}
                >
                  <option value="">Авто / не задан</option>
                  {calculatorSheetFormats.map((format) => (
                    <option key={format.slug} value={format.slug}>
                      {format.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <FieldHint>
              Для Swiss Krono, Extravert и AGT формат листа может подставляться
              автоматически в калькуляторе по товару.
            </FieldHint>
          </>
        ) : (
          <ManagerHelpCard title="Фурнитура">
            Для фурнитуры формат листа и калькулятор распила не нужны. Эти поля
            не показываются, чтобы не перегружать менеджера.
          </ManagerHelpCard>
        )}
      </FormSection>

      <FormSection
        title="Медиа и описание"
        description="Загрузите фото, добавьте короткое описание и характеристики для карточки товара."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Фото товара
            <Input
              name="imageFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              disabled={!canUploadImages}
            />
            <FieldHint>
              {canUploadImages
                ? "Можно загрузить PNG, JPG, WEBP или AVIF до 8 МБ."
                : "Загрузка файлов включится после подключения Vercel Blob."}
            </FieldHint>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            Ссылка на изображение
            <Input
              name="imageUrl"
              type="url"
              placeholder="https://..."
              defaultValue={defaults?.imageUrl ?? ""}
            />
            <FieldHint>Если файл не загружен, можно оставить внешнюю ссылку.</FieldHint>
          </label>
        </div>

        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Короткое описание
          <Textarea
            name="summary"
            rows={3}
            placeholder="Кратко для карточки и каталога."
            defaultValue={defaults?.summary ?? ""}
          />
        </label>

        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Полное описание
          <Textarea
            name="description"
            rows={5}
            placeholder="Подробное описание, особенности, область применения."
            defaultValue={defaults?.description ?? ""}
          />
        </label>

        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
          Характеристики
          <Textarea
            name="attributes"
            rows={5}
            placeholder={"Цвет: Кашемир\nПоверхность: Матовая\nТолщина: 16 мм"}
            defaultValue={defaults?.attributesText ?? ""}
          />
          <FieldHint>Каждая характеристика с новой строки в формате ключ: значение.</FieldHint>
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
              placeholder="Заголовок для поиска"
              defaultValue={defaults?.seoTitle ?? ""}
            />
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
            SEO description
            <Input
              name="seoDescription"
              placeholder="Краткое описание для поиска"
              defaultValue={defaults?.seoDescription ?? ""}
            />
          </label>
        </div>
      </FormSection>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-[22px] border border-[color:var(--line)] bg-[rgba(250,248,244,0.92)] p-4 shadow-[0_18px_45px_rgba(27,24,20,0.12)] backdrop-blur md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-[var(--muted)]">
          {isEdit
            ? "Сохраните изменения, чтобы обновить карточку на сайте."
            : "После создания товар появится в рабочем списке админки."}
        </p>
        <AdminSubmitButton
          type="submit"
          variant="accent"
          idleLabel={isEdit ? "Сохранить товар" : "Создать товар"}
          pendingLabel="Сохраняем..."
          className="w-full md:w-auto"
        />
      </div>
    </form>
  );
}
