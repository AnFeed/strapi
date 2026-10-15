'use strict';

const zlib = require('zlib');

const CATEGORY_UID = 'api::catalog-category.catalog-category';
const PRODUCT_UID = 'api::catalog-product.catalog-product';
const LEGACY_PRODUCT_UID = 'api::product.product';
const LOCALES = ['hu', 'ro'];

function fail(message) {
  throw new Error(`[catalog-staging-import] ${message}`);
}

function assertStagingTarget() {
  // Pin the sandbox identity; matching two caller-supplied values is insufficient.
  const allowed = {
    RAILWAY_PROJECT_ID: '1a0d10f2-c472-416d-972d-48de99a73c00',
    RAILWAY_ENVIRONMENT_ID: 'c899072a-069b-4712-958b-4dff2e9038ed',
    RAILWAY_SERVICE_ID: '1fbc432c-eba0-420b-9ff0-f3338666863d',
  };
  for (const [key, value] of Object.entries(allowed)) {
    if (process.env[key] !== value) fail(`refusing operation: unexpected ${key}`);
  }
  if (process.env.CATALOG_IMPORT_TARGET !== 'staging') {
    fail("refusing write: CATALOG_IMPORT_TARGET must be exactly 'staging'");
  }

  const expectedHost = process.env.CATALOG_IMPORT_EXPECT_HOST;
  const configuredUrl = process.env.URL;
  if (!expectedHost || !configuredUrl) {
    fail('refusing write: CATALOG_IMPORT_EXPECT_HOST and URL are required');
  }

  let hostname;
  try {
    hostname = new URL(configuredUrl).hostname;
  } catch {
    fail('refusing write: URL is not a valid absolute URL');
  }

  if (hostname !== expectedHost) {
    fail(`refusing write: URL host '${hostname}' does not match expected staging host`);
  }

  const expectedProjectId = process.env.CATALOG_IMPORT_EXPECT_PROJECT_ID;
  const railwayProjectId = process.env.RAILWAY_PROJECT_ID;
  if (!expectedProjectId || !railwayProjectId || railwayProjectId !== expectedProjectId) {
    fail('refusing write: Railway project does not match the explicitly allowed staging project');
  }

  const railwayEnvironment = process.env.RAILWAY_ENVIRONMENT_NAME;
  if (!railwayEnvironment || railwayEnvironment !== 'staging') {
    fail("refusing write: RAILWAY_ENVIRONMENT_NAME must be exactly 'staging'");
  }

  let databaseHost;
  try {
    databaseHost = new URL(process.env.DATABASE_PRIVATE_URL).hostname;
  } catch {
    fail('refusing operation: invalid database URL');
  }
  const expectedDatabaseHost = process.env.CATALOG_IMPORT_EXPECT_DATABASE_HOST;
  if (!expectedDatabaseHost || databaseHost !== expectedDatabaseHost ||
      !databaseHost.endsWith('.railway.internal')) {
    fail('refusing operation: database must be the staging private Postgres service');
  }
}

function decodeSource() {
  const payload = process.env.CATALOG_IMPORT_BR_B64;
  if (!payload) fail('CATALOG_IMPORT_BR_B64 is missing');

  let source;
  try {
    const json = zlib.brotliDecompressSync(Buffer.from(payload, 'base64')).toString('utf8');
    source = JSON.parse(json);
  } catch (error) {
    fail(`cannot decode catalog payload: ${error.message}`);
  }

  if (!Array.isArray(source.categories) || !Array.isArray(source.products)) {
    fail('invalid payload: categories/products arrays are required');
  }
  if (source.review?.length) {
    fail(`refusing import: ${source.review.length} review item(s) remain`);
  }

  const expectedCategories = Number(process.env.CATALOG_IMPORT_EXPECT_CATEGORIES || 0);
  const expectedProducts = Number(process.env.CATALOG_IMPORT_EXPECT_PRODUCTS || 0);
  if (!expectedCategories || source.categories.length !== expectedCategories) {
    fail(`category count mismatch: got ${source.categories.length}, expected ${expectedCategories}`);
  }
  if (!expectedProducts || source.products.length !== expectedProducts) {
    fail(`product count mismatch: got ${source.products.length}, expected ${expectedProducts}`);
  }

  for (const [items, field] of [[source.categories, 'categoryCode'], [source.products, 'productCode']]) {
    const codes = items.map((item) => String(item[field] || ''));
    if (codes.some((code) => !code) || new Set(codes).size !== codes.length) {
      fail(`invalid payload: missing or duplicate ${field}`);
    }
    for (const locale of LOCALES) {
      const slugs = items.map((item) => item.slug?.[locale]);
      if (slugs.some((slug) => !slug) || new Set(slugs).size !== slugs.length ||
          items.some((item) => !item.name?.[locale])) {
        fail(`invalid payload: missing names or missing/duplicate slugs (${field}, ${locale})`);
      }
    }
  }
  const categoryCodes = new Set(source.categories.map((item) => String(item.categoryCode)));
  const productCodes = new Set(source.products.map((item) => String(item.productCode)));
  for (const item of source.products) {
    if (!categoryCodes.has(String(item.categoryCode)) ||
        (item.relatedProductCodes || []).some((code) => !productCodes.has(String(code)))) {
      fail(`invalid payload: unresolved relation for ${item.productCode}`);
    }
  }

  return source;
}

async function ensureLocales(strapi) {
  const locales = strapi.plugin('i18n').service('locales');
  const required = [
    { code: 'hu', name: 'Hungarian (hu)' },
    { code: 'ro', name: 'Romanian (ro)' },
  ];

  for (const locale of required) {
    if (!(await locales.findByCode(locale.code))) {
      await locales.create(locale);
    }
  }
}

async function findByCode(strapi, uid, codeField, codeValue, locale) {
  return strapi.db.query(uid).findOne({
    where: { [codeField]: codeValue, locale },
    populate: ['localizations'],
  });
}

function categoryData(item, locale) {
  return {
    publishedAt: null,
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
    publishedAt: null,
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

async function createEntry(strapi, uid, locale, data) {
  return strapi.entityService.create(uid, {
    data: { ...data, locale },
    populate: ['localizations'],
  });
}

async function createLocalization(strapi, uid, baseId, locale, data) {
  const model = strapi.getModel(uid);
  const handler = strapi
    .plugin('i18n')
    .service('core-api')
    .createCreateLocalizationHandler(model);

  await handler({
    id: baseId,
    data: { ...data, locale },
    files: {},
  });
}

function pairIsLinked(left, right) {
  const leftIds = (left.localizations || []).map((entry) => entry.id);
  const rightIds = (right.localizations || []).map((entry) => entry.id);
  return leftIds.includes(right.id) && rightIds.includes(left.id);
}

async function ensureLocalizedPair(strapi, uid, codeField, codeValue, huData, roData) {
  let hu = await findByCode(strapi, uid, codeField, codeValue, 'hu');
  let ro = await findByCode(strapi, uid, codeField, codeValue, 'ro');

  if (!hu && !ro) {
    hu = await createEntry(strapi, uid, 'hu', huData);
    await createLocalization(strapi, uid, hu.id, 'ro', roData);
  } else if (hu && !ro) {
    await createLocalization(strapi, uid, hu.id, 'ro', roData);
  } else if (!hu && ro) {
    await createLocalization(strapi, uid, ro.id, 'hu', huData);
  }

  hu = await findByCode(strapi, uid, codeField, codeValue, 'hu');
  ro = await findByCode(strapi, uid, codeField, codeValue, 'ro');

  if (!hu || !ro) {
    fail(`could not establish HU/RO pair for ${uid} ${codeValue}`);
  }
  if (!pairIsLinked(hu, ro)) {
    fail(`existing HU/RO entries are not linked localizations for ${uid} ${codeValue}`);
  }

  await strapi.entityService.update(uid, hu.id, {
    data: huData,
    populate: ['localizations'],
  });
  await strapi.entityService.update(uid, ro.id, {
    data: roData,
    populate: ['localizations'],
  });

  return {
    hu: await findByCode(strapi, uid, codeField, codeValue, 'hu'),
    ro: await findByCode(strapi, uid, codeField, codeValue, 'ro'),
  };
}

async function verifyImportedCatalog(strapi, source, legacyCountBefore) {
  const categories = await strapi.db.query(CATEGORY_UID).findMany({
    where: { locale: { $in: LOCALES } },
    populate: ['localizations'],
  });
  const products = await strapi.db.query(PRODUCT_UID).findMany({
    where: { locale: { $in: LOCALES } },
    populate: ['localizations', 'category', 'forms', 'packages'],
  });

  const expectedCategoryRows = source.categories.length * LOCALES.length;
  const expectedProductRows = source.products.length * LOCALES.length;
  if (categories.length !== expectedCategoryRows) {
    fail(`verification failed: ${categories.length}/${expectedCategoryRows} localized category rows`);
  }
  if (products.length !== expectedProductRows) {
    fail(`verification failed: ${products.length}/${expectedProductRows} localized product rows`);
  }

  for (const entry of [...categories, ...products]) {
    if (entry.publishedAt) {
      fail(`verification failed: imported entry ${entry.id} is published`);
    }
    if (!Array.isArray(entry.localizations) || entry.localizations.length !== 1) {
      fail(`verification failed: entry ${entry.id} does not have exactly one paired localization`);
    }
    if (!LOCALES.includes(entry.localizations[0].locale)) {
      fail(`verification failed: entry ${entry.id} is paired to an unexpected locale`);
    }
  }

  const pendingCodes = new Set((source.pending || []).map((item) => String(item.productCode)));
  const productByCodeLocale = new Map(
    products.map((entry) => [`${entry.productCode}:${entry.locale}`, entry])
  );
  const categoryByCodeLocale = new Map(
    categories.map((entry) => [`${entry.categoryCode}:${entry.locale}`, entry])
  );
  function verifyFields(entry, expected, label) {
    for (const [key, value] of Object.entries(expected)) {
      if (['category', 'forms', 'packages'].includes(key)) continue;
      if (entry[key] !== value) fail(`verification failed: ${label} field ${key}`);
    }
  }
  for (const item of source.categories) {
    for (const locale of LOCALES) {
      const entry = categoryByCodeLocale.get(`${item.categoryCode}:${locale}`);
      const other = categoryByCodeLocale.get(`${item.categoryCode}:${locale === 'hu' ? 'ro' : 'hu'}`);
      if (!entry || !other || !pairIsLinked(entry, other)) {
        fail(`verification failed: category localization ${item.categoryCode}`);
      }
      verifyFields(entry, categoryData(item, locale), `category ${item.categoryCode} (${locale})`);
    }
  }
  for (const item of source.products) {
    for (const locale of LOCALES) {
      const entry = productByCodeLocale.get(`${item.productCode}:${locale}`);
      if (!entry) fail(`verification failed: missing ${item.productCode} (${locale})`);
      const category = categoryByCodeLocale.get(`${item.categoryCode}:${locale}`);
      const other = productByCodeLocale.get(`${item.productCode}:${locale === 'hu' ? 'ro' : 'hu'}`);
      if (!category || entry.category?.id !== category.id || !other || !pairIsLinked(entry, other)) {
        fail(`verification failed: product relations ${item.productCode} (${locale})`);
      }
      verifyFields(entry, productData(item, locale, category.id), `product ${item.productCode} (${locale})`);
      for (const [field, key] of [['forms', 'form'], ['packages', 'size']]) {
        if (JSON.stringify((entry[field] || []).map((value) => value[key])) !==
            JSON.stringify((item[field] || []).map((value) => value[key]))) {
          fail(`verification failed: ${field} mismatch for ${item.productCode} (${locale})`);
        }
      }
      const shouldBeBlank = pendingCodes.has(String(item.productCode));
      if (shouldBeBlank && entry.availability !== null) {
        fail(`verification failed: pending availability was filled for ${item.productCode}`);
      }
      if (!shouldBeBlank && entry.availability !== item.availability) {
        fail(`verification failed: availability mismatch for ${item.productCode}`);
      }
    }
  }

  if (legacyCountBefore !== null) {
    const legacyCountAfter = await strapi.db.query(LEGACY_PRODUCT_UID).count();
    if (legacyCountAfter !== legacyCountBefore) {
      fail('verification failed: legacy Product collection count changed');
    }
  }

  return {
    categories: categories.length,
    products: products.length,
    pendingAvailabilityProducts: pendingCodes.size,
  };
}

async function runCatalogStagingImport(strapi) {
  const mode = process.env.CATALOG_STAGING_IMPORT;
  if (mode !== '1' && mode !== 'check' && mode !== 'verify') return;

  assertStagingTarget();
  const source = decodeSource();
  const counts = {};
  for (const uid of [CATEGORY_UID, PRODUCT_UID, LEGACY_PRODUCT_UID, 'api::blog.blog']) {
    if (strapi.contentTypes[uid]) counts[uid] = await strapi.db.query(uid).count();
  }
  strapi.log.info(`[catalog-staging-import] preflight ${JSON.stringify({ mode, sourceCategories: source.categories.length, sourceProducts: source.products.length, pending: source.pending?.length || 0, counts })}`);
  if (mode === 'check') {
    strapi.log.info('[catalog-staging-import] read-only check passed; no catalog data written');
    return;
  }
  if (mode === 'verify') {
    const result = await verifyImportedCatalog(strapi, source, counts[LEGACY_PRODUCT_UID] ?? null);
    strapi.log.info(`[catalog-staging-import] read-only verification passed ${JSON.stringify(result)}`);
    return;
  }
  for (const uid of [CATEGORY_UID, PRODUCT_UID]) {
    if (await strapi.db.query(uid).count({ where: { publishedAt: { $notNull: true } } })) {
      fail('refusing import: target catalog contains published records');
    }
  }
  await ensureLocales(strapi);

  const legacyCountBefore = strapi.contentTypes[LEGACY_PRODUCT_UID]
    ? await strapi.db.query(LEGACY_PRODUCT_UID).count()
    : null;

  strapi.log.info(
    `[catalog-staging-import] starting guarded import: ${source.categories.length} categories, ${source.products.length} products`
  );

  const categoryIds = new Map();
  for (const item of source.categories) {
    const pair = await ensureLocalizedPair(
      strapi,
      CATEGORY_UID,
      'categoryCode',
      item.categoryCode,
      categoryData(item, 'hu'),
      categoryData(item, 'ro')
    );
    categoryIds.set(`${item.categoryCode}:hu`, pair.hu.id);
    categoryIds.set(`${item.categoryCode}:ro`, pair.ro.id);
  }

  for (const item of source.products) {
    const huCategory = categoryIds.get(`${item.categoryCode}:hu`);
    const roCategory = categoryIds.get(`${item.categoryCode}:ro`);
    if (!huCategory || !roCategory) {
      fail(`missing localized category relation for product ${item.productCode}`);
    }

    await ensureLocalizedPair(
      strapi,
      PRODUCT_UID,
      'productCode',
      item.productCode,
      productData(item, 'hu', huCategory),
      productData(item, 'ro', roCategory)
    );
  }

  const result = await verifyImportedCatalog(strapi, source, legacyCountBefore);
  strapi.log.info(
    `[catalog-staging-import] verified ${result.categories} localized category rows and ${result.products} localized product rows; ${result.pendingAvailabilityProducts} pending availability products preserved blank`
  );
}

module.exports = { runCatalogStagingImport };

