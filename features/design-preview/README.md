# Artisan design preview

Local entry: http://localhost:3001/design-preview

This is an isolated design experiment, not a replacement for the shop.

- Routes return 404 outside development, including production builds.
- No shop page, database schema, Telegram handler or loyalty code is changed.
- Cart and favorites are in-memory state belonging to PreviewShell only. There
  are no order submissions, database writes, shared cart storage or payment calls.
- products.json is a small snapshot of publicly visible catalog information,
  not live inventory. Do not use it to fulfill orders.
- Images come from existing public Artisan pages. image-sources.json records
  their original locations. Optimized WebP copies are local preview assets.

## Reverting the experiment

The experiment adds only these directories:

1. app/design-preview
2. features/design-preview
3. public/design-preview

Removing just these new directories removes the preview. Existing shop files
do not need reverting. Do not reset the repository: it has unrelated work.

The preview must be approved and migrated deliberately before any production
release. Never replace live product information with this snapshot.
