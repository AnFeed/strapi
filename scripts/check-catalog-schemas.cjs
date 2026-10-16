'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const localized = {
  'catalog-category': ['name', 'slug', 'introduction', 'seoTitle', 'metaDescription'],
  'catalog-product': ['name', 'slug', 'category', 'subcategory', 'feedType', 'lifeStage', 'introduction', 'imageAlt', 'ingredients', 'benefits', 'usage', 'seoTitle', 'metaDescription'],
};
for (const [type, fields] of Object.entries(localized)) {
  const schema = require(path.join(__dirname, '..', 'src', 'api', type, 'content-types', type, 'schema.json'));
  assert.equal(schema.options.draftAndPublish, true);
  assert.equal(schema.attributes.slug.type, 'string');
  assert.ok(new RegExp(schema.attributes.slug.regex).test('valid-slug'));
  assert.ok(!new RegExp(schema.attributes.slug.regex).test('invalid%slug'));
  for (const field of fields) assert.equal(schema.attributes[field].pluginOptions?.i18n?.localized, true, type + '.' + field);
  for (const field of type === 'catalog-product' ? ['productCode', 'availability', 'image', 'forms', 'packages', 'analyticalValues', 'labelPdf', 'labelFileName', 'relatedProductCodes'] : ['categoryCode']) {
    assert.equal(schema.attributes[field].pluginOptions?.i18n?.localized, false, type + '.' + field);
  }
}
console.log('PASS: localized editorial fields and shared catalog fields');


