import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { GeneratorError, generate } from '../scripts/generate.mjs';
import { cleanup, commit, copyFixture, shallowClone, tempRepo } from './helpers/fixture-repo.mjs';

const FIXTURE = resolve(import.meta.dirname, 'fixtures/repo');
const CLI = resolve(import.meta.dirname, '../scripts/generate.mjs');
const REAL_ROOT = resolve(import.meta.dirname, '../..');
const MKT = '.claude-plugin/marketplace.json';
const SENTINEL = 'SENTINEL-ENV-MUST-NOT-LEAK';

const dirs = [];
afterAll(() => dirs.splice(0).forEach(cleanup));
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), 'generate-'));
  dirs.push(d);
  return d;
};

/** @param {Record<string, string | null>} [extra] files committed on top of the fixture */
function fixtureRepo(extra = {}) {
  const r = tempRepo();
  dirs.push(r);
  copyFixture(FIXTURE, r);
  commit(r, { message: 'fixture', date: '2024-01-01T12:00:00Z' });
  commit(r, { files: extra, message: 'second', date: '2024-01-02T12:00:00Z' });
  return r;
}

/** @param {string} root @param {string} out @param {Record<string, string>} [env] @param {string[]} [args] */
function cli(root, out, env = {}, args = ['--root', root]) {
  const e = { ...process.env, ...env };
  if (!('GITHUB_REPOSITORY' in env)) delete e.GITHUB_REPOSITORY;
  return spawnSync(process.execPath, [CLI, '--out', out, ...args], { env: e, encoding: 'utf8' });
}

describe('generate() on the fixture repo', () => {
  it('returns the catalog with model-ordered keys and the serialised json (AC-1)', async () => {
    const root = fixtureRepo();
    const { catalog, json } = await generate({ root, repo: 'o/r' });
    expect(Object.keys(catalog)).toEqual(['marketplace', 'build', 'categories', 'kinds', 'plugins', 'artifacts', 'changes', 'diagnostics']);
    expect(Object.keys(catalog.plugins[0]).slice(-5)).toEqual(['thirdPartyNotices', 'updated', 'artifactIds', 'runs', 'recentChanges']);
    expect(catalog.marketplace.repo).toBe('o/r');
    expect(catalog.kinds).toEqual(['plugin', 'skill', 'agent', 'command', 'hook', 'mcp']);
    expect(json).toBe(`${JSON.stringify(catalog, null, 2)}\n`);
  }, 30_000);

  it('a validator error throws GeneratorError with the validator output (AC-8a)', async () => {
    const root = fixtureRepo({ 'plugins/fixture-minimal/.claude-plugin/plugin.json': null });
    const err = await generate({ root, repo: 'o/r' }).catch((e) => e);
    expect(err).toBeInstanceOf(GeneratorError);
    expect(err.exitCode).toBe(1);
    expect(err.message).toContain('error:');
  }, 30_000);
});

describe('CLI', () => {
  it('failing run: exit 1, validator output on stderr, no file even if one existed (AC-8a, AC-8b)', () => {
    const root = fixtureRepo({ 'plugins/fixture-minimal/.claude-plugin/plugin.json': null });
    const out = join(scratch(), 'catalog.json');
    writeFileSync(out, 'stale');
    const r = cli(root, out, { GITHUB_REPOSITORY: 'o/r' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('error:');
    expect(existsSync(out)).toBe(false);
    expect(existsSync(`${out}.tmp`)).toBe(false);
  }, 30_000);

  it('a validator warning exits 0 and becomes a diagnostic and one ::warning line (AC-8a, AC-65a-d)', () => {
    const root = fixtureRepo({ 'plugins/unlisted/README.md': '# x\n' });
    const out = join(scratch(), 'sub/dir/catalog.json');
    const r = cli(root, out, { GITHUB_REPOSITORY: 'o/r' });
    expect(r.status).toBe(0);
    const catalog = JSON.parse(readFileSync(out, 'utf8'));
    expect(catalog.diagnostics).toContainEqual({
      level: 'warning', path: MKT, message: 'plugins/unlisted: folder is not listed in marketplace.json',
    });
    const lines = r.stdout.split('\n').filter(Boolean);
    expect(lines).toHaveLength(catalog.diagnostics.length);
    expect(lines.every((l) => l.startsWith('::warning file='))).toBe(true);
    expect(lines).toContain('::warning file=.claude-plugin/marketplace.json::plugins/unlisted: folder is not listed in marketplace.json');
  }, 30_000);

  it('shallow clone: exit 1 and the exact message (AC-9)', () => {
    const shallow = shallowClone(fixtureRepo());
    dirs.push(shallow);
    const out = join(scratch(), 'catalog.json');
    const r = cli(shallow, out, { GITHUB_REPOSITORY: 'o/r' });
    expect(r.status).toBe(1);
    expect(r.stderr.trim()).toBe('full git history required (shallow clone)');
    expect(existsSync(out)).toBe(false);
  }, 30_000);

  it('copies only GITHUB_REPOSITORY from the environment (UT-9b)', () => {
    const root = fixtureRepo();
    const out = join(scratch(), 'catalog.json');
    const r = cli(root, out, { GITHUB_REPOSITORY: 'env-owner/env-repo', SENTINEL_VAR: SENTINEL });
    expect(r.status).toBe(0);
    const text = readFileSync(out, 'utf8');
    expect(text).not.toContain(SENTINEL);
    expect(r.stdout).not.toContain(SENTINEL);
    expect(JSON.parse(text).marketplace.repo).toBe('env-owner/env-repo');
  }, 30_000);

  it('--repo wins over GITHUB_REPOSITORY; a missing or malformed repo is a usage error (Decision 12)', () => {
    const root = fixtureRepo();
    const out = join(scratch(), 'catalog.json');
    expect(cli(root, out, { GITHUB_REPOSITORY: 'env/env' }, ['--root', root, '--repo', 'flag/flag']).status).toBe(0);
    expect(JSON.parse(readFileSync(out, 'utf8')).marketplace.repo).toBe('flag/flag');
    const out2 = join(scratch(), 'catalog.json');
    expect(cli(root, out2, {}).status).toBe(2);
    expect(cli(root, out2, { GITHUB_REPOSITORY: 'bad repo' }).status).toBe(2);
    expect(existsSync(out2)).toBe(false);
  }, 30_000);

  it('is byte-identical across runs, locales and time zones (NFR-10a, NFR-10b)', () => {
    const root = fixtureRepo({ 'plugins/unlisted/README.md': '# x\n' });
    const run = (env) => {
      const out = join(scratch(), 'catalog.json');
      const r = cli(root, out, { GITHUB_REPOSITORY: 'o/r', ...env });
      expect(r.status).toBe(0);
      return [readFileSync(out), r.stdout];
    };
    const a = run({});
    const b = run({});
    const de = run({ LANG: 'de_DE.UTF-8', TZ: 'Asia/Tokyo' });
    const c = run({ LANG: 'C', TZ: 'UTC' });
    for (const x of [b, de, c]) {
      expect(x[0].equals(a[0])).toBe(true);
      expect(x[1]).toBe(a[1]);
    }
  }, 30_000);
});

describe('real repo determinism', () => {
  it('two locales give identical bytes (NFR-10b)', () => {
    const run = (env) => {
      const out = join(scratch(), 'catalog.json');
      const r = cli(REAL_ROOT, out, { GITHUB_REPOSITORY: 'o/r', ...env }, []);
      expect(r.status, r.stderr).toBe(0);
      return readFileSync(out);
    };
    expect(run({ LANG: 'de_DE.UTF-8', TZ: 'Asia/Tokyo' }).equals(run({ LANG: 'C', TZ: 'UTC' }))).toBe(true);
  }, 60_000);
});
