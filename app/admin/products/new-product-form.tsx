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

type ProductTemplateId =
  | "plate"
  | "fittings"
  | "wardrobe"
  | "kitchen"
  | "other";

type ProductTemplateConfig = {
  label: string;
  shortLabel: string;
  panelTitle: string;
  formatLabel: string;
  formatPlaceholder: string;
  helper: string;
  recommendedOrderMode: ProductOrderMode;
  recommendedInventoryStatus: InventoryStatus;
  attributeTemplate: string;
};

const productTemplateConfigs: Record<ProductTemplateId, ProductTemplateConfig> = {
  plate: {
    label: "Плитный материал",
    shortLabel: "Плиты",
    panelTitle: "Плитный материал",
    formatLabel: "Формат листа",
    formatPlaceholder: "2800 x 2070 мм",
    helper:
      "Для ЛДСП, МДФ и панелей включаются толщина, материал расчета и формат калькулятора.",
    recommendedOrderMode: ProductOrderMode.REQUEST_PRICE,
    recommendedInventoryStatus: InventoryStatus.ON_REQUEST,
    attributeTemplate:
      "Декор:\nПоверхность:\nТолщина:\nФормат листа:\nГруппа декора:\nПрименение:",
  },
  fittings: {
    label: "Фурнитура",
    shortLabel: "Фурнитура",
    panelTitle: "Фурнитура",
    formatLabel: "Единица / комплектность",
    formatPlaceholder: "шт / комплект / пара",
    helper:
      "Для Hettich, Samet, Emaks и Italiana Ferramenta лист, толщина и калькулятор не нужны.",
    recommendedOrderMode: ProductOrderMode.CART,
    recommendedInventoryStatus: InventoryStatus.IN_STOCK,
    attributeTemplate:
      "Тип:\nСерия:\nЦвет / покрытие:\nРазмер:\nМатериал:\nНагрузка:\nУгол открывания:\nКомплектация:",
  },
  wardrobe: {
    label: "Гардеробное наполнение",
    shortLabel: "Гардероб",
    panelTitle: "Гардеробное наполнение",
    formatLabel: "Модуль / формат продажи",
    formatPlaceholder: "секция 450 мм / комплект",
    helper:
      "Для корзин, лифтов, выдвижных систем и систем хранения важны размеры секции и комплектация.",
    recommendedOrderMode: ProductOrderMode.CART,
    recommendedInventoryStatus: InventoryStatus.IN_STOCK,
    attributeTemplate:
      "Тип системы:\nШирина секции:\nВысота:\nГлубина:\nЦвет:\nМатериал:\nНагрузка:\nКомплектация:",
  },
  kitchen: {
    label: "Кухонные системы",
    shortLabel: "Кухня",
    panelTitle: "Кухонные системы",
    formatLabel: "Модуль кухни",
    formatPlaceholder: "корпус 600 мм / левый",
    helper:
      "Для сушки, карго, бутылочниц и угловых механизмов фиксируем модуль, сторону и комплектацию.",
    recommendedOrderMode: ProductOrderMode.CART,
    recommendedInventoryStatus: InventoryStatus.IN_STOCK,
    attributeTemplate:
      "Тип:\nШирина корпуса:\nВысота:\nГлубина:\nСторона открывания:\nЦвет:\nМатериал:\nКомплектация:",
  },
  other: {
    label: "Другое",
    shortLabel: "Другое",
    panelTitle: "Параметры товара",
    formatLabel: "Формат продажи",
    formatPlaceholder: "шт / комплект / под заказ",
    helper:
      "Универсальная карточка для позиций, которые не относятся к плитам или фурнитуре.",
    recommendedOrderMode: ProductOrderMode.REQUEST_PRICE,
    recommendedInventoryStatus: InventoryStatus.ON_REQUEST,
    attributeTemplate: "Тип:\nРазмер:\nЦвет:\nМатериал:\nКомплектация:",
  },
};

const productTemplateOptions: ProductTemplateId[] = [
  "plate",
  "fittings",
  "wardrobe",
  "kitchen",
  "other",
];

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  kind: CategoryKind;
};
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
  compact?: boolean;
};

function FieldHint({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs leading-5 text-[var(--muted)]">{children}</span>
  );
}

function CompactPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[18px] border border-[color:var(--line)] bg-white/74 p-3.5 sm:p-4",
        className,
      )}
    >
      <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
        {title}
      </p>
      {children}
    </section>
  );
}

function CompactDetails({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-3.5 open:bg-white/86 sm:p-4">
      <summary className="cursor-pointer list-none">
        <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
            {title}
          </span>
          {summary ? (
            <span className="text-xs leading-5 text-[var(--muted)]">
              {summary}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="mt-4 grid gap-3 border-t border-[color:var(--line)] pt-4">
        {children}
      </div>
    </details>
  );
}

function FieldLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "grid min-w-0 gap-1.5 text-xs font-medium text-[var(--foreground)]",
        className,
      )}
    >
      {children}
    </label>
  );
}

function normalizeTemplateLookup(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferProductTemplate(category?: CategoryOption): ProductTemplateId {
  if (!category) {
    return "other";
  }

  const lookup = normalizeTemplateLookup(`${category.name} ${category.slug}`);

  if (
    lookup.includes("гардероб") ||
    lookup.includes("шкаф") ||
    lookup.includes("хранен")
  ) {
    return "wardrobe";
  }

  if (
    lookup.includes("кух") ||
    lookup.includes("карго") ||
    lookup.includes("бутылоч") ||
    lookup.includes("сушк")
  ) {
    return "kitchen";
  }

  if (category.kind === CategoryKind.PLATE) {
    return "plate";
  }

  if (category.kind === CategoryKind.FITTINGS) {
    return "fittings";
  }

  return "other";
}

export function NewProductForm({
  categories,
  brands,
  calculatorMaterials,
  calculatorSheetFormats,
  canUploadImages,
  defaults,
  compact = false,
}: Props) {
  const isEdit = Boolean(defaults);
  const [name, setName] = useState(defaults?.name ?? "");
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");
  const [brandId, setBrandId] = useState(defaults?.brandId ?? "");
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedBrand = brands.find((item) => item.id === brandId);
  const [productTemplate, setProductTemplate] = useState<ProductTemplateId>(
    inferProductTemplate(selectedCategory),
  );
  const [orderMode, setOrderMode] = useState<ProductOrderMode>(
    defaults?.orderMode ?? ProductOrderMode.REQUEST_PRICE,
  );
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus>(
    defaults?.inventoryStatus ?? InventoryStatus.ON_REQUEST,
  );
  const [attributesText, setAttributesText] = useState(
    defaults?.attributesText ?? "",
  );
  const selectedTemplate = productTemplateConfigs[productTemplate];
  const productIdentity = [selectedBrand?.name, selectedCategory?.name, name]
    .filter(Boolean)
    .join(" ");
  const showPlateFields = productTemplate === "plate";
  const inputClassName = compact ? "h-9 px-3 text-[13px] sm:h-9" : "h-10";
  const quickGridClassName = compact
    ? "grid gap-2.5 md:grid-cols-2 xl:grid-cols-12"
    : "grid gap-3 md:grid-cols-2 xl:grid-cols-12";
  const plateGridClassName = compact
    ? "grid gap-2.5 md:grid-cols-2 xl:grid-cols-4"
    : "grid gap-3 md:grid-cols-2 xl:grid-cols-4";
  const detailsGridClassName = compact
    ? "grid gap-2.5 sm:grid-cols-2"
    : "grid gap-3 lg:grid-cols-2";

  function applyProductTemplate(nextTemplate: ProductTemplateId) {
    const config = productTemplateConfigs[nextTemplate];

    setProductTemplate(nextTemplate);
    setOrderMode(config.recommendedOrderMode);
    setInventoryStatus(config.recommendedInventoryStatus);
  }

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);

    const nextCategory = categories.find((item) => item.id === nextCategoryId);
    const nextTemplate = inferProductTemplate(nextCategory);
    setProductTemplate(nextTemplate);

    if (!isEdit) {
      const config = productTemplateConfigs[nextTemplate];
      setOrderMode(config.recommendedOrderMode);
      setInventoryStatus(config.recommendedInventoryStatus);
    }
  }

  function insertAttributeTemplate() {
    setAttributesText((current) => {
      const template = selectedTemplate.attributeTemplate;

      if (!current.trim()) {
        return template;
      }

      return `${current.trim()}\n${template}`;
    });
  }

  return (
    <form
      action={isEdit ? updateProductDetailsAction : createProductAction}
      encType="multipart/form-data"
      className={cn("grid min-w-0 gap-3", compact ? "mt-3" : "mt-4")}
    >
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <CompactPanel title="Быстрое заполнение">
        <div className={quickGridClassName}>
          <FieldLabel className="md:col-span-2 xl:col-span-4">
            Название
            <Input
              name="name"
              placeholder="Extravert Дуб Уральский"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className={inputClassName}
            />
          </FieldLabel>

          <FieldLabel className="xl:col-span-4">
            Категория
            <Select
              name="categoryId"
              required
              value={categoryId}
              onChange={(event) => handleCategoryChange(event.target.value)}
              className={inputClassName}
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
          </FieldLabel>

          <FieldLabel className="xl:col-span-4">
            Тип карточки
            <Select
              name="productTemplate"
              value={productTemplate}
              onChange={(event) =>
                applyProductTemplate(event.target.value as ProductTemplateId)
              }
              className={inputClassName}
            >
              {productTemplateOptions.map((templateId) => (
                <option key={templateId} value={templateId}>
                  {productTemplateConfigs[templateId].label}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel className="xl:col-span-3">
            Бренд
            <Select
              name="brandId"
              value={brandId}
              onChange={(event) => setBrandId(event.target.value)}
              className={inputClassName}
            >
              <option value="">Без бренда</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <div
            className={
              compact ? "md:col-span-2 xl:col-span-3" : "xl:col-span-3"
            }
          >
            <GeneratedSkuInput
              defaultValue={defaults?.sku}
              compact={compact}
              hideHelp
              inputClassName={inputClassName}
              sourceValue={productIdentity || name}
            />
          </div>

          <FieldLabel className="xl:col-span-2">
            Цена, сом
            <Input
              name="price"
              type="number"
              min="0"
              placeholder="0"
              defaultValue={defaults?.price ?? ""}
              className={inputClassName}
            />
          </FieldLabel>

          <FieldLabel className="xl:col-span-2">
            Остаток
            <Input
              name="stockQuantity"
              type="number"
              min="0"
              placeholder="0"
              defaultValue={defaults?.stockQuantity ?? ""}
              className={inputClassName}
            />
          </FieldLabel>

          <FieldLabel className="xl:col-span-2">
            Статус
            <Select
              name="status"
              defaultValue={defaults?.status ?? ProductStatus.DRAFT}
              className={inputClassName}
            >
              {Object.values(ProductStatus).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel className="xl:col-span-3">
            Как продавать
            <Select
              name="orderMode"
              value={orderMode}
              onChange={(event) =>
                setOrderMode(event.target.value as ProductOrderMode)
              }
              className={inputClassName}
            >
              {Object.values(ProductOrderMode).map((mode) => (
                <option key={mode} value={mode}>
                  {orderModeLabels[mode]}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel className="xl:col-span-3">
            Наличие
            <Select
              name="inventoryStatus"
              value={inventoryStatus}
              onChange={(event) =>
                setInventoryStatus(event.target.value as InventoryStatus)
              }
              className={inputClassName}
            >
              {Object.values(InventoryStatus).map((status) => (
                <option key={status} value={status}>
                  {inventoryLabels[status]}
                </option>
              ))}
            </Select>
          </FieldLabel>
        </div>
      </CompactPanel>

      <CompactPanel title={selectedTemplate.panelTitle}>
        <div className={plateGridClassName}>
          <FieldLabel>
            {selectedTemplate.formatLabel}
            <Input
              name="format"
              placeholder={selectedTemplate.formatPlaceholder}
              defaultValue={defaults?.format ?? ""}
              className={inputClassName}
            />
          </FieldLabel>

          {showPlateFields ? (
            <FieldLabel>
              Толщина
              <Select
                name="thicknessMm"
                defaultValue={defaults?.thicknessMm?.toString() ?? ""}
                className={inputClassName}
              >
                <option value="">Не указана</option>
                {THICKNESS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} мм
                  </option>
                ))}
              </Select>
            </FieldLabel>
          ) : null}

          {showPlateFields ? (
            <FieldLabel>
              Материал расчета
              <Select
                name="calculatorMaterialId"
                defaultValue={defaults?.calculatorMaterialId ?? ""}
                className={inputClassName}
              >
                <option value="">Авто / не задан</option>
                {calculatorMaterials.map((material) => (
                  <option key={material.slug} value={material.slug}>
                    {material.label}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          ) : null}

          {showPlateFields ? (
            <FieldLabel>
              Формат калькулятора
              <Select
                name="calculatorSheetPresetId"
                defaultValue={defaults?.calculatorSheetPresetId ?? ""}
                className={inputClassName}
              >
                <option value="">Авто / не задан</option>
                {calculatorSheetFormats.map((format) => (
                  <option key={format.slug} value={format.slug}>
                    {format.label}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          ) : null}

          <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-3 text-xs leading-5 text-[var(--muted)] xl:col-span-4">
            <span className="font-semibold text-[var(--foreground)]">
              {selectedTemplate.shortLabel}:
            </span>{" "}
            {selectedTemplate.helper}
          </div>
        </div>
      </CompactPanel>

      <CompactDetails
        title="Дополнительно"
        summary="адрес, старая цена, подборки"
      >
        <div className={compact ? "grid gap-2.5" : "grid gap-3 lg:grid-cols-3"}>
          <GeneratedSlugInput
            basePath="/product/"
            defaultValue={defaults?.slug}
            compact={compact}
            placeholder="extravert-dub-uralskiy"
            sourceValue={productIdentity || name}
          />

          <FieldLabel>
            Старая цена, сом
            <Input
              name="compareAtPrice"
              type="number"
              min="0"
              placeholder="0"
              defaultValue={defaults?.compareAtPrice ?? ""}
              className={inputClassName}
            />
          </FieldLabel>

          <Checkbox
            name="isFeatured"
            defaultChecked={defaults?.isFeatured ?? false}
            label="Показывать в подборках"
            description="Для главной, брендов и ручных витрин."
            className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] px-3 py-3"
          />
        </div>
      </CompactDetails>

      <CompactDetails title="Фото и описание" summary="можно заполнить позже">
        <div className={detailsGridClassName}>
          <FieldLabel>
            Фото товара
            <Input
              name="imageFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              disabled={!canUploadImages}
              className={inputClassName}
            />
            <FieldHint>
              {canUploadImages
                ? "PNG, JPG, WEBP или AVIF до 8 МБ."
                : "Загрузка файлов включится после подключения Vercel Blob."}
            </FieldHint>
          </FieldLabel>

          <FieldLabel>
            Ссылка на изображение
            <Input
              name="imageUrl"
              type="url"
              placeholder="https://..."
              defaultValue={defaults?.imageUrl ?? ""}
              className={inputClassName}
            />
          </FieldLabel>
        </div>

        <div className={detailsGridClassName}>
          <FieldLabel>
            Короткое описание
            <Textarea
              name="summary"
              rows={3}
              placeholder="Кратко для карточки и каталога."
              defaultValue={defaults?.summary ?? ""}
            />
          </FieldLabel>

          <FieldLabel>
            Полное описание
            <Textarea
              name="description"
              rows={3}
              placeholder="Особенности, применение, примечания."
              defaultValue={defaults?.description ?? ""}
            />
          </FieldLabel>
        </div>

        <div className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Характеристики</span>
            <button
              type="button"
              onClick={insertAttributeTemplate}
              className="inline-flex h-8 items-center justify-center rounded-full border border-[color:var(--line)] px-3 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase transition hover:border-[color:var(--foreground)] hover:text-[var(--foreground)]"
            >
              Шаблон: {selectedTemplate.shortLabel}
            </button>
          </div>
          <Textarea
            name="attributes"
            rows={5}
            placeholder={selectedTemplate.attributeTemplate}
            value={attributesText}
            onChange={(event) => setAttributesText(event.target.value)}
          />
          <FieldHint>
            Одна строка = одна характеристика. Формат: “Название:
            значение”. Это удобно и для карточки товара, и для будущего Excel.
          </FieldHint>
        </div>
      </CompactDetails>

      <CompactDetails title="SEO" summary="обычно можно не заполнять">
        <div className={detailsGridClassName}>
          <FieldLabel>
            SEO title
            <Input
              name="seoTitle"
              placeholder="Заголовок для поиска"
              defaultValue={defaults?.seoTitle ?? ""}
              className={inputClassName}
            />
          </FieldLabel>

          <FieldLabel>
            SEO description
            <Input
              name="seoDescription"
              placeholder="Краткое описание для поиска"
              defaultValue={defaults?.seoDescription ?? ""}
              className={inputClassName}
            />
          </FieldLabel>
        </div>
      </CompactDetails>

      <div
        className={cn(
          "z-10 flex flex-col gap-2 rounded-[18px] border border-[color:var(--line)] bg-[rgba(250,248,244,0.94)] p-3 shadow-[0_18px_45px_rgba(27,24,20,0.12)] backdrop-blur md:flex-row md:items-center md:justify-between",
          compact ? "static" : "sticky bottom-3",
        )}
      >
        {compact ? null : (
          <p className="text-xs leading-5 text-[var(--muted)]">
            {isEdit
              ? "Сохраните изменения, чтобы обновить карточку."
              : "Новый товар создастся в рабочем списке. По умолчанию удобно оставлять черновиком."}
          </p>
        )}
        <AdminSubmitButton
          type="submit"
          variant="accent"
          idleLabel={isEdit ? "Сохранить товар" : "Создать товар"}
          pendingLabel="Сохраняем..."
          className={cn("h-10 w-full", compact ? "" : "md:w-auto")}
        />
      </div>
    </form>
  );
}
