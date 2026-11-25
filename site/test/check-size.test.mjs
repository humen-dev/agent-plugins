import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../scripts/check-size.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'check-size-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

// files: { 'assets/x.js': bytes }; scripts/preloads: file paths referenced from index.html.
function run({ files = {}, scripts = [], preloads = [], noArg = false }) {
  const dist = mkdtempSync(join(root, 'dist-'));
  mkdirSync(join(dist, 'assets'));
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(dist, name), bytes);
  const tags = [
    ...scripts.map((s) => `<script type="module" src="/agent-plugins/${s}"></script>`),
    ...preloads.map((s) => `<link rel="modulepreload" href="/agent-plugins/${s}">`),
  ];
  writeFileSync(join(dist, 'index.html'), `<html><head>${tags.join('')}</head></html>`);
  return spawnSync(process.execPath, noArg ? [SCRIPT] : [SCRIPT, dist], { encoding: 'utf8' });
}

const ok = { 'assets/index-a.js': randomBytes(1000), 'assets/catalog-b.js': randomBytes(1000) };
const base = { files: ok, scripts: ['assets/index-a.js'] };

describe('check-size', () => {
  it('passes within budget and prints both lines', () => {
    const r = run(base);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/initial JS: \d+ B gzip \(budget 120000 B\)/);
    expect(r.stdout).toMatch(/catalog chunk: \d+ B gzip \(budget 300000 B\)/);
  });

  it('fails when initial JS is over budget', () => {
    const r = run({ ...base, files: { ...ok, 'assets/index-a.js': randomBytes(130000) } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('::error::initial JS');
  });

  it('fails when the catalog chunk is over budget', () => {
    const r = run({ ...base, files: { ...ok, 'assets/catalog-b.js': randomBytes(310000) } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('::error::catalog chunk');
  });

  it('fails with 0 catalog files', () => {
    const r = run({ files: { 'assets/index-a.js': randomBytes(1000) }, scripts: ['assets/index-a.js'] });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('expected 1 file, found 0');
  });

  it('fails with 2 catalog files', () => {
    const r = run({ ...base, files: { ...ok, 'assets/catalog-c.js': randomBytes(10) } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('expected 1 file, found 2');
  });

  it('does not count a modulepreloaded catalog file as initial JS', () => {
    const r = run({ ...base, files: { ...ok, 'assets/catalog-b.js': randomBytes(130000) }, preloads: ['assets/catalog-b.js'] });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/initial JS: \d{1,5} B/);
  });

  it('fails on a missing referenced file', () => {
    const r = run({ ...base, preloads: ['assets/gone.js'] });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('::error::missing');
  });

  it('exits 2 without argument', () => {
    const r = run({ noArg: true });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('usage: check-size.mjs <dist-dir>');
  });
});
