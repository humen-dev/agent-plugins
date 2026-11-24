import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../scripts/check-fixtures.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'check-fixtures-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(catalog) {
  const file = join(dir, `c-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(catalog));
  return spawnSync(process.execPath, [SCRIPT, file], { encoding: 'utf8' });
}

describe('check-fixtures', () => {
  it('passes a catalog without fixture data', () => {
    expect(run({ plugins: [{ name: 'real' }], artifacts: [{ plugin: 'real' }] }).status).toBe(0);
  });

  it('fails on a fixture- plugin', () => {
    const r = run({ plugins: [{ name: 'fixture-full' }], artifacts: [] });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('fixture data in catalog: fixture-full');
  });

  it('fails on an artifact whose plugin starts with fixture-', () => {
    const r = run({ plugins: [{ name: 'real' }], artifacts: [{ plugin: 'fixture-hostile' }] });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('fixture-hostile');
  });
});
