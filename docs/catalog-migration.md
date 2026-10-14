# Product catalog migration (draft)

The existing `Product` collection contains seven older category pages and is used by the current website. This change adds separate `Catalog product` and `Product category` collections. It does not change or delete the old collection, publish an entry, import data on startup, or alter API permissions. The new collections have Draft & Publish and HU/RO localization.

## Editorial fields

- Product code is the stable identifier; the HU and RO records are one localized product. Slugs, names, introductions, category copy, usage, benefits, and SEO text are editable per language.
- Availability has `in_store` and `preorder` values. A missing value remains blank until editorial confirmation.
- Forms and packaging are repeatable fields. Each form may later receive an image from the existing Cloudinary-backed Strapi Media Library and localized alternative text. No image is required to save a draft.
- The nutrition source contains Romanian labels with numeric values, not paired translations. It is kept as a shared source field. The website must render localized labels or the data must be translated before HU publication.
- PDF filenames are references from the spreadsheet only. `labelPdf` is empty until the files are actually uploaded or linked; a filename must never be presented as a working download.
- Related product codes are kept as stable references and must be resolved to published products by the website; invalid/unpublished references should not render links.

## Source preparation

`python3 scripts/prepare-catalog.py /path/to/workbook.xlsx` regenerates a local, ignored `data/catalog-import-draft.json` (requires `openpyxl`). The export has 7 categories, 52 unique product codes, and a `review` array. Its `publicationState` is `draft`; the file is **not** a Strapi API payload and is not auto-imported. The original spreadsheet remains the editorial source until the import is approved. Do not commit the unpublished content to this public repository.

Current review items include a missing sheep-product slug, duplicate HU/RO turkey slugs, absent Romanian ingredients for one chicken product, two missing Romanian image alt texts, five raw materials with no availability, and incomplete technical fields for calcium products. Images are intentionally absent for all 52 products. Resolve the review items and verify both locales before publishing individual products.

## Rollout

1. Deploy the additive schema to a staging Strapi instance with a copy of the database and verify the two new content types in Content Manager. The old seven Product entries and blog entries should still be readable.
2. Review the draft export, correct source issues, and import by product code into the new collections. Link HU/RO localizations and category relations; leave entries in draft. Make imports idempotent and produce a per-product audit before any production run.
3. Point a website preview at the new collections using a server-side read-only API token. Keep existing pages live until the new category and product routes, SEO, 404 behavior, and both locales are checked. Do not put that token in a `NEXT_PUBLIC_` variable.
4. Publish only reviewed entries, switch website routes, and retain the old Product collection until rollback is no longer needed. Cloudinary media stays in the existing account.
