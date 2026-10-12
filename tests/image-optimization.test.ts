import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseNextImageOptimization,
  shouldBypassNextImageOptimization,
} from "../lib/image-optimization";
import nextConfig from "../next.config";

test("LDSP category image uses the allowlisted optimizer", () => {
  const src = "https://nt73.ru/userfiles/EXTRAVERT_%20image.jpg";
  assert.equal(canUseNextImageOptimization(src), true);
  assert.equal(shouldBypassNextImageOptimization(src), false);
  assert.ok(
    nextConfig.images?.remotePatterns?.some(
      (pattern) =>
        !(pattern instanceof URL) &&
        pattern.protocol === "https" &&
        pattern.hostname === "nt73.ru" &&
        pattern.pathname === "/userfiles/**",
    ),
  );
});

test("untrusted hosts do not become eligible for image optimization", () => {
  for (const src of [
    "https://nt73.ru.example.org/userfiles/image.jpg",
    "https://other.example/image.jpg",
    "http://nt73.ru/userfiles/image.jpg",
  ]) {
    assert.equal(canUseNextImageOptimization(src), false);
  }
});

test("supplier image bypasses and existing local/blob images are preserved", () => {
  assert.equal(
    shouldBypassNextImageOptimization("https://shop.hettich.com/image.jpg"),
    true,
  );
  assert.equal(
    shouldBypassNextImageOptimization(
      "https://www.agtwood.com/medium/ProductCategory/Image/abc",
    ),
    true,
  );
  assert.equal(
    canUseNextImageOptimization("/storefront/interior-1.webp"),
    true,
  );
  assert.equal(
    canUseNextImageOptimization(
      "https://example.public.blob.vercel-storage.com/products/image.png",
    ),
    true,
  );
});
