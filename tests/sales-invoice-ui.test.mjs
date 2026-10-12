import assert from "node:assert/strict";
import test from "node:test";
import { loadAction } from "./load-action.mjs";
const model = loadAction("../features/admin/sales-invoice-model.ts", {});
const jsx = (type, props) => ({ type, props });
function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree))
    return tree.flatMap((item) => nodes(item, predicate));
  return [
    ...(predicate(tree) ? [tree] : []),
    ...nodes(tree.props?.children, predicate),
  ];
}
function fixture({
  unmatched = false,
  stock = 20,
  photoEnabled = false,
  photoWarnings = [],
} = {}) {
  const hooks = [];
  let cursor = 0;
  const state = { imported: [], editing: [], searches: 0 };
  const product = {
    id: "p",
    name: "Плита",
    sku: "00123456",
    price: 9999,
    stockQuantity: stock,
    brand: null,
    category: { name: "Плиты" },
    images: [],
  };
  const { SalesInvoiceImport } = loadAction(
    "../app/admin/sales-floor/invoice-import.tsx",
    {
      react: {
        useEffect: () => {},
        useState: (initial) => {
          const index = cursor++;
          if (!(index in hooks)) hooks[index] = initial;
          return [
            hooks[index],
            (value) => {
              hooks[index] =
                typeof value === "function" ? value(hooks[index]) : value;
            },
          ];
        },
      },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "lucide-react": {
        FileUp: "FileUp",
        Check: "Check",
        LoaderCircle: "LoaderCircle",
        Search: "Search",
        X: "X",
      },
      "@/components/ui/button": { Button: "Button" },
      "@/components/ui/input": { Input: "Input" },
      "@/features/admin/sales-invoice-model": model,
      "@/features/admin/invoice-photo-client": {},
      "@/app/admin/sales-floor/invoice-actions": {
        previewSalesInvoiceAction: async () => ({
          invoice: {
            title: "Накладная 23566",
            fileName: "invoice.xls",
            customerName: "Клиент",
            declaredTotal: 22050,
            warnings: photoWarnings,
            lines: [
              {
                key: "row",
                name: "Плита",
                sku: "",
                quantity: 6,
                unitPrice: 3150,
                amount: 22050,
                unit: "шт",
                product: unmatched ? null : product,
                matchMessage: "По точному названию",
              },
            ],
          },
        }),
      },
    },
  );
  const props = {
    photoEnabled,
    onImport: (...args) => {
      state.imported.push(args);
      return true;
    },
    onEditing: (editing) => state.editing.push(editing),
  };
  const render = () => {
    cursor = 0;
    return SalesInvoiceImport(props);
  };
  const load = async () => {
    let view = render();
    nodes(view, (node) => node.props?.type === "file")[0].props.onChange({
      target: { files: [new File(["test"], "invoice.xls")] },
    });
    view = render();
    await nodes(view, (node) => node.type === "Button")[0].props.onClick();
    // The click handler intentionally schedules load without returning its promise.
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { render, load, state, product };
}
const apply = (view) =>
  nodes(
    view,
    (node) => node.type === "Button" && node.props.variant === "accent",
  )[0];
test("invoice discrepancy requires acknowledgment and imports unit prices unchanged without creating a sale", async () => {
  const ui = fixture();
  await ui.load();
  let view = ui.render();
  assert.equal(apply(view).props.disabled, true);
  assert.equal(ui.state.imported.length, 0);
  const checkboxes = nodes(view, (node) => node.props?.type === "checkbox");
  checkboxes.at(-1).props.onChange({ target: { checked: true } });
  view = ui.render();
  assert.equal(apply(view).props.disabled, false);
  apply(view).props.onClick();
  assert.equal(ui.state.imported[0][0][0].quantity, 6);
  assert.equal(ui.state.imported[0][0][0].unitPrice, 3150);
  assert.equal(ui.state.imported[0][1], "Накладная 23566");
  assert.deepEqual(ui.state.editing, [true, false]);
});
test("photo mode offers mobile camera and cannot send while unconfigured or without consent", () => {
  for (const photoEnabled of [false, true]) {
    const ui = fixture({ photoEnabled });
    const photoButton = nodes(
      ui.render(),
      (node) => node.type === "button" && node.props["aria-pressed"] === false,
    )[0];
    photoButton.props.onClick();
    let view = ui.render();
    const camera = nodes(
      view,
      (node) => node.props?.capture === "environment",
    )[0];
    assert.equal(camera.props.accept, "image/jpeg,image/png,image/webp");
    camera.props.onChange({
      target: {
        files: [new File(["photo"], "invoice.jpg", { type: "image/jpeg" })],
      },
    });
    view = ui.render();
    const button = nodes(view, (node) => node.type === "Button")[0];
    assert.equal(button.props.disabled, true);
    const consent = nodes(view, (node) => node.props?.type === "checkbox")[0];
    assert.equal(consent.props.disabled, !photoEnabled);
    if (photoEnabled) {
      consent.props.onChange({ target: { checked: true } });
      assert.equal(
        nodes(ui.render(), (node) => node.type === "Button")[0].props.disabled,
        false,
      );
    }
    assert.equal(ui.state.imported.length, 0);
  }
});
test("photo review warning requires confirmation even if every printed total agrees", async () => {
  const ui = fixture({ photoWarnings: ["Проверьте данные по фото"] });
  await ui.load();
  nodes(
    ui.render(),
    (node) => node.type === "Input" && node.props.type === "text",
  )[0].props.onChange({ target: { value: "7" } });
  assert.equal(apply(ui.render()).props.disabled, true);
  nodes(ui.render(), (node) => node.props?.type === "checkbox")
    .at(-1)
    .props.onChange({ target: { checked: true } });
  assert.equal(apply(ui.render()).props.disabled, false);
});
test("correcting quantity to reconcile the original sum permits import without guessing corrections", async () => {
  const ui = fixture();
  await ui.load();
  const quantities = nodes(
    ui.render(),
    (node) => node.type === "Input" && node.props.type === "text",
  );
  quantities[0].props.onChange({ target: { value: "7" } });
  const view = ui.render();
  assert.equal(apply(view).props.disabled, false);
  apply(view).props.onClick();
  assert.equal(ui.state.imported[0][0][0].quantity, 7);
});
test("unresolved products and insufficient stock remain blocked even after acknowledgment", async () => {
  for (const options of [{ unmatched: true }, { stock: 2 }]) {
    const ui = fixture(options);
    await ui.load();
    nodes(ui.render(), (node) => node.props?.type === "checkbox")
      .at(-1)
      .props.onChange({ target: { checked: true } });
    const view = ui.render();
    assert.equal(apply(view).props.disabled, true);
    apply(view).props.onClick();
    assert.equal(ui.state.imported.length, 0);
  }
});
test("editing prices clears acknowledgment; malformed price does not silently use the catalog price", async () => {
  const ui = fixture();
  await ui.load();
  nodes(ui.render(), (node) => node.props?.type === "checkbox")
    .at(-1)
    .props.onChange({ target: { checked: true } });
  nodes(
    ui.render(),
    (node) => node.type === "Input" && node.props.type === "text",
  )[1].props.onChange({ target: { value: "bad" } });
  const view = ui.render();
  assert.equal(apply(view).props.disabled, true);
  assert.equal(
    nodes(view, (node) => node.props?.type === "checkbox").at(-1).props.checked,
    false,
  );
});
