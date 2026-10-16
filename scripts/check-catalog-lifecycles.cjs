'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const rows = [{id:1,locale:'hu',slug:'brand',productCode:'p'}, {id:2,locale:'ro',slug:'other',productCode:'q'}];
const query = {async findOne({where}) {
  return rows.find(row => Object.entries(where).every(([key, value]) =>
    typeof value === 'object' ? row[key] !== value.$ne : row[key] === value)) || null;
}};
const context = {
  module:{exports:{}},
  require(name) { if(name === '@strapi/utils') return {errors:{ValidationError:class ValidationError extends Error{}}}; throw Error(name); },
  strapi:{db:{query:()=>query},plugin:()=>({service:()=>({getDefaultLocale:async()=>'hu'})})},
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/catalog-lifecycles.js'),'utf8'),context);
const hooks = context.module.exports('api::catalog-product.catalog-product','productCode');
(async()=>{
  await hooks.beforeCreate({params:{data:{locale:'ro',slug:'brand',productCode:'p'}}});
  await assert.rejects(()=>hooks.beforeCreate({params:{data:{locale:'hu',slug:'brand',productCode:'new'}}}),/unique/);
  await assert.rejects(()=>hooks.beforeCreate({params:{data:{locale:'hu',slug:'new',productCode:'p'}}}),/unique/);
  await hooks.beforeUpdate({params:{where:{id:1},data:{slug:'brand'}}});
  await assert.rejects(()=>hooks.beforeUpdate({params:{where:{id:2},data:{slug:'bad%'}}}),/unsupported/);
  await hooks.beforeCreate({params:{data:{locale:'hu'}}});
  console.log('PASS: cross-locale slugs allowed, same-locale URL/code duplicates rejected, updates and blank drafts supported');
})().catch(error=>{console.error(error);process.exitCode=1;});

