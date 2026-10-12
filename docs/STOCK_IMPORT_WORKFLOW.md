# Daily Price and Stock Imports

Location: `/admin/products#stock-import` (expand the prices and stock section).
Available to the existing general catalog roles: MANAGER, ADMIN, SUPER_ADMIN.
Session authorization also applies to every preview and apply request.

## Workflow

1. Choose stock only (default), both prices and stock, or prices only.
2. Select XLSX, XLS, CSV, or TSV and run the preview. This performs no writes.
3. Inspect recognized columns, before/after values, warnings, and skipped rows.
4. In stock-only mode (and `all` mode for an accounting stock report), use the
   reconciliation search and filters. All recognized rows are available on pages
   of 50 items, along with catalog items absent from the file. Matching quantities
   are hidden by default. Select checked rows individually or select all eligible
   rows in the current filtered list, including other pages. Download the full CSV
   if needed. Other price import modes retain the 100-row sample and full CSV.
5. Apply and confirm the number of selected products. Review the final outcome
   report. Unsafe rows cannot be selected; absent products are never zeroed.

See `STOCK_RECONCILIATION.md` for the Russian operating instructions.

New products still use the separate existing full catalog import. Daily imports
do not change descriptions, photos, categories, brands, or product names.
Products absent from the file and fields with blank cells remain unchanged.

The download link provides a blank Excel (`.xlsx`) template with five separate
Russian headers: SKU, name, price, stock, availability. Enter data starting in row
2. The SKU input cells in the first 1,000 data rows use text formatting, preserving
leading zeroes and long identifiers. For longer files, extend the text format.
The older CSV URL is retained with a UTF-8 BOM and explicit `sep=;` for Excel.

## Matching and Validation

The daily importer also accepts the original accounting stock report directly:
a stock-report title above a header with `Номенклатура`, `Ед.изм` and `Количество`.
Only item rows with a unit are imported; groups and totals are excluded. Selling
prices and valuation columns are never imported from this format, even in `all`
mode. Price-only mode skips report rows. Without a SKU, matching still requires a
unique normalized full product name. Fractional quantities are reported as skipped,
not rounded or written to the integer stock field. Absent products stay unchanged.
This detection is enabled only for the daily importer, not full catalog import.

- SKU matching preserves leading zeroes and meaningful punctuation. Excel must
  store long SKUs as text: digits already lost by Excel cannot be recovered.
- An unknown supplied SKU never falls back to a matching name. Without an SKU,
  only a unique normalized name match is accepted and marked in the report.
- Ambiguous catalog matches and all repeated file rows for a product are skipped,
  including duplicates across sheets. Separate warehouse rows are not summed.
- Invalid, negative, overflowing numeric values and fractional stock are reported.
  Prices retain the existing parser's integer-currency rounding behavior.
- Numeric stock determines availability, overriding a contradictory text status.
  Zero stock means out of stock. Availability alone can be updated when no quantity
  is supplied. Price-only mode never changes availability or quantity.
- CSV/TSV supports UTF-8, BOM-marked UTF-16 LE/BE, and Windows-1251 fallback.
  CSV report cells are escaped and formula prefixes are neutralized.

## Concurrent Changes and Failures

The preview fingerprint covers the file bytes, mode, and proposed plan including
product update timestamps. Apply reparses and reads current product data. A stale
fingerprint returns a fresh preview without writes and requires confirmation again.
Writes also check `updatedAt` to avoid replacing intervening edits.

Writes use transactions of up to 100 products, not one transaction for the entire
file. The report distinguishes successful rows, concurrent conflicts, and errors.
After an uncertain database/network failure, run preview again to reconcile the
actual current values. Retrying an old fingerprint cannot silently reuse an old
preview. No automatic whole-file rollback or persisted import history is provided.

## Limits and Scope

- Existing parser limit: 20,000 recognized rows. Truncation and ignored data are
  surfaced through parser warnings; rows beyond that limit are not in the report.
- Existing application file check: 100 MB. Hosting/request limits can be lower.
  Preview and apply each upload the selected file; split large files as needed.
- Column recognition uses the existing shared parser; manual mapping is not added.
- Inventory valuation reporting still belongs to the existing full import path.
- No schema migrations, production data writes, or Telegram changes are required.

## Verification

`tests/stock-import.test.mjs` tests parsing, leading-zero and long SKUs, encodings,
mode isolation, blank cells, duplicates, invalid values, name matching, CSV report
escaping, access roles, stale previews, replay, optimistic conflicts, batch errors,
and full reports beyond the UI sample limit. Database writes are stubbed in tests.

Reconciliation tests additionally cover exact fractional quantities and report units,
missing/unknown/ambiguous products, stock-only price protection, mandatory validated
selection, and stale fingerprints. `tests/stock-reconciliation-ui.test.mjs` exercises
pagination, dataset-wide search, filtered bulk selection, selection persistence and
read-only outcomes using component event handlers. The customer report dated
October 5 was parsed read-only: 2,041 product quantities matched the raw source
cells exactly, including 147 fractional quantities. No production stock was changed.

Browser QA used a temporary local fixture with real parsing and no database writes.
Checked preview, all modes, mode/file invalidation, cancel/confirm, pending controls,
report download, recognized columns, unknown-only files, network failure/retry,
and no outer horizontal overflow at 1440, 390 and 320 px. The fixture route was
removed after QA. A representative customer file and real DB integration remain
separate validation steps before an actual stock update.
