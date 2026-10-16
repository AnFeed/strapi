# Catalog admin-only release

This release adds two separate localized collection types, catalog products and
catalog categories, and their form/package components. The existing Product,
Blog and all other existing models, routes and content remain unchanged.

New collections start empty. Entries support draft/publish. There is no import,
sample-content creation, API-token setup, public-role modification, new account,
frontend change, dependency upgrade or environment-variable change in this PR.

## Editor layout

By default the optional layout setup is off. Set `CATALOG_EDITOR_SETUP=1` only
for an approved rollout of bilingual field labels and ordered fields on the two
new collections and their two components. It writes only their Content Manager
view configuration. A stored version marker preserves later manual view edits.
Turn the flag off after verification. A layout error is logged without blocking
CMS startup. It does not suppress model/database startup failures.

An existing administrator can use the new collections according to their role.
No administrator roles or permissions are automatically changed. Verify access
with the existing account during acceptance.

## Rollout gate

Do not merge or deploy this draft without explicit approval for a Strapi
production rollout. Adding models still synchronizes database schema at startup
and requires a deployment; a new menu entry cannot be guaranteed to have zero
operational impact. Keep the website reading its existing data sources.

Before rollout, verify a current database backup and restore test, preserve the
current code/deployment reference, and arrange a low-traffic rollout window.
After startup, verify CMS health, existing HU/RO Product and Blog endpoints,
existing admin login, the two new empty collections and anonymous 403 responses
for both new API routes. Create any acceptance entry as a draft using the admin
UI only after approval. Keep new Public and Authenticated role grants disabled;
do not issue a frontend token or connect the website during this phase.

Existing full-access API tokens retain their usual ability to read all models;
this PR does not broaden or create any token. Public access and existing
credentialed access must be reviewed separately.

For rollback, avoid starting either old or new model code against a database
without assessing schema synchronization. Restore the pre-release backup to a
new database and use the matching pre-release code; preserve the failed state
for recovery of any intervening content edits. Follow the private backup's
restore guide. Code rollback alone is not a database rollback.

## Validation

Run `node scripts/check-catalog-schemas.cjs`,
`node scripts/check-catalog-lifecycles.cjs` and
`node scripts/check-catalog-editor.cjs` from the repository root.
The model definitions are unchanged from the separately tested catalog branch.
The native admin editing flow and this reduced release's deployed startup must
be verified in a test environment before production rollout.
