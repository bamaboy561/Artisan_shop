"use client";

import { useState } from "react";

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
  isFeatured: boolean;
};

type Props = {
  categories: CategoryOption[];
  brands: BrandOption[];
  calculatorMaterials: SlugLabelOption[];
  calculatorSheetFormats: SlugLabelOption[];
  defaults?: ProductFormDefaults;
};

export function NewProductForm({
  categories,
  brands,
  calculatorMaterials,
  calculatorSheetFormats,
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
      className="mt-5 grid min-w-0 gap-4 lg:grid-cols-12"
    >
      {defaults ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-4">
        Название
        <Input
          name="name"
          placeholder="Swiss Krono Кашемир"
          defaultValue={defaults?.name ?? ""}
          required
        />
      </label>

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
        Slug
        <Input
          name="slug"
          placeholder="swiss-krono-kashmir"
          defaultValue={defaults?.slug ?? ""}
          required
        />
      </label>

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
        SKU
        <Input
          name="sku"
          placeholder="SK-KASHMIR-16"
          defaultValue={defaults?.sku ?? ""}
          required
        />
      </label>

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-2">
        Цена, сом
        <Input
          name="price"
          type="number"
          min="0"
          placeholder="3150"
          defaultValue={defaults?.price ?? ""}
        />
      </label>

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
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

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
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

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-2">
        Статус
        <Select
          name="status"
          defaultValue={defaults?.status ?? ProductStatus.ACTIVE}
        >
          {Object.values(ProductStatus).map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </Select>
      </label>

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-2">
        Заказ
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

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-2">
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

      {showPlateFields ? (
        <>
          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
            Формат
            <Select name="format" defaultValue={defaults?.format ?? ""}>
              <option value="">Не указан</option>
              {calculatorSheetFormats.map((sheet) => (
                <option key={sheet.slug} value={sheet.label}>
                  {sheet.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-2">
            Толщина, мм
            <Select
              name="thicknessMm"
              defaultValue={defaults?.thicknessMm ?? ""}
            >
              <option value="">—</option>
              {THICKNESS_OPTIONS.map((thickness) => (
                <option key={thickness} value={thickness}>
                  {thickness} мм
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-3">
            Изображение
            <Input
              name="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              defaultValue={defaults?.imageUrl ?? ""}
            />
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-2">
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

          <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-2">
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
        </>
      ) : (
        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-12">
          Изображение
          <Input
            name="imageUrl"
            type="url"
            placeholder="https://example.com/image.jpg"
            defaultValue={defaults?.imageUrl ?? ""}
          />
        </label>
      )}

      <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-12">
        Краткое описание
        <Textarea
          name="summary"
          rows={3}
          placeholder="Короткое коммерческое описание для карточки товара."
          defaultValue={defaults?.summary ?? ""}
        />
      </label>

      {isEdit ? (
        <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)] lg:col-span-12">
          Полное описание
          <Textarea
            name="description"
            rows={5}
            placeholder="Подробное описание для страницы товара."
            defaultValue={defaults?.description ?? ""}
          />
        </label>
      ) : null}

      <div className="grid min-w-0 gap-3 lg:col-span-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <Checkbox
          name="isFeatured"
          value="on"
          defaultChecked={defaults?.isFeatured ?? false}
          label="Показывать в подборках"
          description="Для акцентных блоков витрины и внутренних подборок."
          className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-3"
        />

        <AdminSubmitButton
          type="submit"
          variant="accent"
          className="w-full sm:w-auto"
          idleLabel={isEdit ? "Сохранить изменения" : "Добавить товар"}
          pendingLabel={isEdit ? "Сохраняем..." : "Добавляем..."}
        />
      </div>
    </form>
  );
}
