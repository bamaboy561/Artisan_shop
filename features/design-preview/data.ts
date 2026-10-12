import snapshot from "./products.json";

export type PreviewProductData = (typeof snapshot)[number];
export const products = snapshot;
export const previewRoot = "/design-preview";
export const liveRoot = "https://artisan.shop.kg";
export const productHref = (slug: string) => `${previewRoot}/product/${slug}`;
export const catalogHref = (params: Record<string, string> = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value),
  );
  return `${previewRoot}/catalog${query.size ? `?${query}` : ""}`;
};
export const priceLabel = (value: number) =>
  `${new Intl.NumberFormat("ru-RU").format(value)} сом`;
export const productCountLabel = (value: number) => {
  const form = new Intl.PluralRules("ru-RU").select(value);
  return `${value} ${form === "one" ? "товар" : form === "few" ? "товара" : "товаров"}`;
};
export const unitLabel = (product: PreviewProductData) =>
  ["mdf", "ldsp", "hpl-compact-plita"].includes(product.category)
    ? "лист"
    : "шт.";
export const maximumQuantity = (product: PreviewProductData) =>
  product.available ? Math.max(0, Math.min(product.stock ?? 999, 999)) : 0;

export const categories = [
  {
    slug: "mdf",
    name: "МДФ панели",
    subtitle: "Цвет и тактильность",
    image: products[0].gallery[0],
  },
  {
    slug: "ldsp",
    name: "ЛДСП",
    subtitle: "Основа вашего проекта",
    image: products[4].gallery[0],
  },
  {
    slug: "furnitura",
    name: "Фурнитура",
    subtitle: "Продумано до деталей",
    image: products[11].gallery[0],
  },
  {
    slug: "hpl-compact-plita",
    name: "HPL и поверхности",
    subtitle: "Выразительная фактура",
    image: products[9].gallery[0],
  },
  {
    slug: "organizaciya-kuhni",
    name: "Системы хранения",
    subtitle: "Порядок внутри",
    image: products[14].gallery[0],
  },
];

export const brands = [
  { slug: "agt", name: "AGT" },
  { slug: "albero", name: "Albero" },
  { slug: "swiss-krono", name: "Swiss Krono" },
  { slug: "hettich", name: "Hettich" },
  { slug: "slotex", name: "Slotex" },
  { slug: "nuomi", name: "Nuomi" },
  { slug: "italiana-ferramenta", name: "Italiana Ferramenta" },
  { slug: "extravert", name: "Extravert" },
  { slug: "samet", name: "Samet" },
  { slug: "titus", name: "Titus" },
  { slug: "emaks", name: "Emaks" },
];
