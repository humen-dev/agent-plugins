// Gzip size budgets for the built site (SPEC-01 NFR-1a initial JS, NFR-1b catalog chunk).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = process.argv[2];
if (!dist) {
  console.error('usage: check-size.mjs <dist-dir>');
  process.exit(2);
}

const BASE = '/agent-plugins/';
const MAX_INITIAL = 120000;
const MAX_CATALOG = 300000;
const gz = (/** @type {string} */ file) => gzipSync(readFileSync(file)).length;
let failed = false;
const fail = (/** @type {string} */ msg) => {
  console.error(`::error::${msg}`);
  failed = true;
};

const catalogDir = join(dist, 'assets');
const catalogs = existsSync(catalogDir)
  ? readdirSync(catalogDir).filter((f) => /^catalog-.*\.js$/.test(f)).map((f) => `assets/${f}`)
  : [];

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = new Set();
for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
  const isScript = /^<script/i.test(tag);
  if (!isScript && !/rel=["']?modulepreload/i.test(tag)) continue;
  const m = tag.match(isScript ? /\ssrc=["']([^"']+)["']/i : /\shref=["']([^"']+)["']/i);
  if (m) refs.add(m[1].startsWith(BASE) ? m[1].slice(BASE.length) : m[1].replace(/^\//, ''));
}

let initial = 0;
for (const ref of refs) {
  if (catalogs.includes(ref)) continue;
  const file = join(dist, ref);
  if (!existsSync(file)) fail(`missing ${file}`);
  else initial += gz(file);
}
console.log(`initial JS: ${initial} B gzip (budget ${MAX_INITIAL} B)`);
if (initial > MAX_INITIAL) fail(`initial JS ${initial} B gzip exceeds ${MAX_INITIAL} B`);

if (catalogs.length !== 1) {
  fail(`catalog chunk: expected 1 file, found ${catalogs.length}`);
} else {
  const size = gz(join(dist, catalogs[0]));
  console.log(`catalog chunk: ${size} B gzip (budget ${MAX_CATALOG} B)`);
  if (size > MAX_CATALOG) fail(`catalog chunk ${size} B gzip exceeds ${MAX_CATALOG} B`);
}

process.exit(failed ? 1 : 0);
