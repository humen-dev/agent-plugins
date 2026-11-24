// Fails the build when test fixture data leaked into the real catalog (SPEC-01 AC-7b).
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: check-fixtures.mjs <catalog.json>');
  process.exit(2);
}

const catalog = JSON.parse(readFileSync(file, 'utf8'));
const names = new Set();
for (const p of catalog.plugins ?? []) if (String(p.name).startsWith('fixture-')) names.add(p.name);
for (const a of catalog.artifacts ?? []) if (String(a.plugin).startsWith('fixture-')) names.add(a.plugin);

if (names.size > 0) {
  console.error(`fixture data in catalog: ${[...names].sort().join(', ')}`);
  process.exit(1);
}
