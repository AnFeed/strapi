'use strict';

const { assertStagingTarget } = require('./catalog-staging-import');
const NAME = 'catalog-preview-read-only-v1';
const PERMISSIONS = Object.freeze(['api::catalog-product.catalog-product.find', 'api::catalog-product.catalog-product.findOne', 'api::catalog-category.catalog-category.find', 'api::catalog-category.catalog-category.findOne']);
const LIFESPAN = 7 * 24 * 60 * 60 * 1000;

function verifyToken(token, hash) {
  const expiresAt = token?.expiresAt ? new Date(token.expiresAt).getTime() : NaN;
  if (!token || token.name !== NAME || token.type !== 'custom' || token.accessKey !== hash ||
      token.permissions?.length !== PERMISSIONS.length || PERMISSIONS.some(action => !token.permissions.includes(action)) ||
      !Number.isFinite(expiresAt) || expiresAt <= Date.now() ||
      expiresAt > Date.now() + LIFESPAN + 60000) {
    throw Error('Preview token must match the supplied key, expire within seven days and grant catalog reads only');
  }
}

async function runCatalogPreviewAccess(strapi) {
  if (process.env.CATALOG_PREVIEW_ACCESS_SETUP !== '1') return;
  assertStagingTarget();
  const secret = process.env.CATALOG_PREVIEW_READ_TOKEN;
  if (!/^[a-f0-9]{64}$/.test(secret || '')) throw Error('A private random preview key is required');
  const service = strapi.service('admin::api-token');
  const hash = service.hash(secret);
  let token = await service.getBy({ name: NAME });
  if (token) {
    // Never replace or broaden an existing credential on a rerun.
    verifyToken(token, hash);
  } else {
    const created = await service.create({ name: NAME, description: 'Temporary staging catalog preview: catalog reads only', type: 'custom', lifespan: LIFESPAN, permissions: [...PERMISSIONS] });
    try {
      // Store only the native Strapi hash. The unused generated key is never logged.
      await strapi.db.query('admin::api-token').update({ where: { id: created.id }, data: { accessKey: hash } });
      token = await service.getBy({ name: NAME });
      verifyToken(token, hash);
    } catch (error) {
      await service.revoke(created.id);
      throw error;
    }
  }
  strapi.log.info('[catalog-preview-access] verified temporary token: four catalog read actions only; no admin account created');
}

module.exports = { runCatalogPreviewAccess, verifyToken, PERMISSIONS, NAME };
