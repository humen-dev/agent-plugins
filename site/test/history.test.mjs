import { afterEach, describe, expect, it } from 'vitest';
import { assertFullHistory, readHead, readHistory } from '../scripts/lib/history.mjs';
import { cleanup, commit, git, shallowClone, tempRepo } from './helpers/fixture-repo.mjs';

const URL = 'https://github.com/o/r';
const mp = (...names) => JSON.stringify({ name: 'm', plugins: names.map((n) => ({ name: n, source: `./plugins/${n}` })) });
const pj = (version) => JSON.stringify({ name: 'x', version });
const D = (n) => `2024-01-${String(n).padStart(2, '0')}T12:00:00Z`; // git prints UTC as Z

const dirs = [];
afterEach(() => dirs.splice(0).forEach(cleanup));
const repo = () => {
  const r = tempRepo();
  dirs.push(r);
  return r;
};

describe('readHistory', () => {
  it('orders by date and sha, skips merges, computes updated (AC-5)', () => {
    const r = repo();
    commit(r, { files: { 'README.md': 'x' }, message: 'init', date: D(1) });
    git(r, 'checkout', '-q', '-b', 'side');
    const side = commit(r, { files: { 'plugins/a/f.txt': '1' }, message: 'side', date: D(2) });
    git(r, 'checkout', '-q', 'main');
    const m1 = commit(r, { files: { 'plugins/a/g.txt': '2' }, message: 'main1', date: D(5) });
    git(r, 'merge', '-q', '--no-ff', '-m', 'merge', 'side');
    const e1 = commit(r, { files: { 'plugins/b/f.txt': '1' }, message: 'e1', date: D(9) });
    const e2 = commit(r, { files: { 'plugins/b/f.txt': '2' }, message: 'e2', date: D(9) });

    const { changes, updated } = readHistory(r, URL);
    const [first, second] = [e1, e2].sort();
    expect(changes.map((c) => c.commit)).toEqual([first, second, m1, side]);
    expect(changes.every((c) => c.type === 'change' && c.version === null)).toBe(true);
    expect(changes[0].url).toBe(`${URL}/commit/${first}`);
    expect(changes.map((c) => c.subject)).not.toContain('merge');
    expect(updated.get('b')).toBe(D(9));
    expect(updated.get('a')).toBe(D(5));
  }, 30_000);

  it('adds with plugin.json is one added Change with from null (AC-71, AC-72)', () => {
    const r = repo();
    const sha = commit(r, {
      files: { '.claude-plugin/marketplace.json': mp('a'), 'plugins/a/.claude-plugin/plugin.json': pj('1.0.0') },
      message: 'add a',
      date: D(1),
    });
    const { changes } = readHistory(r, URL);
    expect(changes).toEqual([
      { commit: sha, date: D(1), subject: 'add a', plugin: 'a', type: 'added', version: { from: null, to: '1.0.0' }, url: `${URL}/commit/${sha}` },
    ]);
  }, 30_000);

  it('version change needs plugin.json at parent and commit; delete is change', () => {
    const r = repo();
    commit(r, { files: { '.claude-plugin/marketplace.json': mp('a'), 'plugins/a/.claude-plugin/plugin.json': pj('1.0.0') }, message: 'add', date: D(1) });
    commit(r, { files: { 'plugins/a/.claude-plugin/plugin.json': pj('1.1.0') }, message: 'bump', date: D(2) });
    commit(r, { files: { 'plugins/a/.claude-plugin/plugin.json': null }, message: 'drop json', date: D(3) });
    const { changes } = readHistory(r, URL);
    expect(changes.map((c) => [c.subject, c.type, c.version])).toEqual([
      ['drop json', 'change', null],
      ['bump', 'version', { from: '1.0.0', to: '1.1.0' }],
      ['add', 'added', { from: null, to: '1.0.0' }],
    ]);
  }, 30_000);

  it('one Change per touched plugin (EC-9)', () => {
    const r = repo();
    commit(r, { files: { 'plugins/a/f': '1', 'plugins/b/f': '1' }, message: 'both', date: D(1) });
    const { changes } = readHistory(r, URL);
    expect(changes.map((c) => c.plugin)).toEqual(['a', 'b']);
  }, 30_000);

  it('old names stay; deleted or moved folder is a change (EC-10)', () => {
    const r = repo();
    commit(r, { files: { '.claude-plugin/marketplace.json': mp('old'), 'plugins/old/f': '1' }, message: 'old', date: D(1) });
    commit(r, { files: { 'plugins/old/f': '2' }, message: 'touch old', date: D(2) });
    commit(r, {
      files: { '.claude-plugin/marketplace.json': mp('new'), 'plugins/old': null, 'plugins/new/f': '2' },
      message: 'rename',
      date: D(3),
    });
    const { changes } = readHistory(r, URL);
    expect(changes.map((c) => [c.subject, c.plugin, c.type])).toEqual([
      ['rename', 'new', 'added'],
      ['rename', 'old', 'change'],
      ['touch old', 'old', 'change'],
      ['old', 'old', 'added'],
    ]);
  }, 30_000);
});

describe('head and shallow', () => {
  it('readHead returns sha and committer date', () => {
    const r = repo();
    const sha = commit(r, { files: { f: '1' }, message: 'm', date: D(3) });
    expect(readHead(r)).toEqual({ commit: sha, commitDate: D(3) });
  }, 30_000);

  it('assertFullHistory throws on a shallow clone (AC-9)', () => {
    const r = repo();
    commit(r, { files: { f: '1' }, message: 'a', date: D(1) });
    commit(r, { files: { f: '2' }, message: 'b', date: D(2) });
    const s = shallowClone(r);
    dirs.push(s);
    expect(() => assertFullHistory(s)).toThrow('full git history required (shallow clone)');
    expect(() => assertFullHistory(r)).not.toThrow();
  }, 30_000);
});
