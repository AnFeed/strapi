'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { validateSnapshot, definitionStatements, restoreSnapshot } = require('./catalog-compatibility');
const hash = (rows) => createHash('sha256').update(JSON.stringify([...rows].sort())).digest('hex');
const tables = ['products', 'blogs'].map((name) => ({ name, options: null, rows: ['{"id": 1}'], hash: hash(['{"id": 1}']) }));
const sample = { format: 'strapi-compatibility-snapshot-v1', info: { read_only: 'on' }, unsupported: { functions: 0 }, tables,
  columns: ['products', 'blogs'].map((table_name) => ({ table_name, name: 'id', type: 'integer', not_null: true, identity: '', generated: '', default_expression: null })),
  constraints: [], indexes: [], sequences: [] };
(async () => {
  validateSnapshot(sample);
  assert.equal(definitionStatements(sample).length, 2);
  assert.throws(() => validateSnapshot({ ...sample, info: { read_only: 'off' } }));
  assert.throws(() => validateSnapshot({ ...sample, unsupported: { functions: 1 } }));
  assert.throws(() => validateSnapshot({ ...sample, tables: [{ ...tables[0], hash: 'corrupt' }, tables[1]] }));
  assert.throws(() => validateSnapshot({ ...sample, columns: [{ ...sample.columns[0], default_expression: 'malicious();' }] }));
  assert.throws(() => validateSnapshot({ ...sample, indexes: [{ definition: 'DROP TABLE products' }] }));
  const calls = [];
  await restoreSnapshot({ query: async (sql, params) => { calls.push({ sql, params }); } }, sample);
  assert.equal(calls[0].sql, 'BEGIN');
  assert.equal(calls.at(-1).sql, 'COMMIT');
  assert.ok(calls.filter((call) => call.sql.startsWith('INSERT')).every((call) => call.params?.[0] === '[{"id": 1}]'));
  assert.ok(!calls.some((call) => /DROP|TRUNCATE|DELETE/.test(call.sql)));
  const rollback = [];
  await assert.rejects(() => restoreSnapshot({ query: async (sql) => { rollback.push(sql); if (sql.startsWith('CREATE TABLE')) throw Error('restore failed'); } }, sample));
  assert.equal(rollback.at(-1), 'ROLLBACK');
  console.log('PASS: read-only provenance, snapshot integrity, safe definitions, parameterized restore and rollback');
})().catch((error) => { console.error(error); process.exitCode = 1; });
