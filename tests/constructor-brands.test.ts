import assert from "node:assert/strict";
import test from "node:test";

import {
  fittingBrands,
  matchFittingProduct,
} from "../features/constructor/assembly-panel";
import type { FittingLine } from "../features/constructor/assembly";

const product = (name: string, brand: string | null, category = "Петли") => ({
  slug: name,
  name,
  category,
  brand,
  price: 100,
  imageUrl: null,
});

const hinge: FittingLine = {
  key: "hinge",
  label: "Петля",
  note: "",
  count: 4,
  search: /петл/i,
};
const pin: FittingLine = {
  key: "shelfPin",
  label: "Полкодержатель",
  note: "",
  count: 16,
  search: /полкодерж/i,
};

const products = [
  product("Петля Boyard накладная", "Boyard"),
  product("Петля накладная с доводчиком Italiana Ferramenta", null),
  product("Петля Hettich Sensys", "Hettich"),
  product("Полкодержатель 5 мм", null, "Крепёж"),
];

test("brands come from the card or the product name", () => {
  assert.deepEqual(fittingBrands(products).sort(), [
    "Boyard",
    "Hettich",
    "Italiana Ferramenta",
  ]);
});

test("chosen brand wins, missing items fall back to any brand", () => {
  assert.equal(
    matchFittingProduct(hinge, products, "Italiana Ferramenta").product?.name,
    "Петля накладная с доводчиком Italiana Ferramenta",
  );
  assert.equal(
    matchFittingProduct(hinge, products, "Hettich").product?.name,
    "Петля Hettich Sensys",
  );
  const fallback = matchFittingProduct(pin, products, "Hettich");
  assert.equal(fallback.product?.name, "Полкодержатель 5 мм");
  assert.equal(fallback.fallback, true);
  assert.equal(
    matchFittingProduct(hinge, products).product?.name,
    "Петля Boyard накладная",
  );
});
