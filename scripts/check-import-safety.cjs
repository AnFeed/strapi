const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const zlib = require('node:zlib');
const code = fs.readFileSync(require('node:path').join(__dirname, '../src/catalog-staging-import.js'), 'utf8');
const env = {
  RAILWAY_PROJECT_ID: '1a0d10f2-c472-416d-972d-48de99a73c00',
  RAILWAY_ENVIRONMENT_ID: 'c899072a-069b-4712-958b-4dff2e9038ed',
  RAILWAY_SERVICE_ID: '1fbc432c-eba0-420b-9ff0-f3338666863d',
  RAILWAY_ENVIRONMENT_NAME: 'staging', CATALOG_IMPORT_TARGET: 'staging',
  CATALOG_IMPORT_EXPECT_HOST: 'anfeed-strapi-staging.up.railway.app',
  URL: 'https://anfeed-strapi-staging.up.railway.app',
  CATALOG_IMPORT_EXPECT_PROJECT_ID: '1a0d10f2-c472-416d-972d-48de99a73c00',
  CATALOG_IMPORT_EXPECT_DATABASE_HOST: 'postgres.railway.internal',
  DATABASE_PRIVATE_URL: 'postgres://test:test@postgres.railway.internal:5432/railway',
  CATALOG_IMPORT_EXPECT_CATEGORIES: '1', CATALOG_IMPORT_EXPECT_PRODUCTS: '1',
};
const pair = (value) => ({hu: value + '-hu', ro: value + '-ro'});
const source = {categories:[{categoryCode:'c',name:pair('category'),slug:pair('category')}],products:[{productCode:'p',categoryCode:'c',availability:'in_store',name:pair('product'),slug:pair('product')}],review:[]};
function load(overrides = {}, payload = source) {
  const context = {require, Buffer, URL, module:{exports:{}}, process:{env:{...env,CATALOG_IMPORT_BR_B64:zlib.brotliCompressSync(Buffer.from(JSON.stringify(payload))).toString('base64'),...overrides}}};
  vm.runInNewContext(code + '\nObject.assign(module.exports, {assertStagingTarget, decodeSource, verifyImportedCatalog, categoryData, productData});', context);
  return context.module.exports;
}
(async () => {
  load().assertStagingTarget();
  assert.equal(load().decodeSource().products.length, 1);
  for (const key of ['RAILWAY_PROJECT_ID','RAILWAY_ENVIRONMENT_ID','RAILWAY_SERVICE_ID','RAILWAY_ENVIRONMENT_NAME','URL','DATABASE_PRIVATE_URL']) {
    assert.throws(() => load({[key]:'production'}).assertStagingTarget());
  }
  assert.throws(() => load({}, {...source,products:[{...source.products[0],categoryCode:'missing'}]}).decodeSource());
  assert.throws(() => load({CATALOG_IMPORT_EXPECT_PRODUCTS:'2'}, {...source,products:[source.products[0],source.products[0]]}).decodeSource());
  let writes = 0;
  const strapi = {contentTypes:Object.fromEntries(['api::catalog-category.catalog-category','api::catalog-product.catalog-product','api::product.product','api::blog.blog'].map(uid=>[uid,{}])),db:{query:()=>({count:async()=>0})},log:{info:()=>{}},entityService:{create:()=>writes++,update:()=>writes++},plugin:()=>{throw new Error('check must not initialize locales');}};
  await load({CATALOG_STAGING_IMPORT:'check'}).runCatalogStagingImport(strapi);
  assert.equal(writes,0);
  await load({CATALOG_STAGING_IMPORT:'0'}).runCatalogStagingImport({});
  const api = load();
  const categories = ['hu', 'ro'].map((locale, index) => ({...api.categoryData(source.categories[0], locale),id: index + 1,locale,publishedAt:null,localizations:[{id:index === 0 ? 2 : 1,locale:index === 0 ? 'ro' : 'hu'}]}));
  const products = ['hu', 'ro'].map((locale, index) => ({...api.productData(source.products[0],locale,index+1),id:index+3,category:{id:index+1},locale,publishedAt:null,localizations:[{id:index === 0 ? 4 : 3,locale:index === 0 ? 'ro' : 'hu'}]}));
  const target = {db:{query:(uid)=>({findMany:async()=>uid.includes('catalog-category')?categories:products,count:async()=>0})}};
  await api.verifyImportedCatalog(target,source,0);
  products[0].category.id=2;
  await assert.rejects(()=>api.verifyImportedCatalog(target,source,0),/relations/);
  products[0].category.id=1;
  products[0].name='wrong localized name';
  await assert.rejects(()=>api.verifyImportedCatalog(target,source,0),/field name/);
  console.log('PASS: staging identity/database guards, payload references/duplicates, no-write modes, localized content and relation verification');
})().catch(error=>{console.error(error);process.exitCode=1;});
