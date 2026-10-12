# Production workspace, phase 1

Phase 1 was deployed to production on 2026-09-29 with deadline planning disabled. It leaves station transitions, Telegram delivery, loyalty and sales untouched. Production action redirects now preserve queue filters.

## Scope

- Manager station tabs, client/material/number search, inclusive created-date filters in Asia/Bishkek.
- Stable chronological ordering, optional reverse/deadline ordering, 25 requests per page with direct page navigation.
- Responsive table/list and compact phone operator details with station action before the route.
- Production staff get a compact dedicated shell; other administrator and customer layouts remain unchanged.
- Internal planned readiness date, manager-only editing, optimistic version checks and transactional audit logging. This date is not a promised customer deadline and sends no notification.
- Camera search retains filters. Closing during camera startup stops late-arriving streams.

## Safe enablement

`ProductionPlan` is a separate optional table. Existing Request scalar columns are unchanged. With `ARTISAN_PRODUCTION_PLANNING` unset, no production planning query is issued against a configured database. The rest of the queue continues to work.

Before enabling deadlines on any real environment:

1. Back up the database. Apply `prisma/sql/production-planning.sql` against the intended database only, using a reviewed connection. Do not run a broad `prisma db push` for this feature.
2. Set `ARTISAN_PRODUCTION_PLANNING=true` in that environment.
3. Check manager save/clear, a simultaneous edit conflict, operator denial and the audit event against the staging database.
4. Review with production staff before a production deployment. Disable the flag to stop deadline queries without deleting data; restore the previous deployment for a full UI rollback.

If the feature is enabled before the table exists, planning controls are disabled and the server logs the schema failure. Deadline saves fail visibly, never report success after a failed write. Database update and audit insert share a transaction.

## Local preview

Run only in explicit demo mode. `scripts/seed-production-preview.ts` adds 126 identified demo records without replacing existing records. It does not access the database. Local writes use `.artisan-runtime/production-plans.json`; this is development-only, not a multi-instance production store.

## QA inventory

- Desktop 1440px: readable table, dates, quantities, manager, status, deadline and files; no page overflow.
- Phone 390px and 320px: readable cards/controls; operator primary action before the route; no horizontal overflow.
- Search, station tabs, date range, sort, due filters, reset, pagination beyond 100 and direct page jump.
- Filter state survives opening an order, searching and returning; invalid return targets are discarded.
- Deadline save, clear, journal entry, stale concurrent edit, invalid date, closed order and operator denial.
- Camera unavailable/denied state, close-during-startup cleanup; actual phone camera scan requires a device check.
- Existing cart/catalog tests, typecheck, scoped lint, optimized build.

## Verification commands

```text
npm run typecheck
npx tsx --test tests/*.test.ts
npx tsx --tsconfig tests/tsconfig.server.json --test tests/production-planning.integration.ts
npx eslint features/production app/admin/production lib/server/production-workspace.ts lib/server/production-planning.ts
npx next build
```

## Verification results (2026-09-29)

- Unit tests pass, including existing storefront/cart coverage and production filter/permissions coverage.
- Isolated demo-storage integration checks pass: persistent deadline and actor audit, clearing, idempotency, concurrent stale edit rejection, invalid input, denied operator, closed/missing request, chronological sorting, date search and pagination beyond 100.
- Browser checks pass: manager deadline save and second-tab conflict; returning preserves search/station/date filters; page 5 and 6 are accessible with 127 demo/local records. Demo fixtures are clearly numbered `ДЕМО-*`.
- Phone operator views checked at 390x844 and 320x740; no horizontal overflow, no manager deadline controls, foreign station is read-only, forged station query does not escape the assigned station. Permission-denied camera message and mobile menu Escape behavior verified.
- PostgreSQL migration and database transaction path have NOT been executed against a staging or production database. Real QR scanning with a phone camera still needs a device test. Existing stage transitions/notifications were not changed or reverified end-to-end against live services.
- No production deployment or production data mutation performed.

## Production release (2026-09-29)

- Production: https://artisan.shop.kg, workspace: https://artisan.shop.kg/admin/production.
- Deployment: `dpl_76K6cDNYdsS76xgkbTPBp1di5dYE`, candidate: https://artisan-shop-vercel-krwammznr-bamaboy561-4380s-projects.vercel.app.
- Rollback deployment: `dpl_7LvKQbBYvPmaHm49jzXRewk43kgL`.
- Created a production candidate with `--skip-domain`, checked it, then promoted it. Confirmed the custom domain maps to this deployment through the Vercel API.
- Build explicitly used `ARTISAN_RUN_PRISMA_PUSH=0`; logs confirm schema push was skipped. No SQL migration, seed or live order mutation was run. Demo runtime files were excluded from upload.
- `ARTISAN_PRODUCTION_PLANNING=false` is explicit for build and runtime. Queue, search, creation-date filters, pagination and mobile staff UI are released; planned deadlines and overdue filters are NOT enabled.
- `ARTISAN_STOREFRONT_DESIGN=premium` is retained. Previously previewed header live search and catalog quick purchase are included.
- Re-ran all 25 unit tests and the isolated demo integration suite (6 reported tests); Vercel production compilation and TypeScript passed.
- Candidate/browser checks: home images, 1858-product real catalog, SKU search, 11 brand links, empty search, mobile layout and unauthenticated production redirect. Post-promotion browser checks on the custom domain: SKU 9073663, mobile product images, no horizontal overflow, production login redirect, no captured JavaScript exceptions.
- Server source hashes were compared against the prior production deployment. Existing Telegram, loyalty, checkout and other existing server files matched except the reviewed catalog/production-workspace changes and production action redirects. Environment secrets and webhook settings were not changed.
- Examined runtime error-level entries showed the existing pg SSL-mode deprecation warning with HTTP 200, not application exceptions. No live Telegram delivery or authenticated production-role workflow was exercised. Real phone QR scanning and real PostgreSQL planning migration remain pending.
- Full UI rollback: `vercel promote dpl_7LvKQbBYvPmaHm49jzXRewk43kgL --yes`. No database rollback is needed for this release because no schema/data migration was run.
