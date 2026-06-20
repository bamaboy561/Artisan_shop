export type ProductBundleItem = {
  label: string;
};

type ProductAttributeLike = {
  name: string;
  value: string;
};

export const BUNDLE_MARKER_ATTRIBUTE_NAME = "Тип товара";
export const BUNDLE_MARKER_ATTRIBUTE_VALUE = "Комплект";
export const BUNDLE_ITEM_ATTRIBUTE_NAME = "Состав комплекта";

const markerNames = new Set(["тип товара", "комплект", "kit", "bundle"]);

const itemNames = new Set([
  "состав комплекта",
  "в комплекте",
  "комплектация",
  "комплект",
  "kit items",
  "bundle items",
]);

const truthyBundleValues = new Set([
  "да",
  "true",
  "1",
  "yes",
  "комплект",
  "kit",
  "bundle",
]);

function normalizeBundleText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitBundleItemValue(value: string) {
  return value
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isBundleMarkerAttribute(attribute: ProductAttributeLike) {
  const name = normalizeBundleText(attribute.name);
  const value = normalizeBundleText(attribute.value);

  return (
    (markerNames.has(name) && truthyBundleValues.has(value)) ||
    (name === "тип товара" && value.includes("комплект"))
  );
}

function isBundleItemAttribute(attribute: ProductAttributeLike) {
  const name = normalizeBundleText(attribute.name);
  const value = normalizeBundleText(attribute.value);

  if (!itemNames.has(name)) {
    return false;
  }

  return value.length > 0 && !truthyBundleValues.has(value);
}

export function isBundleAttributeName(name: string) {
  const normalized = normalizeBundleText(name);
  return markerNames.has(normalized) || itemNames.has(normalized);
}

export function parseBundleItemsText(value: string) {
  const seen = new Set<string>();

  return splitBundleItemValue(value).filter((line) => {
    const normalized = normalizeBundleText(line);
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

export function getProductBundleInfo(attributes: ProductAttributeLike[]) {
  const items = attributes
    .filter(isBundleItemAttribute)
    .flatMap((attribute) => parseBundleItemsText(attribute.value))
    .map((label) => ({ label }));

  return {
    isBundle: attributes.some(isBundleMarkerAttribute) || items.length > 0,
    items,
  };
}
