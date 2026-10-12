# Catalog Excel Export

Location: `/admin/products`, button `Скачать каталог Excel` next to import.
Endpoint: `GET /api/admin/products/export`.
Requires an active authenticated MANAGER, ADMIN or SUPER_ADMIN session.
Responses are private and uncached; disabled accounts fail current session checks.

The XLSX contains three worksheets:

- `Товары`: all products, including drafts and archives, sorted by category path,
  name and SKU. Includes IDs, exact text SKUs, root group, direct category, full
  category path, brand, current stored prices, stock, statuses and dimensions.
- `Категории`: every category including empty ones, parent ID/name, full path,
  kind, order and the number of products assigned directly to the category.
- `Бренды`: every brand including empty ones and its direct product count.

All queries run in one read-only RepeatableRead snapshot. No page filters,
pagination, published-only restriction or silent record limit is applied.
If the Excel row limit is exceeded, export fails rather than truncating data.
Numbers stay numeric, empty values stay empty and zero stays zero. Text values
are not converted to formulas. IDs and SKUs use text cells and text formatting.

The `Проверка` column marks cycles, missing category/brand references and missing
or repeated SKUs. Existing category assignments are preserved, not inferred from
product names or changed by the export. Blank means these structural checks found
no issue, not that the merchandising assignment was independently validated.

This is a catalog inventory report, not a database backup or a full-import
round-trip format. It does not export orders, clients, photos as binaries or all
product-related entities, and should not be uploaded unchanged to full import.
Prices are the product's stored prices, not a customer's personalized or
promotion-adjusted checkout prices. No database writes or schema changes occur.

Verification: `tests/catalog-export.test.mjs` covers saved XLSX content, exact SKU
types, paths, empty groups/brands, all statuses, more than one page of products,
stable ordering, structural problems, formula-like names, authorization, response
headers, errors and unpaginated consistent-snapshot queries. Database is stubbed.
