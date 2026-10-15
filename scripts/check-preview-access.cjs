'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const env = {};
let guards = 0;
const moduleFixture = { exports: {} };
vm.runInNewContext(fs.readFileSync('src/catalog-preview-access.js', 'utf8'), { module: moduleFixture, process: { env }, Date, require: () => ({ assertStagingTarget: () => { guards++; if (env.WRONG_TARGET) throw Error('wrong target'); } }) });
const { runCatalogPreviewAccess, verifyToken, PERMISSIONS, NAME } = moduleFixture.exports;
(async () => {
  let token, creates = 0, updates = 0, revokes = 0;
  const service = { hash: () => 'fixture-hash', getBy: async () => token, create: async input => { creates++; token = { ...input, id: 1, accessKey: 'generated-unused', expiresAt: new Date(Date.now() + 86400000) }; return token; }, revoke: async () => { revokes++; token = null; } };
  const app = { service: uid => { assert.equal(uid, 'admin::api-token'); return service; }, db: { query: uid => { assert.equal(uid, 'admin::api-token'); return { update: async ({ data }) => { updates++; Object.assign(token, data); } }; } }, log: { info: value => { assert.ok(!value.includes('fixture-hash')); } } };
  await runCatalogPreviewAccess(app);
  assert.equal(guards, 0); assert.equal(creates, 0);
  env.CATALOG_PREVIEW_ACCESS_SETUP = '1'; env.CATALOG_PREVIEW_READ_TOKEN = 'f'.repeat(64); env.WRONG_TARGET = '1';
  await assert.rejects(() => runCatalogPreviewAccess(app)); assert.equal(creates, 0);
  delete env.WRONG_TARGET;
  await runCatalogPreviewAccess(app);
  assert.equal(creates, 1); assert.equal(updates, 1); assert.equal(token.name, NAME); assert.equal(token.permissions.join(','), PERMISSIONS.join(','));
  await runCatalogPreviewAccess(app); assert.equal(creates, 1); assert.equal(updates, 1);
  for (const expiresAt of ['invalid', null, new Date(Date.now() - 1000), new Date(Date.now() + 8 * 86400000)]) {
    assert.throws(() => verifyToken({ ...token, expiresAt }, 'fixture-hash'));
  }
  assert.throws(() => verifyToken({ ...token, accessKey: 'different' }, 'fixture-hash'));
  token.permissions.push('api::blog.blog.find');
  await assert.rejects(() => runCatalogPreviewAccess(app)); assert.equal(updates, 1);
  token = null;
  app.db.query = () => ({ update: async () => { throw Error('failure'); } });
  await assert.rejects(() => runCatalogPreviewAccess(app)); assert.equal(revokes, 1);
  console.log('PASS: disabled by default, target guard before writes, catalog-only permissions, expiry, repeat safety and failed-setup revocation');
})().catch(error => { console.error(error); process.exitCode = 1; });
