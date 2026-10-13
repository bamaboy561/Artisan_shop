"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

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

type CategoryOption = { id: string; name: string; kind: CategoryKind };
type BrandOption = { id: string; name: string };
type SlugLabelOption = { slug: string; label: string };
type BundleProductOption = {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  stockQuantity: number | null;
  brandName: string;
  categoryName: string;
};

export type ProductBundleFormItem = {
  componentProductId: string;
  quantity: number;
};

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
  edgeThicknessMm: number | null;
  edgeWidthMm: number | null;
  imageUrls: string[];
  calculatorMaterialId: string | null;
  calculatorSheetPresetId: string | null;
  summary: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  attributesText: string;
  isBundleProduct: boolean;
  bundleItems: ProductBundleFormItem[];
  isFeatured: boolean;
};

type Props = {
  categories: CategoryOption[];
  brands: BrandOption[];
  calculatorMaterials: SlugLabelOption[];
  calculatorSheetFormats: SlugLabelOption[];
  bundleProductOptions: BundleProductOption[];
  canUploadImages: boolean;
  defaults?: ProductFormDefaults;
  // Начальные значения для нового товара из списка «Нет на сайте».
  prefill?: ProductFormPrefill;
  compact?: boolean;
};

export type ProductFormPrefill = {
  pendingItemId: string;
  name: string;
  sku: string | null;
  stockQuantity: number | null;
  inventoryStatus: InventoryStatus | null;
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
      <p className="mb-3 text-xs font-medium text-[var(--accent)]">{title}</p>
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
          <span className="text-xs font-medium text-[var(--accent)]">
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

function formatBundlePrice(value: number | null) {
  if (typeof value !== "number") {
    return "цена не указана";
  }

  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value)} сом`;
}

function parseSheetDimensions(format: string | null | undefined) {
  const match = (format ?? "").match(/(\d{3,4})\s*(?:x|х|×|\*)\s*(\d{3,4})/iu);

  if (!match) {
    return null;
  }

  return {
    length: match[1],
    width: match[2],
  };
}

function getSheetPresetIdFromDimensions(
  dimensions: ReturnType<typeof parseSheetDimensions>,
) {
  if (!dimensions) {
    return "";
  }

  return `${dimensions.length}x${dimensions.width}`;
}

function buildSheetFormatLabel(length: string, width: string) {
  if (!length || !width) {
    return "";
  }

  return `${length} × ${width} мм`;
}

function buildSheetFormat(length: string, width: string) {
  const normalizedLength = length.trim();
  const normalizedWidth = width.trim();

  if (!normalizedLength || !normalizedWidth) {
    return "";
  }

  return buildSheetFormatLabel(normalizedLength, normalizedWidth);
}

const productImageUploadUrl = "/api/admin/product-images/upload";
const largeImageMultipartThresholdBytes = 100 * 1024 * 1024;
const clientProductImageTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function sanitizeClientUploadSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getSafeClientUploadFileName(file: File, index: number) {
  const extensionMatch = file.name.match(/\.(avif|jpe?g|png|webp)$/i);
  const extension = extensionMatch?.[0].toLowerCase() ?? ".jpg";
  const baseName = file.name.replace(/\.[^.]*$/, "");
  const safeBaseName =
    sanitizeClientUploadSegment(baseName) || `image-${index + 1}`;

  return `${safeBaseName}${extension}`;
}

function isClientProductImage(file: File) {
  return (
    clientProductImageTypes.has(file.type) ||
    /\.(avif|jpe?g|png|webp)$/i.test(file.name)
  );
}

function clearClientUploadedImageInputs(form: HTMLFormElement) {
  form
    .querySelectorAll<HTMLInputElement>(
      'input[data-client-upload="product-image"]',
    )
    .forEach((input) => input.remove());
}

function BundleCatalogPicker({
  products,
  defaults = [],
  isBundle = false,
  currentProductId,
}: {
  products: BundleProductOption[];
  defaults?: ProductBundleFormItem[];
  isBundle?: boolean;
  currentProductId?: string;
}) {
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState(isBundle || defaults.length > 0);
  const [items, setItems] = useState<ProductBundleFormItem[]>(defaults);
  const selectedIds = new Set(items.map((item) => item.componentProductId));
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const selectedProducts = items
    .map((item) => ({
      item,
      product: products.find(
        (product) => product.id === item.componentProductId,
      ),
    }))
    .filter(
      (
        entry,
      ): entry is {
        item: ProductBundleFormItem;
        product: BundleProductOption;
      } => Boolean(entry.product),
    );
  const results = products
    .filter((product) => product.id !== currentProductId)
    .filter((product) => !selectedIds.has(product.id))
    .filter((product) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        product.name,
        product.sku,
        product.brandName,
        product.categoryName,
      ]
        .join(" ")
        .toLocaleLowerCase("ru-RU")
        .includes(normalizedQuery);
    })
    .slice(0, 10);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const componentSubtotal = selectedProducts.reduce(
    (sum, entry) => sum + (entry.product.price ?? 0) * entry.item.quantity,
    0,
  );

  function getProduct(productId: string) {
    return products.find((product) => product.id === productId);
  }

  function addProduct(productId: string) {
    if (selectedIds.has(productId) || productId === currentProductId) {
      return;
    }

    setItems((current) => [
      ...current,
      { componentProductId: productId, quantity: 1 },
    ]);
    setQuery("");
  }

  function updateQuantity(productId: string, quantity: number) {
    setItems((current) =>
      current.map((item) =>
        item.componentProductId === productId
          ? { ...item, quantity: Math.max(1, Math.min(999, quantity || 1)) }
          : item,
      ),
    );
  }

  function removeProduct(productId: string) {
    setItems((current) =>
      current.filter((item) => item.componentProductId !== productId),
    );
  }

  return (
    <div className="grid gap-4">
      <input type="hidden" name="isBundleProduct" value={enabled ? "on" : ""} />

      <div className="grid gap-2 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setEnabled(false)}
          className={cn(
            "grid gap-1 rounded-2xl border p-4 text-left transition",
            !enabled
              ? "border-[#111] bg-[#111] text-white shadow-[0_16px_36px_rgba(17,17,17,0.16)]"
              : "border-[color:var(--line)] bg-white text-[var(--foreground)] hover:border-[#c4532b]",
          )}
        >
          <span className="text-sm font-semibold">Обычный товар</span>
          <span
            className={cn(
              "text-xs leading-5",
              !enabled ? "text-white/72" : "text-[var(--muted)]",
            )}
          >
            Продаётся как одна позиция без внутреннего состава.
          </span>
        </button>

        <button
          type="button"
          onClick={() => setEnabled(true)}
          className={cn(
            "grid gap-1 rounded-2xl border p-4 text-left transition",
            enabled
              ? "border-[#111] bg-[#111] text-white shadow-[0_16px_36px_rgba(17,17,17,0.16)]"
              : "border-[color:var(--line)] bg-white text-[var(--foreground)] hover:border-[#c4532b]",
          )}
        >
          <span className="text-sm font-semibold">Комплект из каталога</span>
          <span
            className={cn(
              "text-xs leading-5",
              enabled ? "text-white/72" : "text-[var(--muted)]",
            )}
          >
            Карточка продаётся одной ценой, состав выбирается из товаров ниже.
          </span>
        </button>
      </div>

      {!enabled ? (
        <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-4 text-sm leading-6 text-[var(--muted)]">
          Сценарий комплекта выключен. Если это петля, направляющая, ручка,
          столешница или любой самостоятельный товар, оставьте режим «Обычный
          товар».
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid content-start gap-3">
            <div className="rounded-2xl border border-[color:var(--line)] bg-[#faf8f4] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Как работает комплект
              </p>
              <div className="mt-2 grid gap-2 text-xs leading-5 text-[var(--muted)]">
                <p>
                  1. Создайте карточку комплекта. Если поле «Цена» пустое, сайт
                  сам посчитает сумму из состава.
                </p>
                <p>
                  2. Ниже добавьте реальные товары из каталога и количество.
                </p>
                <p>
                  3. Клиент увидит один товар, а менеджер увидит полный состав.
                </p>
              </div>
            </div>

            <FieldLabel>
              Найти товар для состава
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Название, артикул, бренд или категория"
                className="h-10"
              />
            </FieldLabel>

            <div className="max-h-[22rem] overflow-y-auto rounded-2xl border border-[color:var(--line)] bg-white">
              {results.length > 0 ? (
                results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product.id)}
                    className="grid w-full gap-2 border-b border-[color:var(--line)] px-3 py-3 text-left transition last:border-b-0 hover:bg-[#f8f5ef]"
                  >
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {product.name}
                    </span>
                    <span className="text-xs leading-5 [overflow-wrap:anywhere] text-[var(--muted)]">
                      {[product.brandName, product.sku, product.categoryName]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-[#f1eee8] px-2.5 py-1 text-[var(--foreground)]">
                        {formatBundlePrice(product.price)}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[var(--muted)] ring-1 ring-[color:var(--line)]">
                        Остаток: {product.stockQuantity ?? 0} шт.
                      </span>
                      <span className="ml-auto text-xs font-medium text-[var(--accent)]">
                        Добавить
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-4 text-sm leading-6 text-[var(--muted)]">
                  Товар не найден. Проверьте название, артикул или бренд.
                </div>
              )}
            </div>
          </div>

          <div className="grid content-start gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-[color:var(--line)] bg-white p-3">
                <p className="text-xs font-medium text-[var(--muted)]">
                  Позиций
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                  {items.length}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-white p-3">
                <p className="text-xs font-medium text-[var(--muted)]">
                  Кол-во
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                  {totalQuantity}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-white p-3">
                <p className="text-xs font-medium text-[var(--muted)]">
                  Компоненты
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                  {formatBundlePrice(componentSubtotal)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--line)] bg-[#f8f5ef] p-3 text-xs leading-5 text-[var(--muted)]">
              Сумма компонентов теперь используется как цена комплекта для
              клиента, если отдельная цена в поле «Цена» выше не указана.
            </div>

            {items.length > 0 ? (
              <div className="grid gap-2">
                {items.map((item, index) => {
                  const product = getProduct(item.componentProductId);
                  const lineTotal =
                    typeof product?.price === "number"
                      ? product.price * item.quantity
                      : null;

                  return (
                    <div
                      key={`${item.componentProductId}-${index}`}
                      className="grid gap-3 rounded-2xl border border-[color:var(--line)] bg-white p-3 lg:grid-cols-[minmax(0,1fr)_116px_116px_auto] lg:items-center"
                    >
                      <input
                        type="hidden"
                        name="bundleProductId"
                        value={item.componentProductId}
                      />
                      <div className="min-w-0">
                        <p className="text-sm leading-5 font-semibold [overflow-wrap:anywhere] text-[var(--foreground)]">
                          {product?.name ?? "Товар из каталога"}
                        </p>
                        <p className="mt-1 text-xs leading-5 [overflow-wrap:anywhere] text-[var(--muted)]">
                          {[
                            product?.brandName,
                            product?.sku,
                            product?.categoryName,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <FieldLabel>
                        Кол-во
                        <Input
                          name="bundleQuantity"
                          type="number"
                          min="1"
                          max="999"
                          value={item.quantity}
                          onChange={(event) =>
                            updateQuantity(
                              item.componentProductId,
                              Number.parseInt(event.target.value, 10),
                            )
                          }
                          className="h-9"
                        />
                      </FieldLabel>
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)]">
                          Сумма
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {formatBundlePrice(lineTotal)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProduct(item.componentProductId)}
                        className="h-9 border border-[color:var(--line)] px-3 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                      >
                        Убрать
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-white/70 p-5 text-sm leading-6 text-[var(--muted)]">
                Добавьте товары слева: петли, планки, крепёж, направляющие,
                опоры или любые позиции из каталога. Ничего вручную прописывать
                не нужно.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NewProductForm({
  categories,
  brands,
  calculatorMaterials,
  calculatorSheetFormats,
  bundleProductOptions,
  canUploadImages,
  defaults,
  prefill,
  compact = false,
}: Props) {
  const isEdit = Boolean(defaults);
  const allowServerSubmitRef = useRef(false);
  const isUploadingImagesRef = useRef(false);
  const [name, setName] = useState(defaults?.name ?? prefill?.name ?? "");
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");
  const [brandId, setBrandId] = useState(defaults?.brandId ?? "");
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [clientUploadStatus, setClientUploadStatus] = useState<string | null>(
    null,
  );
  const defaultSheetDimensions = parseSheetDimensions(defaults?.format);
  const defaultSheetPresetId = getSheetPresetIdFromDimensions(
    defaultSheetDimensions,
  );
  const [sheetLengthMm, setSheetLengthMm] = useState(
    defaultSheetDimensions?.length ?? "",
  );
  const [sheetWidthMm, setSheetWidthMm] = useState(
    defaultSheetDimensions?.width ?? "",
  );
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedBrand = brands.find((item) => item.id === brandId);
  const productIdentity = [selectedBrand?.name, selectedCategory?.name, name]
    .filter(Boolean)
    .join(" ");
  const isFittings = selectedCategory?.kind === CategoryKind.FITTINGS;
  const showPlateFields = !isFittings;
  const inputClassName = compact ? "h-9 px-3 text-[13px] sm:h-9" : "h-10";
  const quickGridClassName = compact
    ? "grid gap-2.5 md:grid-cols-2 xl:grid-cols-12"
    : "grid gap-3 lg:grid-cols-12";
  const plateGridClassName = compact
    ? "grid gap-2.5 md:grid-cols-2 xl:grid-cols-4"
    : "grid gap-3 md:grid-cols-2 xl:grid-cols-4";
  const detailsGridClassName = compact
    ? "grid gap-2.5 sm:grid-cols-2"
    : "grid gap-3 lg:grid-cols-2";
  // Формат, записанный не как «длина x ширина», не должен пропадать при
  // сохранении: оставляем его, пока менеджер не введёт размеры листа.
  const sheetFormatValue =
    buildSheetFormat(sheetLengthMm, sheetWidthMm) ||
    (defaultSheetDimensions ? "" : (defaults?.format ?? ""));
  const calculatorSheetOptions = [...calculatorSheetFormats];
  if (
    defaultSheetPresetId &&
    !calculatorSheetOptions.some(
      (format) => format.slug === defaultSheetPresetId,
    )
  ) {
    calculatorSheetOptions.unshift({
      slug: defaultSheetPresetId,
      label: `${buildSheetFormatLabel(
        defaultSheetDimensions?.length ?? "",
        defaultSheetDimensions?.width ?? "",
      )} · из карточки товара`,
    });
  }
  const calculatorSheetDefaultValue =
    defaults?.calculatorSheetPresetId ?? defaultSheetPresetId;
  const [imageUrlFields, setImageUrlFields] = useState(() =>
    defaults?.imageUrls.length ? defaults.imageUrls : [""],
  );
  const updateImageUrlField = (index: number, value: string) => {
    setImageUrlFields((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };
  const addImageUrlField = () => {
    setImageUrlFields((current) => [...current, ""]);
  };
  const removeImageUrlField = (index: number) => {
    setImageUrlFields((current) =>
      current.length > 1
        ? current.filter((_, itemIndex) => itemIndex !== index)
        : current,
    );
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (allowServerSubmitRef.current || !canUploadImages) {
      return;
    }

    const form = event.currentTarget;
    const imageFileField = form.elements.namedItem("imageFiles");
    const imageFileInput =
      imageFileField instanceof HTMLInputElement ? imageFileField : null;
    const files = Array.from(imageFileInput?.files ?? []).filter(
      (file) => file.size > 0,
    );

    if (files.length === 0) {
      return;
    }

    event.preventDefault();

    if (isUploadingImagesRef.current) {
      return;
    }

    isUploadingImagesRef.current = true;
    setIsUploadingImages(true);
    setClientUploadStatus(`Загружаю фото: 0 из ${files.length}`);

    try {
      const invalidFile = files.find((file) => !isClientProductImage(file));

      if (invalidFile) {
        throw new Error(
          `Файл "${invalidFile.name}" не подходит. Используйте PNG, JPG, WEBP или AVIF.`,
        );
      }

      const productSegment =
        sanitizeClientUploadSegment(
          defaults?.slug ?? productIdentity ?? name,
        ) || "product";
      const uploadedUrls: string[] = [];

      for (const [index, file] of files.entries()) {
        const safeFileName = getSafeClientUploadFileName(file, index);
        const pathname = `products/${productSegment}/${Date.now()}-${index + 1}-${safeFileName}`;

        const blob = await upload(pathname, file, {
          access: "public",
          contentType: file.type || undefined,
          handleUploadUrl: productImageUploadUrl,
          multipart: file.size > largeImageMultipartThresholdBytes,
          onUploadProgress: (progress) => {
            setClientUploadStatus(
              `Загружаю фото ${index + 1} из ${files.length}: ${progress.percentage}%`,
            );
          },
        });

        uploadedUrls.push(blob.url);
        setClientUploadStatus(
          `Загружено фото: ${uploadedUrls.length} из ${files.length}`,
        );
      }

      clearClientUploadedImageInputs(form);

      for (const imageUrl of uploadedUrls) {
        const hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.name = "imageUrl";
        hiddenInput.value = imageUrl;
        hiddenInput.dataset.clientUpload = "product-image";
        form.appendChild(hiddenInput);
      }

      if (imageFileInput) {
        imageFileInput.value = "";
      }

      allowServerSubmitRef.current = true;
      setClientUploadStatus("Фото загружены. Сохраняю товар...");
      form.requestSubmit();
    } catch (error) {
      console.error(error);
      isUploadingImagesRef.current = false;
      setIsUploadingImages(false);
      setClientUploadStatus(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить фото. Попробуйте ещё раз.",
      );
    }
  }

  return (
    <form
      action={isEdit ? updateProductDetailsAction : createProductAction}
      encType="multipart/form-data"
      onSubmit={handleSubmit}
      className={cn("grid min-w-0 gap-3", compact ? "mt-3" : "mt-4")}
    >
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {!defaults && prefill ? (
        <input
          type="hidden"
          name="pendingItemId"
          value={prefill.pendingItemId}
        />
      ) : null}

      <CompactPanel title="Быстрое заполнение">
        <div className={quickGridClassName}>
          <FieldLabel
            className={
              compact ? "md:col-span-2 xl:col-span-4" : "lg:col-span-4"
            }
          >
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

          <FieldLabel className={compact ? "xl:col-span-3" : "lg:col-span-3"}>
            Категория
            <Select
              name="categoryId"
              required
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
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

          <FieldLabel className={compact ? "xl:col-span-3" : "lg:col-span-3"}>
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
              compact ? "md:col-span-2 xl:col-span-2" : "lg:col-span-2"
            }
          >
            <GeneratedSkuInput
              defaultValue={defaults?.sku ?? prefill?.sku ?? undefined}
              compact={compact}
              hideHelp={compact}
              sourceValue={productIdentity || name}
            />
          </div>

          <FieldLabel className={compact ? "xl:col-span-2" : "lg:col-span-2"}>
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

          <FieldLabel className={compact ? "xl:col-span-2" : "lg:col-span-2"}>
            Остаток
            {isEdit ? (
              <input
                type="hidden"
                name="stockQuantityInitial"
                value={defaults?.stockQuantity ?? ""}
              />
            ) : null}
            <Input
              name="stockQuantity"
              type="number"
              min="0"
              placeholder="0"
              defaultValue={
                defaults?.stockQuantity ?? prefill?.stockQuantity ?? ""
              }
              className={inputClassName}
            />
          </FieldLabel>

          <FieldLabel className={compact ? "xl:col-span-2" : "lg:col-span-2"}>
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

          <FieldLabel className={compact ? "xl:col-span-3" : "lg:col-span-3"}>
            Сценарий
            <Select
              name="orderMode"
              defaultValue={
                defaults?.orderMode ?? ProductOrderMode.REQUEST_PRICE
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

          <FieldLabel className={compact ? "xl:col-span-3" : "lg:col-span-3"}>
            Наличие
            <Select
              name="inventoryStatus"
              defaultValue={
                defaults?.inventoryStatus ??
                prefill?.inventoryStatus ??
                InventoryStatus.ON_REQUEST
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

      <CompactPanel title="Сборка комплекта">
        <BundleCatalogPicker
          products={bundleProductOptions}
          defaults={defaults?.bundleItems ?? []}
          isBundle={defaults?.isBundleProduct ?? false}
          currentProductId={defaults?.id}
        />
      </CompactPanel>

      {showPlateFields ? (
        <CompactPanel title="Плитный материал">
          <div className={plateGridClassName}>
            <input type="hidden" name="format" value={sheetFormatValue} />

            <FieldLabel>
              Длина листа, мм
              <Input
                inputMode="numeric"
                placeholder="4100"
                value={sheetLengthMm}
                onChange={(event) => setSheetLengthMm(event.target.value)}
                className={inputClassName}
              />
            </FieldLabel>

            <FieldLabel>
              Ширина листа, мм
              <Input
                inputMode="numeric"
                placeholder="1200"
                value={sheetWidthMm}
                onChange={(event) => setSheetWidthMm(event.target.value)}
                className={inputClassName}
              />
            </FieldLabel>

            <FieldLabel>
              Толщина, мм
              <Input
                name="thicknessMm"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="38"
                defaultValue={defaults?.thicknessMm?.toString() ?? ""}
                className={inputClassName}
              />
            </FieldLabel>

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

            <FieldLabel>
              Формат калькулятора
              <Select
                name="calculatorSheetPresetId"
                defaultValue={calculatorSheetDefaultValue}
                className={inputClassName}
              >
                <option value="">Авто / не задан</option>
                {calculatorSheetOptions.map((format) => (
                  <option key={format.slug} value={format.slug}>
                    {format.label}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          </div>
        </CompactPanel>
      ) : null}

      {isFittings ? (
        <CompactPanel title="Размеры товара / кромки">
          <div className={plateGridClassName}>
            <FieldLabel>
              Толщина кромки, мм
              <Input
                name="edgeThicknessMm"
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                placeholder="0.8"
                defaultValue={defaults?.edgeThicknessMm?.toString() ?? ""}
                className={inputClassName}
              />
            </FieldLabel>

            <FieldLabel>
              Ширина кромки, мм
              <Input
                name="edgeWidthMm"
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                placeholder="22"
                defaultValue={defaults?.edgeWidthMm?.toString() ?? ""}
                className={inputClassName}
              />
            </FieldLabel>
          </div>
        </CompactPanel>
      ) : null}

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
        <div className="grid gap-3">
          <FieldLabel>
            Фото товара
            <Input
              name="imageFiles"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              multiple
              disabled={!canUploadImages}
              className={inputClassName}
            />
            <FieldHint>
              {canUploadImages
                ? "Можно выбрать сразу несколько PNG, JPG, WEBP или AVIF. Лимит 8 МБ и ограничение на 4 фото в карточке убраны."
                : "Загрузка файлов включится после подключения Vercel Blob."}
            </FieldHint>
            {clientUploadStatus ? (
              <span className="text-xs leading-5 font-medium text-[var(--accent)]">
                {clientUploadStatus}
              </span>
            ) : null}
          </FieldLabel>

          <div className="grid gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-[var(--accent)]">
                Ссылки на изображения
              </p>
              <button
                type="button"
                onClick={addImageUrlField}
                className="h-9 border border-[color:var(--line)] px-3 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-white"
              >
                Добавить ссылку
              </button>
            </div>
            <div className="grid gap-2">
              {imageUrlFields.map((imageUrl, index) => (
                <div
                  key={`product-image-url-${index}`}
                  className="flex min-w-0 flex-col gap-2 sm:flex-row"
                >
                  <Input
                    name="imageUrl"
                    type="url"
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(event) =>
                      updateImageUrlField(index, event.target.value)
                    }
                    className={cn(inputClassName, "min-w-0 flex-1")}
                  />
                  {imageUrlFields.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeImageUrlField(index)}
                      className="h-9 border border-[color:var(--line)] px-3 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                    >
                      Убрать
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <FieldHint>
              Первое изображение будет главным. Остальные попадут в галерею
              карточки товара.
            </FieldHint>
          </div>
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

        <FieldLabel>
          Характеристики
          <Textarea
            name="attributes"
            rows={4}
            placeholder={"Цвет: Кашемир\nПоверхность: Матовая\nТолщина: 16 мм"}
            defaultValue={defaults?.attributesText ?? ""}
          />
        </FieldLabel>
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
          disabled={isUploadingImages}
          idleLabel={isEdit ? "Сохранить товар" : "Создать товар"}
          pendingLabel="Сохраняем..."
          className={cn("h-10 w-full", compact ? "" : "md:w-auto")}
        />
      </div>
    </form>
  );
}
