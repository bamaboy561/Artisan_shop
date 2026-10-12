import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import * as zod from "zod";
import { loadAction } from "./load-action.mjs";
const model = loadAction("../features/admin/sales-invoice-model.ts", {});
const photo = loadAction("../lib/server/invoice-photo.ts", {
  "server-only": {},
  sharp: { default: sharp },
  zod,
});
const extraction = (changes = {}) => ({
  title: "Накладная 23566",
  customerName: "Клиент",
  declaredTotal: 22050,
  complete: true,
  warnings: [],
  lines: [
    {
      name: "Плита",
      sku: "0012345678901234567890",
      quantity: 6,
      unitPrice: 3150,
      amount: 22050,
      unit: "шт",
      uncertain: false,
    },
  ],
  ...changes,
});
test("photo parser keeps original prices, discrepancies, leading zeros and requires human review", () => {
  const parsed = photo.parseInvoicePhotoResult(extraction(), "invoice.jpg");
  assert.equal(parsed.lines[0].quantity, 6);
  assert.equal(parsed.lines[0].unitPrice, 3150);
  assert.equal(parsed.lines[0].amount, 22050);
  assert.equal(parsed.lines[0].sku, "0012345678901234567890");
  assert.ok(parsed.warnings.length);
});
test("uncertain fields stay null and fractions stay visible; no numeric coercion or invented rows", () => {
  const parsed = photo.parseInvoicePhotoResult(
    extraction({
      lines: [
        {
          name: null,
          sku: null,
          quantity: 1.5,
          unitPrice: null,
          amount: null,
          unit: null,
          uncertain: true,
        },
      ],
    }),
    "x.jpg",
  );
  assert.equal(parsed.lines[0].quantity, 1.5);
  assert.equal(parsed.lines[0].unitPrice, null);
  assert.match(model.validateInvoiceLine(parsed.lines[0]), /Количество/);
  assert.ok(parsed.warnings.length > 1);
  assert.equal(
    model.matchInvoiceLines(parsed.lines, [
      { id: "p", name: parsed.lines[0].name, sku: "" },
    ])[0].product,
    null,
  );
  for (const bad of [
    extraction({ complete: false }),
    extraction({ lines: [] }),
    extraction({ lines: Array(101).fill(extraction().lines[0]) }),
    extraction({ declaredTotal: "22050" }),
  ])
    assert.throws(
      () => photo.parseInvoicePhotoResult(bad, "x.jpg"),
      photo.InvoicePhotoError,
    );
});
test("server verifies real image bytes and drops metadata; corrupt files, SVG and oversize files fail", async () => {
  const input = await sharp({
    create: { width: 100, height: 50, channels: 3, background: "white" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const output = await photo.prepareInvoicePhoto(
    new File([input], "invoice.jpg"),
  );
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
  for (const file of [
    new File(["broken"], "invoice.jpg"),
    new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'],
      "fake.jpg",
    ),
    new File([new Uint8Array(3 * 1024 * 1024 + 1)], "big.jpg"),
  ])
    await assert.rejects(
      photo.prepareInvoicePhoto(file),
      photo.InvoicePhotoError,
    );
});
test("provider call uses structured output, strips unrelated data request, no storage and no retries", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  const oldModel = process.env.INVOICE_OCR_MODEL;
  process.env.OPENAI_API_KEY = "test-secret";
  delete process.env.INVOICE_OCR_MODEL;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.input[0].content[0].type, "input_image");
    assert.match(body.instructions, /untrusted/);
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: JSON.stringify(extraction()) },
          ],
        },
      ],
    });
  };
  try {
    assert.equal(
      (await photo.recognizeInvoicePhoto(Buffer.from("image"), "test.jpg"))
        .lines.length,
      1,
    );
    for (const response of [
      Response.json({}, { status: 401 }),
      Response.json({}, { status: 429 }),
      Response.json({ status: "incomplete" }),
      Response.json({
        status: "completed",
        output: [{ type: "message", content: [{ type: "refusal" }] }],
      }),
      Response.json({ status: "completed", output: [] }),
    ]) {
      globalThis.fetch = async () => {
        calls++;
        return response;
      };
      const before = calls;
      await assert.rejects(
        photo.recognizeInvoicePhoto(Buffer.from("image"), "test.jpg"),
        photo.InvoicePhotoError,
      );
      assert.equal(calls, before + 1);
    }
    delete process.env.OPENAI_API_KEY;
    const before = calls;
    await assert.rejects(
      photo.recognizeInvoicePhoto(Buffer.from("image"), "test.jpg"),
      /ещё не подключено/,
    );
    assert.equal(calls, before);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.INVOICE_OCR_MODEL;
    else process.env.INVOICE_OCR_MODEL = oldModel;
  }
});
function actionFixture({ allowed = true, enabled = true, limit = true } = {}) {
  const events = [];
  const action = loadAction("../app/admin/sales-floor/invoice-actions.ts", {
    "@/features/admin/sales-invoice": {
      parseSalesInvoice: async () => {
        events.push("excel");
        return modelInvoice();
      },
    },
    "@/features/admin/sales-invoice-model": model,
    "@/lib/auth/dal": {
      requireAdminSession: async () => ({
        userId: "staff",
        roleCode: "MANAGER",
      }),
    },
    "@/lib/auth/roles": { canAccessGeneralAdmin: () => allowed },
    "@/lib/db": { hasDatabaseUrl: () => true },
    "@/lib/server/sales-floor": {
      getSalesFloorProducts: async () => {
        events.push("catalog");
        return [];
      },
    },
    "@/lib/server/invoice-photo": {
      InvoicePhotoError: photo.InvoicePhotoError,
      isInvoicePhotoEnabled: () => enabled,
      prepareInvoicePhoto: async () => {
        events.push("prepare");
        return Buffer.from("image");
      },
      recognizeInvoicePhoto: async () => {
        events.push("recognize");
        return modelInvoice();
      },
    },
    "@/lib/server/invoice-photo-limit": {
      claimInvoicePhotoAttempt: async (userId) => {
        assert.equal(userId, "staff");
        events.push("limit");
        return limit;
      },
    },
  });
  function modelInvoice() {
    return photo.parseInvoicePhotoResult(extraction(), "test.jpg");
  }
  return { run: action.previewSalesInvoiceAction, events };
}
const form = (consent = true, source = "photo") => {
  const data = new FormData();
  data.set("source", source);
  if (consent) data.set("photoConsent", "yes");
  data.set(
    "invoice",
    new File(["image"], source === "photo" ? "test.jpg" : "test.xls"),
  );
  return data;
};
test("authorization, missing configuration and consent block before any paid call or catalog access", async () => {
  for (const options of [{ allowed: false }, { enabled: false }]) {
    const fixture = actionFixture(options);
    assert.ok((await fixture.run(form())).error);
    assert.deepEqual(fixture.events, []);
  }
  const fixture = actionFixture();
  assert.ok((await fixture.run(form(false))).error);
  assert.deepEqual(fixture.events, []);
});
test("cost limit fails closed; photo preview only recognizes and reads, Excel never consumes OCR", async () => {
  const denied = actionFixture({ limit: false });
  assert.ok((await denied.run(form())).error);
  assert.deepEqual(denied.events, ["prepare", "limit"]);
  const accepted = actionFixture();
  const result = await accepted.run(form());
  assert.ok(result.invoice.warnings.length);
  assert.deepEqual(accepted.events, [
    "prepare",
    "limit",
    "recognize",
    "catalog",
  ]);
  const excel = actionFixture({ enabled: false });
  assert.ok((await excel.run(form(false, "excel"))).invoice);
  assert.deepEqual(excel.events, ["excel", "catalog"]);
});
test("durable employee limiter uses atomic conflict guard and one reusable setting key", async () => {
  const calls = [];
  const limit = loadAction("../lib/server/invoice-photo-limit.ts", {
    "server-only": {},
    "node:crypto": { randomUUID: () => "id" },
    "@/lib/db": {
      getDb: () => ({
        $queryRaw: async (sql, ...values) => {
          calls.push({ sql: sql.join("?"), values });
          return [{ id: "id" }];
        },
      }),
    },
  });
  assert.equal(await limit.claimInvoicePhotoAttempt("staff"), true);
  assert.match(calls[0].sql, /ON CONFLICT/);
  assert.match(calls[0].sql, /30 seconds/);
  assert.match(calls[0].sql, /< 50/);
  assert.ok(calls[0].values.includes("invoice-ocr-limit:staff"));
});
