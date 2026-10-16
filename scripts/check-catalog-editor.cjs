'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const env = {};
const fixtureModule = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/catalog-editor-setup.js'), 'utf8'), {
  module: fixtureModule, process: { env },
});
const { definitions, runCatalogEditorSetup } = fixtureModule.exports;
const uids = [
  'api::catalog-product.catalog-product', 'api::catalog-category.catalog-category',
  'catalog.form-variant', 'catalog.package-option',
];
assert.deepEqual(Object.keys(definitions).sort(), [...uids].sort());
const models = {}, saved = new Map(), writes = [];
for (const uid of uids) {
  const component = uid.startsWith('catalog.');
  const type = uid.split('.')[1];
  const file = component ? `src/components/catalog/${type}.json` : `src/api/${type}/content-types/${type}/schema.json`;
  models[uid] = { ...JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')), uid };
  saved.set(uid, {
    settings: { customSetting: 'preserve' }, layouts: {}, options: {},
    metadatas: Object.fromEntries(Object.keys(models[uid].attributes).map(name => [name, { edit: { visible: true }, list: {} }])),
  });
}
const service = {
  findComponent: uid => models[uid], findContentType: uid => models[uid],
  findConfiguration: async model => saved.get(model.uid),
  updateConfiguration: async (model, config) => {
    assert.ok(uids.includes(model.uid), 'must never update a legacy model');
    writes.push(model.uid); saved.set(model.uid, config);
  },
};
let reads = 0;
const app = {
  plugin: name => { reads++; assert.equal(name, 'content-manager'); return { service: kind => { assert.ok(['components', 'content-types'].includes(kind)); return service; } }; },
  log: { info() {} },
};
(async () => {
  await runCatalogEditorSetup(app);
  assert.equal(reads, 0, 'disabled setup must not access CMS services');
  env.CATALOG_EDITOR_SETUP = '1';
  await runCatalogEditorSetup(app);
  assert.deepEqual([...writes].sort(), [...uids].sort());
  for (const uid of uids) {
    const config = saved.get(uid);
    assert.equal(config.settings.customSetting, 'preserve');
    assert.equal(config.options.catalogEditorVersion, 1);
    assert.deepEqual(Array.from(config.layouts.edit.flat(), x => x.name).sort(), Object.keys(models[uid].attributes).sort());
  }
  saved.get(uids[0]).metadatas.name.edit.label = 'Custom editor label';
  await runCatalogEditorSetup(app);
  assert.equal(writes.length, 4, 'rerun must preserve manual editor customization');
  assert.equal(saved.get(uids[0]).metadatas.name.edit.label, 'Custom editor label');

  const bootstrapModule = { exports: {} }, errors = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/index.js'), 'utf8'), {
    module: bootstrapModule,
    require: name => { assert.equal(name, './catalog-editor-setup'); return { runCatalogEditorSetup: async () => { throw Error('private detail'); } }; },
  });
  await bootstrapModule.exports.bootstrap({ strapi: { log: { error: message => errors.push(message) } } });
  assert.equal(errors.length, 1);
  assert.ok(!errors[0].includes('private detail'), 'error logging must not expose runtime details');
  console.log('PASS: default-off, catalog-only view updates, full field coverage, preserved customizations and non-blocking layout failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
