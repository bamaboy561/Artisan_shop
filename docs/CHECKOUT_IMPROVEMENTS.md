# Pickup Checkout and Repeat Orders

Local implementation verified on 2026-09-29. Deployed to production on 2026-09-30.

## Behavior

- Online orders are pickup-only. The server ignores legacy delivery/city fields,
  stores `deliveryMethodId: null`, and always charges zero delivery cost.
- Name and phone are visible. Email, company, promo code, and comment are optional
  and collapsed. Existing validation and entered values survive failed submissions.
- The mobile checkout has a fixed total and submit button instead of the bottom
  navigation. Desktop has a two-column summary.
- Account order history offers repeat purchase. It reads the existing customer
  order scope and current public product data, not historical prices.
- A preview shows unavailable products, partial stock, and quantities already in
  the cart. The customer explicitly confirms the available additions.
- Before adding, the cart fetches current prices/stock again. Price changes or
  insufficient stock reject the whole batch without clearing or partially changing
  the cart. Final inventory reservation still happens in the checkout transaction.
- Product promotions, bonus limits, pending accrual, comments, and the existing
  order-created notification call remain in the server checkout flow.

## Verification

- `npx tsx --test tests/*.test.ts tests/*.test.mjs`: 42 passing tests.
- `npm run typecheck`: passed.
- Scoped ESLint and Prettier checks: passed.
- `npx next build` with demo mode and schema push disabled: passed.
- Playwright at 320, 390, and 1440 pixels: field visibility, pickup-only controls,
  required fields, reopening an invalid hidden email field, preserving comments,
  profile autofill, bonus caps, mobile submit placement, stock blocking, network
  failure/retry, empty cart, and successful clear/redirect.
- Repeat-order dialog: partial/missing products, existing cart quantities, changed
  prices, double-click protection, success, and narrow-screen layout.
- Real checkout shell was checked with its header and hidden mobile bottom nav.
- Server actions were tested with explicit I/O stubs, including owner-constrained
  queries, invalid/guest access, stock reservation failure, preserved comments,
  product promotion discounts, and bonus ledger calls.

Temporary development-only UI fixtures were removed before the production build.
No real order was submitted, no real notifications sent, and no production customer
data changed. Live authenticated order repeat and real database checkout still need
a post-deployment smoke test with an agreed test account/order.

## Release Notes

No database migration, environment variable, Telegram webhook, or role change is
required. Deploy through the existing release workflow after reviewing the complete
working tree, which contains other work. Do not run a schema push for these changes.

A release rollback restores the previous frontend and action implementation; this
feature does not rewrite existing orders. New pickup orders use the already-supported
null delivery method and remain readable by the previous version.

## Production Release (2026-09-30)

- Site: https://artisan.shop.kg.
- Deployment: `dpl_32RoPen7N8dXEaqkzjtm37Zqd1iX`.
- Candidate: https://artisan-shop-vercel-a2tl1ohj8-bamaboy561-4380s-projects.vercel.app.
- Rollback: `vercel promote dpl_76K6cDNYdsS76xgkbTPBp1di5dYE --yes`.
- Compared local source SHA-1 hashes with the previous deployed source. Changed
  existing files and new application files are limited to checkout, repeat orders,
  the cart provider, and checkout-specific header navigation. Other deployed
  server source, including Telegram and loyalty, is unchanged.
- Re-ran 42 unit tests and type checking. Remote production compilation, TypeScript,
  and static generation passed. Logs confirm `Prisma db push skipped.`
- Built with `ARTISAN_RUN_PRISMA_PUSH=0`, `ARTISAN_DEMO_MODE=false`,
  `ARTISAN_PRODUCTION_PLANNING=false`, and `ARTISAN_STOREFRONT_DESIGN=premium`.
  Runtime demo/planning flags are false and the premium storefront is retained.
  No database migration, seed, saved secret, webhook, or role change was made.
- Candidate was created with `--skip-domain`. Its browser URL required Vercel SSO;
  deployment protection was not changed. After successful build and local checks,
  promoted the candidate and verified it on the custom domain. Vercel inspection
  confirms `artisan.shop.kg` maps to the READY deployment above.
- Live browser checks: empty checkout, header search for SKU 9073663, quick add of
  two units, manual cart quantity changes and decrement, guest checkout, optional
  fields, comment preservation when collapsing/reopening, free pickup, and loaded
  product images. Two units at 242 KGS total 484 KGS consistently.
- Added a real promoted product to the isolated browser cart, without submitting:
  150 KGS regular price, 90 KGS sale price. Checkout shows 634 KGS before discount,
  minus 60 KGS promotion discount, and 574 KGS final total for the combined cart.
- Checkout visually inspected at 320, 390, and 1440 px, with no horizontal overflow
  or overlapping bottom navigation. Screenshots are local-only under
  `.artisan-runtime/checkout-production-320.png` and `checkout-production-1440.png`.
- Home and the eleven brand links render. Unauthorized order history and production
  pages redirect to login with their respective `next` destinations.
- No captured JavaScript exceptions or failed HTTP responses in the tested purchase
  flow. The new deployment's 5xx log query returned no entries during verification.
  Error-level entries inspected contain the existing pg SSL-mode deprecation warning.
- No order was submitted and no customer/bonus data was modified. Live authenticated
  repeat purchase, actual checkout persistence, bonus settlement, and Telegram
  delivery still require an agreed test account/order; they are not signed off by
  this read-only production smoke test.
