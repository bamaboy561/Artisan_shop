# Storefront performance: 2026-09-30

## Scope and release status

Deployed to https://artisan.shop.kg on 2026-10-01 after local verification.
No database, orders, loyalty, production workflow, or Telegram changes were made.

The working tree contains earlier releases and unrelated work. Do not revert
whole files or deploy the entire tree without reviewing the release scope.

## Baseline observations

Measured https://artisan.shop.kg with fresh Chromium contexts, a 390 x 844
viewport, and service workers blocked. These are single unthrottled lab runs,
not Lighthouse scores or field Core Web Vitals.

| Page    |   TTFB | Last observed LCP | Response body bytes | Requests |
| ------- | -----: | ----------------: | ------------------: | -------: |
| Home    | 295 ms |          1,568 ms |           3,024,715 |       61 |
| Catalog | 577 ms |          2,152 ms |             509,146 |       64 |

The home page's LDSP category thumbnail fetched a 2,242,185-byte original from
nt73.ru: 2,500 pixels wide, displayed at 170 pixels. Catalog product images
were already optimized, generally around 3-6 KB in this run. The home hero
was approximately 157 KB and was left unchanged.

The live layout preloaded eight font files; the catalog run downloaded nine
font files in total, including on-demand fonts. The catalog also rendered
content inside fourteen closed dialog shells before interaction.

## Changes

- Allow Next Image optimization for HTTPS nt73.ru images under /userfiles/.
  The tested thumbnail returned HTTP 200 at width 256 and 6,093 response bytes.
  This is a resource-size comparison, not a predicted whole-page speedup.
  Originals remain intact. ProductImage still falls back to the original when
  optimization fails. Existing AGT and Hettich bypasses remain unchanged.
- Preload only the Latin Unbounded subset used by the ARTISAN wordmark;
  disable IBM Plex Mono preloading. Manrope remains unchanged. Other subsets
  remain available on demand. The final local production build preloads three
  font files. Fonts used by lower-page content can still load normally.
- Mount dialog contents only while open. Keep the native dialog element so
  closing, focus restoration, and scroll locking retain their behavior.
  Full-size gallery originals are requested when the viewer opens.

## Verification

- 47/47 tests passed, including five new image/dialog regression tests.
- Scoped ESLint and Prettier checks passed.
- Typecheck and production build passed with demo mode enabled and schema
  pushes disabled. The temporary fixture route was removed before building;
  its final-build response is 404.
- Browser checks used the actual components on a temporary local fixture
  page, with cart API responses mocked only in the test browser.
- Quick add: manual quantity, successful addition, reset on reopening, stock
  clamping, full-stock disabling, HTTP 503 feedback, and successful retry.
- Filters: selection after navigation, preserved selection after reopening,
  reset, and closing. Menu: opening and closing.
- Gallery: loaded originals, previous/next images, arrow keys, thumbnails,
  reopening, and Escape. Image optimizer HTTP 503 was simulated; the original
  loaded successfully at natural width 2,500.
- Dialog closing via button, Escape, and backdrop restored body scrolling;
  focus returned to the quick-add trigger. Closed dialog bodies were empty.
- Visual checks covered 320, 390, and 1,440-pixel viewports. No observed
  horizontal overflow, clipped dialog controls, broken loaded images, or
  uncaught application JavaScript errors. Final-build home was reviewed on
  mobile and desktop; Cyrillic labels remained readable.

No real orders or customer messages were created. Authenticated repeat-order,
loyalty, and Telegram flows were not live-tested. Local demo data and production
data differ, so local full-page timings are not compared with the live baseline.

## Deployment and rollback

Production deployment: `dpl_8aTGcoM2a6bMQKpKtaX5Fu6eoUc4`.
Previous production: `dpl_32RoPen7N8dXEaqkzjtm37Zqd1iX`.
Rollback command: `vercel promote dpl_32RoPen7N8dXEaqkzjtm37Zqd1iX --yes`.

Release checks:

- Compared 358 local source/assets files with the previous deployed source
  hashes. Only the four performance implementation files, tests, and release
  documentation differ; no missing deployed application files were found.
- Re-ran 47 tests successfully. The remote production build, TypeScript check,
  and static generation passed. Build logs confirm `Prisma db push skipped.`
- Built with `ARTISAN_RUN_PRISMA_PUSH=0`, demo mode and production planning
  disabled, and the premium storefront retained. No saved secrets, webhook,
  database schema, seed, or role settings were changed.
- Built with `--skip-domain`, then promoted after successful compilation.
  Vercel inspection confirms artisan.shop.kg resolves to the READY deployment
  above. The deployment's 5xx log query for the preceding five minutes returned
  no entries immediately after promotion; this is not a traffic/load test.
- Post-deployment browser flows and cold/warm page measurements were not rerun
  in this release step. Browser evidence above is from the local verification.
  The existing pg SSL-mode deprecation warning remains unchanged.

To reverse only this performance work, restore the previous font preload
settings, remove the nt73.ru additions from both image allowlists, and render
StorefrontDialog contents unconditionally again. Do not replace these files
wholesale: they contain earlier functionality and unrelated changes.
