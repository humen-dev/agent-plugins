import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDiagnostics } from '../scripts/lib/diagnostics.mjs';
import { createReader } from '../scripts/lib/safe-fs.mjs';

const W = 'plugins/p';
/** @type {string} */
let root;
let linkOk = true;
let dirLinkOk = true;
let pluginLinkOk = true;
/** @type {string} */
let outside;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'safefs-'));
  outside = mkdtempSync(join(tmpdir(), 'safefs-out-'));
  writeFileSync(join(outside, 'x.md'), 'OUTSIDE');
  mkdirSync(join(root, W, 'sub'), { recursive: true });
  mkdirSync(join(root, W, 'node_modules'), { recursive: true });
  writeFileSync(join(root, 'secret.txt'), 'TOPSECRET');
  writeFileSync(join(root, W, 'ok.md'), 'hello');
  writeFileSync(join(root, W, 'sub', 'b.md'), 'b');
  writeFileSync(join(root, W, '.hidden'), 'h');
  writeFileSync(join(root, W, 'node_modules', 'x.md'), 'x');
  writeFileSync(join(root, W, 'big.md'), Buffer.alloc(1_048_577, 97));
  writeFileSync(join(root, W, 'edge.md'), Buffer.alloc(1_048_576, 97));
  writeFileSync(join(root, W, 'bad.md'), Buffer.from([0xff, 0xfe, 0x41]));
  writeFileSync(join(root, W, 'bad.json'), '{nope');
  try {
    symlinkSync(join(root, 'secret.txt'), join(root, W, 'link.md'));
  } catch {
    linkOk = false;
  }
  try {
    symlinkSync(root, join(root, W, 'dirlink'), 'junction');
  } catch {
    dirLinkOk = false;
  }
  try {
    symlinkSync(outside, join(root, 'plugins', 'q'), 'junction');
  } catch {
    pluginLinkOk = false;
  }
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

const setup = () => {
  const diag = createDiagnostics();
  return { diag, r: createReader(root, diag) };
};

describe('safe-fs', () => {
  it('reads a normal file; missing file is null without warning', () => {
    const { diag, r } = setup();
    expect(r.readText(`${W}/ok.md`, W)).toBe('hello');
    expect(r.readText(`${W}/nope.md`, W)).toBeNull();
    expect(diag.list()).toEqual([]);
  });

  it('symlinked file: null, one warning, content never read (UT-7)', (ctx) => {
    if (!linkOk) ctx.skip('symlinkSync failed (EPERM)');
    const { diag, r } = setup();
    expect(r.readText(`${W}/link.md`, W)).toBeNull();
    expect(diag.list()).toEqual([{ level: 'warning', path: `${W}/link.md`, message: 'file: symlink, skipped' }]);
  });

  it('realpath outside within: null, one warning (UT-7)', (ctx) => {
    if (!dirLinkOk) ctx.skip('directory link failed (EPERM)');
    const { diag, r } = setup();
    expect(r.readText(`${W}/dirlink/secret.txt`, W)).toBeNull();
    expect(diag.list().map((d) => d.message)).toEqual(['file: outside the plugin folder, skipped']);
  });

  it('symlinked plugin folder outside the repo: null, one warning, content never read (UT-7)', (ctx) => {
    if (!pluginLinkOk) ctx.skip('directory link failed (EPERM)');
    const { diag, r } = setup();
    expect(r.readText('plugins/q/x.md', 'plugins/q')).toBeNull();
    expect(diag.list()).toEqual([
      { level: 'warning', path: 'plugins/q/x.md', message: 'file: outside the plugin folder, skipped' },
    ]);
  });

  it('oversized and non-UTF-8 files: null, one warning each (UT-8)', () => {
    const { diag, r } = setup();
    expect(r.readText(`${W}/edge.md`, W)).toHaveLength(1_048_576);
    expect(r.readText(`${W}/big.md`, W)).toBeNull();
    expect(r.readText(`${W}/bad.md`, W)).toBeNull();
    expect(diag.list().map((d) => d.message)).toEqual([
      'file: not valid UTF-8, skipped', // list() sorts by path: bad.md < big.md
      'file: larger than 1 MB, skipped',
    ]);
  });

  it('readJson: invalid JSON warns and returns null', () => {
    const { diag, r } = setup();
    expect(r.readJson(`${W}/bad.json`, W)).toBeNull();
    expect(diag.list()[0].message).toMatch(/^json: invalid \(/);
  });

  it('throws outside .claude-plugin/ and plugins/ (UT-9a)', () => {
    const { r } = setup();
    expect(() => r.readText('secret.txt', W)).toThrow();
    expect(() => r.readText('plugins/../secret.txt', W)).toThrow();
    expect(() => r.list('.', W)).toThrow();
  });

  it('list: sorted, recursive, skips dot-entries, node_modules and links', () => {
    const { r } = setup();
    const l = r.list(W, W);
    expect(l).toContain(`${W}/ok.md`);
    expect(l).toContain(`${W}/sub/b.md`);
    expect(l.some((p) => p.includes('.hidden') || p.includes('node_modules') || p.includes('dirlink'))).toBe(false);
    expect(l).toEqual([...l].sort());
  });
});
