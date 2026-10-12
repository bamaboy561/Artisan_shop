# Premium storefront rollout

## Scope

Public layout, home, catalog, category and product pages use the new
`features/storefront` components. They read the existing public catalog and use
the existing cart provider, purchase buttons and favorite server action.
The design-preview snapshot and its trial cart are NOT used in production.
The old public page render paths remain available.

No schema migration, bonus configuration, order processing or Telegram changes
are part of this design rollout. Production source hashes were compared with the
workspace on 2026-09-28. Existing differences outside these five routes are public
catalog/cart UI improvements from the preceding work. The order, loyalty and
Telegram server files match the previous deployment.

## Baseline / rollback

Production before this release (verified 2026-09-28):

- Deployment: `dpl_9ZomsSVmBPzQg3YTPBEt1YkP3o79`
- URL: `https://artisan-shop-vercel-1siths8lo-bamaboy561-4380s-projects.vercel.app`
- Project: `artisan-shop-vercel`
- Domains: `artisan.shop.kg`, `www.artisan.shop.kg`

For an immediate full-release rollback, use Vercel's rollback operation to the
baseline deployment. Do not rebuild an arbitrary historical Git revision: the
workspace contains existing uncommitted work.

For an appearance-only fallback, set `ARTISAN_STOREFRONT_DESIGN=classic` in BOTH
build and runtime environments and redeploy. A rebuild is required because some
public pages are prerendered. The default and `premium` enable the new design.

Always set `ARTISAN_RUN_PRISMA_PUSH=0` for this release. Do not run `db push` or
`db:production:prepare`. Preserve all existing runtime secrets and the webhook.
Deploy with `--prod --skip-domain`, verify, then explicitly promote the candidate.

## QA inventory

- Home: hero next/previous, all category and brand links, Albero logo, services,
  contact links. Inspect top viewport and brand grid at desktop and mobile sizes.
- Header: desktop/mobile SKU search, menu open/close, account, favorites, real
  cart count, mobile navigation; no duplicate overlapping controls.
- Catalog: real total and pagination, category, brand/decor/thickness/stock
  filters, sort including effective promotional prices, grid/list, reset,
  empty search, URL/back navigation, long SKUs and long product names.
- Product: actual price/old price, full SKU, images next/previous/zoom/close,
  quantity typing and bounds, add to real cart, recommended bundle components,
  specifications/description tabs and keyboard access.
- Cart: add, edit, remove, reload persistence, quantity limited by actual stock,
  price consistency and navigation to checkout. Do not submit live orders.
- Regression: calculator, brands, account/login, old design flag, preview 404
  in production; no new JS errors or horizontal overflow at 1440, 390 and 320 px.
- Exploratory: zero-result combinations, stale page index, no-price/out-of-stock
  items and quantities greater than available stock.

## Checks completed before candidate deployment

- TypeScript: passed.
- ESLint for storefront and five touched public routes: passed.
- Optimized Next.js build: passed.
- Unit tests: 14/14 passed (cart limits/storage and storefront filters/rollback).
- Local desktop/mobile home, menu and search: passed. Local database credentials
  are unavailable, so live catalog integration must be checked on the candidate.

## Browser verification

Verified on the candidate against the real catalog before promotion:

- 1,858 products, 12 items per page; second page and empty-search reset work.
- SKU search finds `9073663`, `11412030YQ` and `EKS.2170.016.080.B00138`.
- Mobile brand, thickness, availability and price-sort filters compose in the
  URL. Albero + 18 mm + in-stock returns 49 matching products.
- Grid/list switch, header category navigation, gallery next/previous,
  full-size gallery, Escape close, product tabs and favorite login redirect work.
- Adding three brackets and one recommended support yields 72 KGS. Editing
  brackets to five yields 110 KGS; quantities persist after reload.
- Promotional handle retains its 90 KGS price instead of 150 KGS in the cart;
  the 60 KGS discount and 200 KGS combined total are correct.
- Checkout opens and shows the same cart total. No live order was submitted.
- All 11 brand links return HTTP 200 and all 11 logos load without fading.
- Calculator loads its existing materials; production design-preview returns 404.
- Desktop 1440 px and mobile 390/320 px visual checks passed, with no horizontal
  overflow. No JavaScript page errors were observed during these checks.

Privileged admin workflows, bonus mutations, Telegram delivery and real payment
or order submission were not exercised: their server code was unchanged, and
the rollout did not mutate live business data. Quantity limits and the classic
design flag are additionally covered by the unit tests above.

## Release status

Promoted on 2026-09-28 after candidate verification:

- Deployment: `dpl_7LvKQbBYvPmaHm49jzXRewk43kgL`
- URL: `https://artisan-shop-vercel-p3f68s1of-bamaboy561-4380s-projects.vercel.app`
- Production: `https://artisan.shop.kg`
- Build explicitly skipped Prisma schema push.

Post-promotion smoke test used a fresh unauthenticated browser context on the
public domain: home returned HTTP 200 with the new design and loaded hero;
header search for `9073663` returned the correct Hettich product. No page errors
were observed. The baseline deployment above remains the rollback target.

## Follow-up preview: live search and quick purchase

Implemented on 2026-09-28, not promoted to the public domain:

- Preview deployment: `dpl_12jHXARNBzVZX8MxXuujz4VxsbxL`
- URL: `https://artisan-shop-vercel-jflc4krs9-bamaboy561-4380s-projects.vercel.app`
- Vercel authentication may be required to open the preview.
- Both preview builds explicitly skipped Prisma schema push. No environment
  variables, Telegram configuration, orders or loyalty records were changed.

Scope and QA inventory:

- Header suggestions: five products maximum; image, full SKU, effective
  promotional price and availability; keyboard selection, Enter navigation,
  Escape, clear, outside click, retry, empty state and mobile touch navigation.
- Catalog quick purchase: manual quantity, plus/minus, subtotal, existing cart
  quantity, fresh server stock validation, pending state and success feedback.
- Exceptional cases: delayed obsolete search response, unavailable search,
  inventory reduced after opening a card, repeated submission, entire remaining
  stock added, quantity below one and above the remaining per-item limit.
- Visual states: desktop dropdown and purchase dialog; mobile search, long SKU,
  purchase dialog and confirmation at 390 and 320 px.

Verification completed:

- TypeScript, scoped ESLint, local production build and final preview build pass.
- All 18 unit tests pass, including four new quick-purchase stock-limit tests.
- Real search finds `9073663` and `EKS.2170.016.080.B00138`; keyboard and touch
  selection open the corresponding product. Normal Enter opens the full catalog.
- Search debounce, stale-response protection, clear, outside click, retry and
  empty states pass using browser-intercepted responses on the local server.
- Manual entry of 20 hinges adds 20 with one confirmation. Min/max controls and
  remaining capacity after prior additions are respected. Escape restores focus.
- Three promotional handles at 90 KGS produce a 270 KGS cart total and 180 KGS
  promotion discount. Quantity remains three after reloading the cart.
- Browser-intercepted stock reduction rejects an excessive request without
  changing the cart; double clicking sends one addition request. Adding the last
  two units retains the 180 KGS subtotal and the success confirmation.
- Final preview was rechecked after the confirmation fix, including a real
  two-hinge addition totaling 484 KGS and mobile touch search navigation.
- Reviewed screenshots and geometry show no horizontal overflow or clipped
  controls at 1440, 390 and 320 px. No page JavaScript errors were observed.

No live orders were submitted. Privileged account/admin workflows, real payment,
Telegram delivery and loyalty mutations were not part of this follow-up QA.
