import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPool, closePool } from '../config/db.js';
import { normalizeSource, importSourceCatalog } from '../services/sourceCatalog.js';

const directory = process.argv.find(a => a.startsWith('--dir='))?.slice(6);
if (!directory) throw Error('Provide --dir=/path/to/brand-json-files');
let client;
try {
  const rows = new Map();
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.json') && !['sources.json', 'collection_report.json'].includes(f)).sort()) {
    const items = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    if (!Array.isArray(items)) throw Error('Expected product array: ' + file);
    for (const item of items) {
      const row = normalizeSource(item, file);
      if (rows.has(row.key)) throw Error('Duplicate source URL: ' + file);
      rows.set(row.key, row);
    }
  }
  client = await getPool().connect();
  console.log(JSON.stringify(await importSourceCatalog(client, [...rows.values()], { apply: process.argv.includes('--apply') })));
} catch (error) {
  console.error('Catalog import failed. Code:', error.code || error.message);
  process.exitCode = 1;
} finally { client?.release(); await closePool(); }
