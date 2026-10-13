import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import QRCode from "qrcode";
import * as fs from "node:fs/promises";
import * as dns from "node:dns/promises";
import * as https from "node:https";
import * as net from "node:net";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { loadAction } from "./load-action.mjs";

const data = {
  siteUrl: "https://artisan.shop.kg",
  contacts: {
    phone: "+996 553 432 131",
    email: "info@artisan.kg",
    address: "г. Бишкек",
    hours: "Пн-Пт 09:00-17:00",
  },
  title: "Albero",
  createdAt: new Date("2026-10-12T09:00:00Z"),
  products: [
    {
      sku: "001234567890123456789012345",
      name: "МДФ премиальный зелёный",
      brand: "Albero",
      category: "Плиты / МДФ",
      price: 12345,
      oldPrice: 14000,
      url: "https://artisan.shop.kg/product/mdf",
      stockQuantity: 0,
      format: "2800 x 1220",
      thicknessMm: 18,
      edgeThicknessMm: 0.8,
      edgeWidthMm: 22,
      imageUrl: null,
    },
  ],
};
const render = loadAction("../lib/server/photo-catalog-render.ts", {
  "server-only": {},
  "node:path": { default: path },
  exceljs: { default: ExcelJS },
  pdfkit: { default: PDFDocument },
  qrcode: { default: QRCode },
  "@/lib/server/catalog-thumbnail": { catalogThumbnail: async () => null },
});

test("photo Excel embeds pictures and preserves Cyrillic, long SKUs and numeric values", async () => {
  const photo = await sharp({
    create: { width: 50, height: 40, channels: 3, background: "green" },
  })
    .jpeg()
    .toBuffer();
  const file = await render.renderPhotoExcel(data, [photo]);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(file);
  const sheet = book.getWorksheet("Каталог");
  assert.equal(sheet.getCell("B4").value, data.products[0].sku);
  assert.equal(sheet.getCell("C4").value, data.products[0].name);
  assert.equal(sheet.getCell("G4").value, 12345);
  assert.equal(sheet.getCell("H4").value, 0);
  assert.match(sheet.getCell("F4").value, /0.8 мм/);
  assert.equal(sheet.getImages().length, 1);
  assert.equal(book.model.media.length, 1);
});

test("missing photos and missing numeric values never remove products or become zero", async () => {
  const empty = {
    ...data,
    products: [{ ...data.products[0], price: null, stockQuantity: null }],
  };
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await render.renderPhotoExcel(empty, [null]));
  const sheet = book.getWorksheet("Каталог");
  assert.equal(sheet.getCell("A4").value, "Фото недоступно");
  assert.equal(sheet.getCell("G4").value, null);
  assert.equal(sheet.getCell("H4").value, null);
  assert.equal(sheet.rowCount, 4);
});

test("PDF embeds a Cyrillic font and paginates without dropping products", async () => {
  const many = {
    ...data,
    products: Array.from({ length: 25 }, (_, i) => ({
      ...data.products[0],
      sku: `000${i}`,
    })),
  };
  const file = await render.renderPhotoPdf(many, Array(25).fill(null));
  assert.equal(file.subarray(0, 5).toString(), "%PDF-");
  const source = file.toString("latin1");
  assert.ok(source.includes("/FontFile2"));
  // Обложка и три страницы по девять карточек.
  assert.equal((source.match(/\/Type \/Page\b/g) ?? []).length, 4);
  assert.equal((source.match(/\/URI \(/g) ?? []).length, 25);
});

test("PDF layout keeps every product, groups top-level sections and repeats a split section header", () => {
  const product = (category, i) => ({
    ...data.products[0],
    sku: String(i),
    category,
  });
  const products = [
    ...Array.from({ length: 2 }, (_, i) => product("Кромка", i)),
    ...Array.from({ length: 13 }, (_, i) =>
      product(`Плиты / ${i % 2 ? "ЛДСП" : "МДФ"}`, 10 + i),
    ),
    product("Фурнитура / Петли", 40),
  ];
  const layout = render.layoutPhotoCatalog(products);
  assert.deepEqual(
    layout.cards.map((card) => card.index),
    products.map((_, index) => index),
  );
  assert.deepEqual(
    layout.sections
      .filter((s) => !s.continued)
      .map((s) => [s.category, s.count]),
    [
      ["Кромка", 2],
      ["Плиты", 13],
      ["Фурнитура", 1],
    ],
  );
  assert.ok(layout.sections.some((s) => s.continued && s.category === "Плиты"));
  assert.ok(layout.cards.every((card) => card.page >= 2));
  for (const card of layout.cards) assert.ok(card.y + 224 <= 841.89 - 40);
  const keys = layout.cards.map((card) => `${card.page}:${card.x}:${card.y}`);
  assert.equal(new Set(keys).size, keys.length, "cards never overlap");
});

function fixture({
  session = { userId: "staff", roleCode: "ADMIN" },
  authorized = true,
  products = data.products,
} = {}) {
  let reads = 0;
  const { GET } = loadAction(
    "../app/api/admin/products/photo-catalog/route.ts",
    {
      "@/lib/auth/dal": { getOptionalSession: async () => session },
      "@/lib/auth/roles": { canAccessGeneralAdmin: () => authorized },
      "@/lib/db": { hasDatabaseUrl: () => true },
      "@/lib/server/photo-catalog-data": {
        getPhotoCatalogData: async (brand, stock) => {
          reads++;
          assert.equal(brand, "albero");
          assert.equal(stock, true);
          return { ...data, products };
        },
      },
      "@/lib/server/photo-catalog-render": {
        ...render,
        loadCatalogPhotos: async () => [null],
      },
    },
  );
  return { GET, reads: () => reads };
}
const request = (format = "xlsx") =>
  new Request(
    `http://localhost/api/admin/products/photo-catalog?format=${format}&brand=albero&inStock=1`,
  );
test("photo export is admin-only and validates format before database reads", async () => {
  for (const options of [{ session: null }, { authorized: false }]) {
    const instance = fixture(options);
    assert.ok([401, 403].includes((await instance.GET(request())).status));
    assert.equal(instance.reads(), 0);
  }
  const instance = fixture();
  assert.equal((await instance.GET(request("html"))).status, 400);
  assert.equal(instance.reads(), 0);
});
test("authorized export returns private attachments and photo warning; empty selection is not a successful file", async () => {
  for (const format of ["pdf", "xlsx"]) {
    const response = await fixture().GET(request(format));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("X-Catalog-Missing-Photos"), "1");
    assert.ok(
      response.headers.get("Content-Disposition").endsWith(`.${format}"`),
    );
  }
  assert.equal((await fixture({ products: [] }).GET(request())).status, 404);
});

test("photo query filters only selected active brand and positive stock, preserves hierarchy and applies promotion price", async () => {
  let query;
  let isolation;
  const db = {
    product: {
      findMany: (input) => {
        query = input;
        return [
          {
            ...data.products[0],
            slug: "mdf green",
            compareAtPrice: null,
            categoryId: "mdf",
            brandId: "albero",
            images: [],
            promotions: [],
            category: { promotions: [] },
          },
        ];
      },
    },
    brand: { findMany: () => [{ id: "albero", name: "Albero" }] },
    category: {
      findMany: () => [
        { id: "mdf", name: "МДФ", parentId: "panels" },
        { id: "panels", name: "Плиты", parentId: null },
      ],
    },
    $transaction: async (requests, options) => {
      isolation = options.isolationLevel;
      return Promise.all(requests);
    },
  };
  const { getPhotoCatalogData } = loadAction(
    "../lib/server/photo-catalog-data.ts",
    {
      "server-only": {},
      "@/lib/db": { getDb: () => db },
      "@/lib/seo": { getSiteUrl: () => "https://artisan.shop.kg" },
      "@/lib/site-config": { companyContacts: data.contacts },
      "@/lib/server/product-promotion-pricing": {
        PROMOTION_PRICE_SELECT: {},
        getProductPromotionPrice: () => ({
          basePrice: 12345,
          finalPrice: 10000,
        }),
      },
    },
  );
  const result = await getPhotoCatalogData("albero", true);
  assert.deepEqual(query.where, {
    status: "ACTIVE",
    brandId: "albero",
    stockQuantity: { gt: 0 },
  });
  assert.equal(query.take, undefined);
  assert.equal(isolation, "RepeatableRead");
  assert.equal(result.products[0].category, "Плиты / МДФ");
  assert.equal(result.products[0].price, 10000);
  assert.equal(result.products[0].oldPrice, 12345);
  assert.equal(
    result.products[0].url,
    "https://artisan.shop.kg/product/mdf%20green",
  );
  assert.equal("promotions" in result.products[0], false);
  await assert.rejects(
    () => getPhotoCatalogData("unknown", false),
    /Бренд не найден/,
  );
});

test("thumbnail loader rejects arbitrary hosts, unsafe URLs, traversal and oversized images", async () => {
  const helper = loadAction("../lib/image-optimization.ts", {});
  const thumbs = loadAction("../lib/server/catalog-thumbnail.ts", {
    "server-only": {},
    "node:path": { default: path },
    "node:fs/promises": fs,
    "node:dns/promises": dns,
    "node:https": https,
    "node:net": net,
    sharp: { default: sharp },
    "@/lib/image-optimization": helper,
  });
  for (const src of [
    "http://example.com/a.jpg",
    "https://127.0.0.1/a",
    "https://untrusted.example/a",
    "//localhost/a",
    "https://user:pass@images.unsplash.com/a",
    "https://images.unsplash.com:8443/a",
  ]) {
    assert.equal(thumbs.isAllowedCatalogImage(src), false, src);
    assert.equal(await thumbs.catalogThumbnail(src), null);
  }
  assert.equal(await thumbs.catalogThumbnail("/../package.json"), null);
  assert.equal(await thumbs.catalogThumbnail("/%2e%2e/package.json"), null);
  const photo = await thumbs.catalogThumbnail("/pwa-icon-192.png");
  assert.ok(photo);
  assert.equal((await sharp(photo).metadata()).format, "jpeg");
});

test("public IPv4 thumbnails load through pinned DNS without automatic family selection", async () => {
  const bytes = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "green" },
  })
    .jpeg()
    .toBuffer();
  const helper = loadAction("../lib/image-optimization.ts", {});
  let requests = 0;
  const thumbs = loadAction("../lib/server/catalog-thumbnail.ts", {
    "server-only": {},
    "node:path": { default: path },
    "node:fs/promises": fs,
    "node:dns/promises": {
      lookup: async () => [{ address: "8.8.8.8", family: 4 }],
    },
    "node:https": {
      get: (_url, options, onResponse) => {
        requests++;
        assert.equal(options.autoSelectFamily, false);
        options.lookup("ignored.example", {}, (error, address, family) => {
          assert.equal(error, null);
          assert.equal(address, "8.8.8.8");
          assert.equal(family, 4);
        });
        const request = new EventEmitter();
        request.destroy = (error) => {
          request.emit("error", error);
          request.emit("close");
        };
        queueMicrotask(() => {
          const response = new PassThrough();
          response.statusCode = 200;
          response.headers = { "content-type": "image/jpeg" };
          onResponse(response);
          response.end(bytes);
          request.emit("close");
        });
        return request;
      },
    },
    "node:net": net,
    sharp: { default: sharp },
    "@/lib/image-optimization": helper,
  });
  const photo = await thumbs.catalogThumbnail("https://extravert.ru/photo.jpg");
  assert.ok(photo);
  assert.equal(requests, 1);
  assert.equal((await sharp(photo).metadata()).format, "jpeg");
});

test("private DNS answers, including IPv4-mapped IPv6, stay blocked before connecting", async () => {
  const helper = loadAction("../lib/image-optimization.ts", {});
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "fe80::1",
  ]) {
    let requests = 0;
    const thumbs = loadAction("../lib/server/catalog-thumbnail.ts", {
      "server-only": {},
      "node:path": { default: path },
      "node:fs/promises": fs,
      "node:dns/promises": {
        lookup: async () => [
          { address, family: address.includes(":") ? 6 : 4 },
        ],
      },
      "node:https": {
        get: () => {
          requests++;
          throw new Error("must not connect");
        },
      },
      "node:net": net,
      sharp: { default: sharp },
      "@/lib/image-optimization": helper,
    });
    assert.equal(
      await thumbs.catalogThumbnail("https://extravert.ru/photo.jpg"),
      null,
      address,
    );
    assert.equal(requests, 0, address);
  }
});
