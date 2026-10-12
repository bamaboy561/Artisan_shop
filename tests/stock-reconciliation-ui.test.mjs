import assert from "node:assert/strict";
import test from "node:test";
import { loadAction } from "./load-action.mjs";

function fixture() {
  const hooks = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const { StockReconciliationTable } = loadAction(
    "../app/admin/products/stock-reconciliation-table.tsx",
    {
      react: {
        useMemo: (compute) => compute(),
        useState: (initial) => {
          const index = cursor++;
          if (!(index in hooks)) hooks[index] = initial;
          return [
            hooks[index],
            (value) => {
              hooks[index] = value;
            },
          ];
        },
      },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "lucide-react": {
        ChevronLeft: "ChevronLeft",
        ChevronRight: "ChevronRight",
        Search: "Search",
      },
      "@/components/ui/input": { Input: "Input" },
      "@/features/admin/stock-import": {
        stockImportStatusLabels: {
          ready: "Будет обновлён",
          skipped: "Пропущен",
          unchanged: "Без изменений",
        },
      },
    },
  );
  const entries = Array.from({ length: 205 }, (_, index) => ({
    key: `row-${index}`,
    sku: `SKU-${index}`,
    name: `Плита ${index}`,
    siteQuantity: 8,
    fileQuantity: 2,
    difference: -6,
    unit: "шт",
    kind: "difference",
    match: "sku",
    status: "ready",
    reason: "",
    selectable: true,
  }));
  entries.push({
    ...entries[0],
    key: "same",
    sku: "SAME",
    kind: "unchanged",
    difference: 0,
    status: "unchanged",
    selectable: false,
  });
  entries.push({
    ...entries[0],
    key: "absent",
    sku: "ABSENT",
    kind: "missing",
    fileQuantity: null,
    difference: null,
    status: "skipped",
    selectable: false,
  });
  const props = {
    entries,
    selected: new Set(),
    onSelection: (next) => {
      props.selected = next;
    },
    disabled: false,
    preview: true,
  };
  return {
    props,
    render: () => {
      cursor = 0;
      return StockReconciliationTable(props);
    },
  };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree))
    return tree.flatMap((item) => nodes(item, predicate));
  return [
    ...(predicate(tree) ? [tree] : []),
    ...nodes(tree.props?.children, predicate),
  ];
}
const rows = (view) =>
  nodes(view, (node) => node.type === "tbody")[0].props.children;

test("reconciliation initially hides matches, paginates, searches the full dataset and resets the page", () => {
  const ui = fixture();
  let view = ui.render();
  assert.equal(rows(view).length, 50);
  nodes(
    view,
    (node) => node.props?.["aria-label"] === "Следующая страница",
  )[0].props.onClick();
  view = ui.render();
  assert.match(JSON.stringify(rows(view)[0]), /SKU-50/);
  nodes(view, (node) => node.type === "Input")[0].props.onChange({
    target: { value: "SKU-204" },
  });
  view = ui.render();
  assert.equal(rows(view).length, 1);
  assert.match(JSON.stringify(rows(view)[0]), /SKU-204/);
  assert.equal(
    nodes(
      view,
      (node) => node.props?.["aria-label"] === "Предыдущая страница",
    )[0].props.disabled,
    true,
  );
});

test("bulk selection covers filtered results across pages but never unsafe rows; filter changes preserve selection", () => {
  const ui = fixture();
  let view = ui.render();
  nodes(
    view,
    (node) => node.type === "input" && node.props.type === "checkbox",
  )[0].props.onChange({ target: { checked: true } });
  assert.equal(ui.props.selected.size, 205);
  assert.equal(ui.props.selected.has("row-204"), true);
  assert.equal(ui.props.selected.has("absent"), false);
  assert.equal(ui.props.selected.has("same"), false);
  nodes(view, (node) => node.type === "select")[0].props.onChange({
    target: { value: "missing" },
  });
  view = ui.render();
  assert.equal(rows(view).length, 1);
  assert.equal(ui.props.selected.size, 205);
  assert.equal(
    nodes(rows(view), (node) => node.type === "input")[0].props.disabled,
    true,
  );
});

test("search-scoped selection and deselection do not alter other selected rows", () => {
  const ui = fixture();
  ui.props.selected = new Set(["row-0"]);
  nodes(ui.render(), (node) => node.type === "Input")[0].props.onChange({
    target: { value: "SKU-204" },
  });
  let view = ui.render();
  nodes(view, (node) => node.type === "input")[0].props.onChange({
    target: { checked: true },
  });
  assert.deepEqual([...ui.props.selected], ["row-0", "row-204"]);
  view = ui.render();
  nodes(view, (node) => node.type === "input")[0].props.onChange({
    target: { checked: false },
  });
  assert.deepEqual([...ui.props.selected], ["row-0"]);
});

test("done view hides editable selections and null quantities remain distinct from zero", () => {
  const ui = fixture();
  ui.props.preview = false;
  const view = ui.render();
  assert.equal(nodes(view, (node) => node.type === "input").length, 0);
  nodes(view, (node) => node.type === "select")[0].props.onChange({
    target: { value: "missing" },
  });
  assert.match(JSON.stringify(rows(ui.render())), /—/);
});
