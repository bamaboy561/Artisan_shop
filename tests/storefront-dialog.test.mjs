import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import { loadAction } from "./load-action.mjs";

const { StorefrontDialog } = loadAction("../features/storefront/controls.tsx", {
  react: React,
  "react/jsx-runtime": jsx,
  "lucide-react": icons,
  "./storefront.module.css": { default: {} },
});

test("closed dialogs do not render or evaluate their content", () => {
  let renders = 0;
  function Content() {
    renders += 1;
    return React.createElement("img", { src: "/large.jpg", alt: "Product" });
  }
  const html = renderToStaticMarkup(
    React.createElement(
      StorefrontDialog,
      { open: false, onClose() {}, title: "Preview" },
      React.createElement(Content),
    ),
  );
  assert.equal(renders, 0);
  assert.match(html, /<dialog/);
  assert.doesNotMatch(html, /<img|<h2|large\.jpg/);
});

test("open dialogs render their title, content and close control", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      StorefrontDialog,
      { open: true, onClose() {}, title: "Preview" },
      React.createElement("p", null, "Product details"),
    ),
  );
  assert.match(html, /<h2>Preview<\/h2>/);
  assert.match(html, /Product details/);
  assert.match(html, /<button/);
});
