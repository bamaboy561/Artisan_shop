import assert from "node:assert/strict";
import test from "node:test";
import {
  appendPricedCartItems,
  planReorder,
  type ReorderProduct,
} from "../features/cart/reorder";

const product: ReorderProduct = {
  slug: "hinge",
  name: "Hinge",
  sku: "123",
  image: "/test.webp",
  price: 242,
  stockQuantity: 20,
  inStock: true,
  purchaseMode: "cart",
};
const line = (quantity: number, productSlug: string | null = "hinge") => ({
  productSlug,
  name: "Old name",
  quantity,
});

test("reorder groups duplicate lines and uses current prices and stock", () => {
  const [row] = planReorder([line(3), line(2)], [product], []);
  assert.equal(row.quantity, 5);
  assert.equal(row.product?.price, 242);
  assert.equal(row.note, null);
});

test("reorder allows only remaining stock after existing cart quantities", () => {
  const [row] = planReorder(
    [line(20)],
    [product],
    [{ productSlug: "hinge", quantity: 17 }],
  );
  assert.equal(row.quantity, 3);
  assert.equal(row.alreadyInCart, 17);
  assert.match(row.note!, /3.*20/);
});

test("deleted, quote-only, unpriced and unavailable products stay visible but cannot be added", () => {
  assert.equal(planReorder([line(2, null)], [], [])[0].quantity, 0);
  for (const patch of [
    { purchaseMode: "request" as const },
    { price: undefined },
    { inStock: false },
    { stockQuantity: 0 },
    { price: -1 },
    { stockQuantity: NaN },
    { stockQuantity: Infinity },
    { price: NaN },
  ])
    assert.equal(
      planReorder([line(2)], [{ ...product, ...patch }], [])[0].quantity,
      0,
    );
});

test("invalid historical quantities cannot be made valid by aggregation", () => {
  for (const quantity of [0, -1, 0.5, NaN, Infinity]) {
    assert.equal(
      planReorder([line(quantity), line(2)], [product], [])[0].quantity,
      0,
    );
  }
});

test("unknown stock observes the cart ceiling and fractional stock is rounded down", () => {
  assert.equal(
    planReorder([line(1000)], [{ ...product, stockQuantity: null }], [])[0]
      .quantity,
    999,
  );
  assert.equal(
    planReorder([line(20)], [{ ...product, stockQuantity: 3.8 }], [])[0]
      .quantity,
    3,
  );
  const [full] = planReorder(
    [line(2)],
    [product],
    [{ productSlug: "hinge", quantity: 20 }],
  );
  assert.equal(full.quantity, 0);
  assert.match(full.note!, /уже в корзине/);
});

test("batch addition preserves the current cart and merges repeated purchases", () => {
  const cart = [
    { productSlug: "other", quantity: 7 },
    { productSlug: "hinge", quantity: 3 },
  ];
  const before = structuredClone(cart);
  assert.deepEqual(
    appendPricedCartItems(
      cart,
      [{ productSlug: "hinge", quantity: 2, unitPrice: 242 }],
      [product],
    ),
    [
      { productSlug: "other", quantity: 7 },
      { productSlug: "hinge", quantity: 5 },
    ],
  );
  assert.deepEqual(cart, before);
});

test("a failed second line rejects the whole batch without partial changes", () => {
  const cart = [{ productSlug: "existing", quantity: 1 }];
  assert.equal(
    appendPricedCartItems(
      cart,
      [
        { productSlug: "hinge", quantity: 2, unitPrice: 242 },
        { productSlug: "missing", quantity: 1, unitPrice: 10 },
      ],
      [product],
    ),
    null,
  );
  assert.deepEqual(cart, [{ productSlug: "existing", quantity: 1 }]);
});

test("price or stock changes require a new preview, never silent substitution", () => {
  const additions = [{ productSlug: "hinge", quantity: 3, unitPrice: 242 }];
  for (const patch of [
    { price: 250 },
    { price: 200 },
    { stockQuantity: 2 },
    { stockQuantity: NaN },
    { inStock: false },
  ]) {
    assert.equal(
      appendPricedCartItems([], additions, [{ ...product, ...patch }]),
      null,
    );
  }
  assert.equal(
    appendPricedCartItems([{ productSlug: "hinge", quantity: 19 }], additions, [
      product,
    ]),
    null,
  );
});

test("batch rejects invalid quantities, prices and cumulative stock overflows", () => {
  for (const quantity of [0, -1, 1.5, 1000, NaN])
    assert.equal(
      appendPricedCartItems(
        [],
        [{ productSlug: "hinge", quantity, unitPrice: 242 }],
        [product],
      ),
      null,
    );
  assert.equal(
    appendPricedCartItems(
      [],
      [{ productSlug: "hinge", quantity: 1, unitPrice: -10 }],
      [{ ...product, price: -10 }],
    ),
    null,
  );
  assert.equal(
    appendPricedCartItems(
      [],
      Array.from({ length: 2 }, () => ({
        productSlug: "hinge",
        quantity: 11,
        unitPrice: 242,
      })),
      [product],
    ),
    null,
  );
});
