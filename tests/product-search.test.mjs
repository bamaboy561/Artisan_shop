import assert from "node:assert/strict";
import test from "node:test";
import { loadAction } from "./load-action.mjs";
const search = loadAction("../features/admin/product-search.ts", {});
const products = [
  {
    id: "a",
    name: "Столешница Ванильный крем 18*1220*2800мм",
    sku: "WQ-63815/M",
    brand: { name: "AGT" },
    category: { name: "Плиты" },
  },
  {
    id: "b",
    name: "Петля мебельная с доводчиком",
    sku: "12345678901234567890",
    brand: { name: "Hettich" },
    category: { name: "Фурнитура" },
  },
];
test("search tolerates word order, punctuation, case, spacing and word endings", () => {
  for (const query of [
    "крем ВАНИЛЬНЫЙ",
    "  AGT   крем ",
    "столешниц",
    "18 × 1220 × 2800",
    "wq 63815 m",
    "арт. WQ-63815/M",
  ])
    assert.equal(search.rankProductSearch(products, query)[0]?.id, "a", query);
});
test("word typo and one extra word in pasted description return suggestions", () => {
  assert.equal(search.rankProductSearch(products, "столешниуа")[0]?.id, "a");
  assert.equal(
    search.rankProductSearch(products, "Столешница ванильный крем премиум")[0]
      ?.id,
    "a",
  );
  assert.deepEqual(
    search.rankProductSearch(products, "совсем другой неизвестный товар"),
    [],
  );
});
test("exact results rank first, long article digits are never fuzzy-matched", () => {
  const similar = {
    ...products[0],
    id: "c",
    name: "Столешница ванильный крем премиум",
  };
  assert.equal(
    search.rankProductSearch(
      [products[0], similar],
      "Столешница ванильный крем премиум",
    )[0].id,
    "c",
  );
  assert.equal(
    search.rankProductSearch(products, "12345678901234567890")[0].id,
    "b",
  );
  assert.deepEqual(
    search.rankProductSearch(products, "12345678901234567891"),
    [],
  );
  assert.deepEqual(search.rankProductSearch(products, "8 1220 2800"), []);
});
test("empty query preserves list and normalized decimal dimensions agree", () => {
  assert.deepEqual(search.rankProductSearch(products, ""), products);
  assert.equal(
    search.normalizeProductSearch("2,75 * 1,83"),
    search.normalizeProductSearch("2.75х1.83"),
  );
});
test("server ranks all lightweight active records before limiting and hydrates only matches", async () => {
  const calls = [];
  const db = {
    product: {
      findMany: async (args) => {
        calls.push(args);
        if (!args.select.price) return products;
        return products
          .filter((p) => args.where.id.in.includes(p.id))
          .map((p) => ({
            ...p,
            price: 100,
            stockQuantity: 5,
            promotions: [],
            category: { name: "Плиты", promotions: [] },
            images: [],
          }));
      },
    },
  };
  const server = loadAction("../lib/server/sales-floor.ts", {
    "@/generated/prisma": { ProductStatus: { ACTIVE: "ACTIVE" }, RoleCode: {} },
    "@/features/catalog/bundle-pricing": {
      getEffectiveProductPrice: (p) => p.price,
    },
    "@/features/admin/product-search": search,
    "@/lib/db": { getDb: () => db },
    "@/lib/server/product-bundle-schema": {},
    "@/lib/server/product-promotion-pricing": {
      PROMOTION_PRICE_SELECT: {},
      getProductPromotionPrice: (price) => ({ finalPrice: price }),
    },
    "@/lib/server/users-admin": {},
  });
  assert.equal(
    (await server.getSalesFloorProducts("крем ванильный", 1))[0].id,
    "a",
  );
  assert.equal(calls[0].where.status, "ACTIVE");
  assert.equal(calls[0].take, undefined);
  assert.deepEqual(calls[1].where.id.in, ["a"]);
  assert.equal(calls[1].take, 1);
  calls.length = 0;
  assert.deepEqual(await server.getSalesFloorProducts("несуществующий"), []);
  assert.equal(calls.length, 1);
});
