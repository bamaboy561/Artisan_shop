import assert from "node:assert/strict";
import test from "node:test";
import { buildStorefrontHref, getStorefrontCatalog, productThickness } from "../features/storefront/catalog-state";
import type { FeaturedProduct } from "../features/catalog/types";
import { isPremiumStorefront } from "../features/storefront/config";

const product = (overrides: Partial<FeaturedProduct> = {}): FeaturedProduct => ({
  slug: "panel", name: "МДФ панель", brand: "AGT", brandSlug: "agt", categorySlug: "mdf", categoryName: "МДФ",
  image: "/test.webp", gallery: ["/test.webp"], price: 100, sku: "11412030YQ-1234567890123", inStock: true,
  stockQuantity: 2, format: "2800 × 1220 × 18 мм", summary: "", description: "", action: "В корзину", purchaseMode: "cart",
  availabilityText: "В наличии", specifications: [], isBundle: false, bundleItems: [], searchText: "мдф панель agt 11412030yq 1234567890123",
  ...overrides,
});

test("search keeps long SKUs and normalization", () => {
  const result = getStorefrontCatalog([product()], { q: "11412030YQ-1234567890123" });
  assert.equal(result.pagination.totalItems, 1);
  assert.equal(result.pagination.items[0].sku, "11412030YQ-1234567890123");
});
test("thickness accepts decimal specifications and full sheet dimensions", () => {
  assert.equal(productThickness(product()), "18");
  assert.equal(productThickness(product({ specifications: [{ key: "Толщина, мм", value: "0,8" }] })), "0.8");
  assert.equal(productThickness(product({ format: "2800 × 2070 мм" })), "");
});
test("stock and thickness filters combine without losing brand facets", () => {
  const items = [product(), product({ slug: "out", inStock: false, brandSlug: "albero", brand: "Albero" }), product({ slug: "thin", format: "10 мм" })];
  const result = getStorefrontCatalog(items, { available: "1", thickness: "18" });
  assert.deepEqual(result.pagination.items.map((p) => p.slug), ["panel"]);
  assert.equal(result.options.brands.find((item) => item.value === "albero")?.count, 0);
});
test("sorting uses the effective promotional price; no-price items sort last", () => {
  const items = [product({ slug: "promo", price: 50, oldPrice: 200, isPromotional: true }), product({ slug: "normal", price: 100 }), product({ slug: "request", price: undefined })];
  assert.deepEqual(getStorefrontCatalog(items, { sort: "price-asc" }).pagination.items.map((p) => p.slug), ["promo", "normal", "request"]);
  assert.deepEqual(getStorefrontCatalog(items, { sort: "price-desc" }).pagination.items.map((p) => p.slug), ["normal", "promo", "request"]);
  assert.equal(items[0].oldPrice, 200);
});
test("pagination preserves all products and clamps stale page indices", () => {
  const items = Array.from({ length: 25 }, (_, i) => product({ slug: `panel-${i}` }));
  const result = getStorefrontCatalog(items, { page: "999" });
  assert.equal(result.pagination.totalItems, 25);
  assert.equal(result.state.page, 3);
  assert.equal(result.pagination.items.length, 1);
});
test("URLs round-trip all filter state including repeated brands", () => {
  const items = [product(), product({ brandSlug: "albero", brand: "Albero" })];
  const first = getStorefrontCatalog(items, { brand: ["agt", "albero"], thickness: "18", available: "1", sort: "price-desc", q: "панель" });
  const url = new URL(buildStorefrontHref("/catalog/mdf", first.state), "https://artisan.shop.kg");
  const params: Record<string, string[]> = {};
  for (const key of new Set(url.searchParams.keys())) params[key] = url.searchParams.getAll(key);
  assert.deepEqual(getStorefrontCatalog(items, params).state, first.state);
  assert.equal(url.pathname, "/catalog/mdf");
});
test("invalid options and empty results are safe", () => {
  const result = getStorefrontCatalog([product()], { brand: "nonexistent", thickness: "900", page: "nan", sort: "invalid", q: "missing" });
  assert.deepEqual(result.state.brands, []);
  assert.deepEqual(result.state.thicknesses, []);
  assert.equal(result.state.sort, "default");
  assert.equal(result.pagination.totalItems, 0);
  assert.equal(result.state.page, 1);
});
test("classic rollout switch remains available", () => {
  const previous = process.env.ARTISAN_STOREFRONT_DESIGN;
  try {
    process.env.ARTISAN_STOREFRONT_DESIGN = "classic";
    assert.equal(isPremiumStorefront(), false);
    process.env.ARTISAN_STOREFRONT_DESIGN = "premium";
    assert.equal(isPremiumStorefront(), true);
  } finally {
    if (previous === undefined) delete process.env.ARTISAN_STOREFRONT_DESIGN;
    else process.env.ARTISAN_STOREFRONT_DESIGN = previous;
  }
});
