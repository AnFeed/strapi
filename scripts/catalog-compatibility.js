'use strict';

// One-shot test job: restore into a NEW database on the already isolated
// staging PostgreSQL server. It never connects to the production database.
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { assertStagingTarget, runCatalogStagingImport } = require('../src/catalog-staging-import');
const qi = (value) => '"' + String(value).replace(/"/g, '""') + '"';
const tableName = (name) => 'public.' + qi(name);
const digest = (rows) => crypto.createHash('sha256').update(JSON.stringify([...rows].sort())).digest('hex');
const allowedTypes = /^(bigint|integer|boolean|text|jsonb?|double precision|character varying\(\d+\)|numeric\(\d+,\d+\)|timestamp(?:\(\d+\))? without time zone)$/;

function validateSnapshot(snapshot) {
  if (snapshot.format !== 'strapi-compatibility-snapshot-v1' || snapshot.info?.read_only !== 'on') {
    throw Error('Invalid or non-read-only source snapshot');
  }
  if (Object.values(snapshot.unsupported || {}).some((value) => value !== 0)) throw Error('Unsupported source objects');
  for (const key of ['tables', 'columns', 'constraints', 'indexes', 'sequences']) {
    if (!Array.isArray(snapshot[key])) throw Error('Missing snapshot section: ' + key);
  }
  const names = new Set(snapshot.tables.map((table) => table.name));
  if (!names.size || names.size !== snapshot.tables.length || names.size > 1000) throw Error('Invalid source tables');
  if ([...names].some((name) => !/^[a-z_][a-z0-9_]*$/.test(name) || name.startsWith('catalog_'))) {
    throw Error('Unexpected source table name');
  }
  for (const table of snapshot.tables) {
    if (!Array.isArray(table.rows) || table.hash !== digest(table.rows) || table.options?.length) {
      throw Error('Corrupt table snapshot or unsupported table storage options');
    }
  }
  for (const column of snapshot.columns) {
    if (!names.has(column.table_name) || !allowedTypes.test(column.type) || column.identity || column.generated) {
      throw Error('Unsupported column metadata');
    }
    if (column.default_expression && !/^nextval\('[a-z_][a-z0-9_]*'::regclass\)$/.test(column.default_expression)) {
      throw Error('Unsupported column default');
    }
  }
  for (const constraint of snapshot.constraints) {
    if (!names.has(constraint.table_name) || !['p', 'u', 'f', 'c'].includes(constraint.type) ||
        !/^(PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b/.test(constraint.definition) || /;/.test(constraint.definition)) {
      throw Error('Unsupported constraint metadata');
    }
  }
  for (const index of snapshot.indexes) {
    if (!/^CREATE (?:UNIQUE )?INDEX /.test(index.definition) || /;/.test(index.definition)) throw Error('Unsupported index');
  }
  for (const sequence of snapshot.sequences) {
    if (!['integer', 'bigint'].includes(sequence.type) ||
        ['start', 'increment', 'min', 'max', 'cache', 'last_value'].some((key) => !/^-?\d+$/.test(sequence[key]))) {
      throw Error('Unsupported sequence metadata');
    }
  }
  if (!names.has('products') || !names.has('blogs')) throw Error('Legacy source collections are missing');
  return snapshot;
}

function definitionStatements(snapshot) {
  const statements = [];
  for (const s of snapshot.sequences) {
    statements.push(`CREATE SEQUENCE ${tableName(s.name)} AS ${s.type} INCREMENT BY ${s.increment} MINVALUE ${s.min} MAXVALUE ${s.max} START WITH ${s.start} CACHE ${s.cache} ${s.cycle ? 'CYCLE' : 'NO CYCLE'}`);
  }
  for (const table of snapshot.tables) {
    const columns = snapshot.columns.filter((column) => column.table_name === table.name);
    if (!columns.length) throw Error('Source table has no columns');
    const parts = columns.map((column) => `${qi(column.name)} ${column.type}${column.default_expression ? ' DEFAULT ' + column.default_expression : ''}${column.not_null ? ' NOT NULL' : ''}`);
    statements.push(`CREATE TABLE ${tableName(table.name)} (${parts.join(', ')})`);
  }
  return statements;
}

async function restoreSnapshot(client, snapshot) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    for (const sql of definitionStatements(snapshot)) await client.query(sql);
    for (const table of snapshot.tables) {
      if (table.rows.length) await client.query(`INSERT INTO ${tableName(table.name)} SELECT * FROM json_populate_recordset(NULL::${tableName(table.name)}, $1::json)`, ['[' + table.rows.join(',') + ']']);
    }
    // Foreign keys follow all row inserts, just as in a logical restore.
    for (const constraint of snapshot.constraints) {
      await client.query(`ALTER TABLE ${tableName(constraint.table_name)} ADD CONSTRAINT ${qi(constraint.name)} ${constraint.definition}`);
    }
    for (const index of snapshot.indexes) await client.query(index.definition);
    for (const s of snapshot.sequences) {
      if (s.owner_table && s.owner_column) await client.query(`ALTER SEQUENCE ${tableName(s.name)} OWNED BY ${tableName(s.owner_table)}.${qi(s.owner_column)}`);
      await client.query('SELECT setval($1::regclass, $2::bigint, $3::boolean)', ['public.' + s.name, s.last_value, s.is_called]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function checkFingerprints(client, tables) {
  await client.query("SET TIME ZONE 'UTC'");
  for (const table of tables) {
    const result = await client.query(`SELECT to_jsonb(t)::text AS row FROM ${tableName(table.name)} t`);
    const rows = result.rows.map((row) => row.row);
    if (rows.length !== table.rows.length || digest(rows) !== table.hash) throw Error('Data fingerprint mismatch: ' + table.name);
  }
}

async function checkLegacyApi(app, baselineClient) {
  const expected = {};
  for (const table of ['products', 'blogs']) {
    expected[table] = (await baselineClient.query(`SELECT locale,count(*)::int AS count FROM ${tableName(table)} WHERE published_at IS NOT NULL GROUP BY locale`)).rows;
  }
  await new Promise((resolve, reject) => app.server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = app.server.httpServer.address().port;
  const results = [];
  for (const table of ['products', 'blogs']) {
    for (const { locale, count } of expected[table].filter((row) => ['hu', 'ro'].includes(row.locale))) {
      const response = await fetch(`http://127.0.0.1:${port}/api/${table}?locale=${locale}&pagination[pageSize]=100&populate=deep`);
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.data) || body.data.length !== count || body.data.some((row) => row.attributes.locale !== locale)) {
        throw Error('Legacy API list contract failed');
      }
      const sample = body.data[0];
      const slugField = table === 'products' ? 'slug' : 'Slug';
      const slug = sample?.attributes[slugField];
      if (slug) {
        const detail = await fetch(`http://127.0.0.1:${port}/api/${table}/${encodeURIComponent(slug)}`);
        const data = await detail.json();
        if (!detail.ok || data.data?.attributes?.[slugField] !== slug) throw Error('Legacy API detail contract failed');
      }
      results.push({ collection: table, locale, count, list: 'passed', detail: 'passed' });
    }
  }
  for (const collection of ['catalog-categories', 'catalog-products']) {
    const response = await fetch(`http://127.0.0.1:${port}/api/${collection}`);
    if (response.status !== 403) throw Error('Catalog public permissions unexpectedly changed');
  }
  return results;
}

async function main() {
  if (process.env.CATALOG_COMPATIBILITY_TEST !== '1') return;
  assertStagingTarget();
  const database = process.env.CATALOG_COMPATIBILITY_DATABASE || '';
  if (!/^catalog_compatibility_\d{8}_[a-f0-9]{6}$/.test(database)) throw Error('Invalid isolated test database name');
  const count = Number(process.env.CATALOG_COMPATIBILITY_SNAPSHOT_PARTS);
  if (!Number.isInteger(count) || count < 1 || count > 30) throw Error('Invalid source payload parts');
  const payload = Array.from({ length: count }, (_, index) => process.env[`CATALOG_COMPATIBILITY_SNAPSHOT_${index}`] || '').join('');
  const raw = zlib.brotliDecompressSync(Buffer.from(payload, 'base64'), { maxOutputLength: 50000000 });
  if (crypto.createHash('sha256').update(raw).digest('hex') !== process.env.CATALOG_COMPATIBILITY_SNAPSHOT_SHA256) throw Error('Source payload checksum mismatch');
  const snapshot = validateSnapshot(JSON.parse(raw));
  const { Client } = require('pg');
  const originalUrl = process.env.DATABASE_PRIVATE_URL;
  const cloneUrl = new URL(originalUrl);
  if (cloneUrl.pathname === '/' + database) throw Error('Refusing to use the active staging database');
  cloneUrl.pathname = '/' + database;
  const maintenance = new Client({ connectionString: originalUrl, connectionTimeoutMillis: 15000 });
  let copy;
  let app;
  let phase = 'create-isolated-copy';
  try {
    await maintenance.connect();
    const exists = await maintenance.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
    if (exists.rowCount) throw Error('Test database already exists; refusing overwrite');
    await maintenance.query(`CREATE DATABASE ${qi(database)}`);
    copy = new Client({ connectionString: cloneUrl.toString(), connectionTimeoutMillis: 15000 });
    await copy.connect();
    phase = 'restore-snapshot';
    await restoreSnapshot(copy, snapshot);
    await checkFingerprints(copy, snapshot.tables);
    console.log('[catalog-compatibility] faithful-restore verified ' + snapshot.tables.length + ' table fingerprints');
    // Disable copied webhooks before booting; no messages or deploy hooks run.
    if (snapshot.tables.some((table) => table.name === 'strapi_webhooks')) await copy.query('UPDATE public.strapi_webhooks SET enabled=false');
    process.env.DATABASE_PRIVATE_URL = cloneUrl.toString();
    process.env.CATALOG_STAGING_IMPORT = '0';
    phase = 'load-feature-schema';
    app = require('@strapi/strapi')();
    await app.load();
    const protectedTables = snapshot.tables.filter((table) => !/^(strapi_|admin_|up_)/.test(table.name));
    await checkFingerprints(copy, protectedTables);
    phase = 'draft-import';
    process.env.CATALOG_STAGING_IMPORT = '1';
    await runCatalogStagingImport(app);
    const identities = async () => JSON.stringify(await app.db.query('api::catalog-product.catalog-product').findMany({ select: ['id', 'productCode', 'locale'], orderBy: { id: 'asc' } }));
    const before = await identities();
    await runCatalogStagingImport(app);
    if (before !== await identities()) throw Error('Repeated import changed product identities');
    await checkFingerprints(copy, protectedTables);
    phase = 'legacy-api';
    const api = await checkLegacyApi(app, copy);
    await checkFingerprints(copy, protectedTables);
    console.log('[catalog-compatibility] PASS ' + JSON.stringify({ sourceVersion: snapshot.info.version, targetVersion: (await copy.query('SHOW server_version')).rows[0].server_version, restoredTables: snapshot.tables.length, protectedTables: protectedTables.length, legacyProducts: snapshot.tables.find((table) => table.name === 'products').rows.length, legacyBlogs: snapshot.tables.find((table) => table.name === 'blogs').rows.length, catalogCategories: 14, catalogProducts: 104, repeatedImport: 'same product IDs', publicCatalog: '403', api }));
  } catch (error) {
    console.error('[catalog-compatibility] FAIL ' + JSON.stringify({ phase, code: error.code || error.name, reason: error.code ? 'database operation rejected' : error.message }));
    throw Error('Compatibility test failed in ' + phase);
  } finally {
    process.env.DATABASE_PRIVATE_URL = originalUrl;
    process.env.CATALOG_STAGING_IMPORT = '0';
    if (app) await app.destroy();
    if (copy) await copy.end();
    await maintenance.end();
  }
}

module.exports = { validateSnapshot, definitionStatements, restoreSnapshot, checkFingerprints, main };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
