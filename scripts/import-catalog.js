#!/usr/bin/env node
"use strict";

/**
 * Import the private catalog draft into an isolated Strapi 4 environment.
 *
 * Safety defaults:
 *   node scripts/import-catalog.js                 # validation only, no writes
 *   node scripts/import-catalog.js --apply         # create/update drafts
 *
 * Required env:
 *   STRAPI_URL=https://your-staging-strapi.example
 *   STRAPI_API_TOKEN=<write-capable staging token>   # only for --apply
 *
 * Additional write guards required for --apply:
 *   CATALOG_IMPORT_TARGET=staging
 *   CATALOG_IMPORT_EXPECT_HOST=<exact staging hostname>
 *
 * The script is idempotent by categoryCode/productCode + locale. It never
 * publishes entries, never touches the legacy Product collection, and never
 * uploads media. Product images and PDFs remain empty until linked separately.
 */

const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");
const DATA_PATH = process.env.CATALOG_IMPORT_FILE ||
  path.join(__dirname, "..", "data", "catalog-import-draft.json");
const BASE_URL = (process.env.STRAPI_URL || "").replace(/\/$/, "");
const TOKEN = process.env.STRAPI_API_TOKEN || "";
const IMPORT_TARGET = process.env.CATALOG_IMPORT_TARGET || "";
const EXPECT_HOST = process.env.CATALOG_IMPORT_EXPECT_HOST || "";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(DATA_PATH)) fail(`Catalog export not found: ${DATA_PATH}`);
if (!BASE_URL) fail("STRAPI_URL is required.");

let targetUrl;
try {
  targetUrl = new URL(BASE_URL);
} catch {
  fail("STRAPI_URL must be a valid absolute URL.");
}

if (APPLY) {
  if (!TOKEN) fail("STRAPI_API_TOKEN is required with --apply.");
  if (IMPORT_TARGET !== "staging") {
    fail("Refusing write: CATALOG_IMPORT_TARGET must be exactly 'staging'.");
  }
  if (!EXPECT_HOST) {
    fail("Refusing write: CATALOG_IMPORT_EXPECT_HOST is required with --apply.");
  }
  if (targetUrl.hostname !== EXPECT_HOST) {
    fail(
      `Refusing write: STRAPI_URL host '${targetUrl.hostname}' does not match ` +
      `CATALOG_IMPORT_EXPECT_HOST '${EXPECT_HOST}'.`
    );
  }
}

const source = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

if (!Array.isArray(source.categories) || !Array.isArray(source.products)) {
  fail("Invalid catalog export: categories/products arrays are required.");
}
if (source.review?.length) {
  fail(`Refusing import: ${source.review.length} content review item(s) remain.`);
}

const headers = {
  "Content-Type": "application/json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function request(method, pathname, body) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    throw new Error(`${method} ${pathname} -> ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function qs(params) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) p.set(key, String(value));
  }
  return p.toString();
}

async function findOne(plural, codeField, codeValue, locale) {
  const query = qs({
    locale,
    publicationState: "preview",
    [`filters[${codeField}][$eq]`]: codeValue,
    "pagination[pageSize]": 2,
  });
  const payload = await request("GET", `/api/${plural}?${query}`);
  const rows = payload?.data || [];
  if (rows.length > 1) throw new Error(`Duplicate ${plural} ${codeValue} (${locale})`);
  return rows[0] || null;
}

function categoryData(item, locale) {
  return {
    categoryCode: item.categoryCode,
    name: item.name?.[locale] || null,
    slug: item.slug?.[locale] || null,
    introduction: item.introduction?.[locale] || null,
    seoTitle: item.seoTitle?.[locale] || null,
    metaDescription: item.metaDescription?.[locale] || null,
  };
}

function productData(item, locale, categoryId) {
  return {
    productCode: item.productCode,
    category: categoryId,
    subcategory: item.subcategory?.[locale] || null,
    availability: item.availability || null,
    name: item.name?.[locale] || null,
    slug: item.slug?.[locale] || null,
    lifeStage: item.lifeStage?.[locale] || null,
    feedType: item.feedType?.[locale] || null,
    introduction: item.introduction?.[locale] || null,
    imageAlt: item.imageAlt?.[locale] || null,
    forms: item.forms || [],
    packages: item.packages || [],
    ingredients: item.ingredients?.[locale] || null,
    analyticalValues: item.analyticalValues || null,
    benefits: item.benefits?.[locale] || null,
    usage: item.usage?.[locale] || null,
    labelFileName: item.labelFileName || null,
    relatedProductCodes: JSON.stringify(item.relatedProductCodes || []),
    seoTitle: item.seoTitle?.[locale] || null,
    metaDescription: item.metaDescription?.[locale] || null,
  };
}

async function upsertBase(plural, codeField, codeValue, locale, data) {
  const existing = await findOne(plural, codeField, codeValue, locale);
  if (!APPLY) return { action: existing ? "would-update" : "would-create", entry: existing };

  if (existing) {
    const payload = await request("PUT", `/api/${plural}/${existing.id}`, { data });
    return { action: "updated", entry: payload.data };
  }

  // Strapi 4 creates a non-default locale by putting locale in the data object.
  const payload = await request("POST", `/api/${plural}`, { data: { ...data, locale } });
  return { action: "created", entry: payload.data };
}

async function createLocalization(plural, baseId, locale, data) {
  if (!APPLY) return { action: "would-create-localization", entry: null };

  // Strapi 4 localization endpoints do not use the normal { data: ... } wrapper.
  // Non-localized fields are copied from the base entry automatically.
  const payload = await request(
    "POST",
    `/api/${plural}/${baseId}/localizations`,
    { locale, ...data }
  );
  return { action: "created-localization", entry: payload?.data || payload };
}

async function ensureLocalizedPair(plural, codeField, codeValue, huData, roData) {
  let hu = await findOne(plural, codeField, codeValue, "hu");
  let ro = await findOne(plural, codeField, codeValue, "ro");
  const actions = [];

  if (!hu && !ro) {
    const created = await upsertBase(plural, codeField, codeValue, "hu", huData);
    actions.push(created.action);
    hu = created.entry;
    if (APPLY) {
      const localized = await createLocalization(plural, hu.id, "ro", roData);
      actions.push(localized.action);
      ro = localized.entry;
    } else {
      actions.push("would-create-localization");
    }
  } else {
    if (hu) {
      const result = await upsertBase(plural, codeField, codeValue, "hu", huData);
      actions.push(result.action);
      hu = result.entry || hu;
    } else if (ro) {
      const localized = await createLocalization(plural, ro.id, "hu", huData);
      actions.push(localized.action);
      hu = localized.entry;
    }

    if (ro) {
      const result = await upsertBase(plural, codeField, codeValue, "ro", roData);
      actions.push(result.action);
      ro = result.entry || ro;
    } else if (hu) {
      const localized = await createLocalization(plural, hu.id, "ro", roData);
      actions.push(localized.action);
      ro = localized.entry;
    }
  }

  return { hu, ro, actions };
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${source.categories.length} categories, ${source.products.length} products`);
  console.log(`Target: ${targetUrl.hostname}${APPLY ? " (write guards passed)" : " (read-only validation)"}`);
  if (source.pending?.length) {
    console.log(`Pending editorial decisions preserved as blank: ${source.pending.length}`);
  }

  const categoryIds = new Map();
  for (const item of source.categories) {
    const pair = await ensureLocalizedPair(
      "catalog-categories",
      "categoryCode",
      item.categoryCode,
      categoryData(item, "hu"),
      categoryData(item, "ro")
    );
    if (pair.hu?.id) categoryIds.set(`${item.categoryCode}:hu`, pair.hu.id);
    if (pair.ro?.id) categoryIds.set(`${item.categoryCode}:ro`, pair.ro.id);
    console.log(`category ${item.categoryCode}: ${pair.actions.join(", ")}`);
  }

  if (!APPLY) {
    console.log("Dry run complete. No data was written.");
    return;
  }

  // Refresh category ids after writes so relation targets are guaranteed current.
  for (const item of source.categories) {
    for (const locale of ["hu", "ro"]) {
      const entry = await findOne("catalog-categories", "categoryCode", item.categoryCode, locale);
      if (!entry) throw new Error(`Missing imported category ${item.categoryCode} (${locale})`);
      categoryIds.set(`${item.categoryCode}:${locale}`, entry.id);
    }
  }

  for (const item of source.products) {
    const huCategory = categoryIds.get(`${item.categoryCode}:hu`);
    const roCategory = categoryIds.get(`${item.categoryCode}:ro`);
    const pair = await ensureLocalizedPair(
      "catalog-products",
      "productCode",
      item.productCode,
      productData(item, "hu", huCategory),
      productData(item, "ro", roCategory)
    );
    console.log(`product ${item.productCode}: ${pair.actions.join(", ")}`);
  }

  console.log("Import complete. Entries remain drafts; media is unchanged.");
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
