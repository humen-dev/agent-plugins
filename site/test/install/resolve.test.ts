import { describe, expect, it } from 'vitest';
import { cliText, resolveSet, settingsJson } from '../../src/install/resolve.ts';
import { catalogOf, plugin } from '../search/fixture-catalog.ts';

const dep = (name: string, inCatalog = true, version: string | null = null) => ({ name, version, inCatalog });
const cmd = (n: string) => `claude plugin install ${n}@fixture`;
const mk = (...ps: ReturnType<typeof plugin>[]) => {
  const c = catalogOf(ps);
  c.marketplace.addCommand = 'claude plugin marketplace add o/r';
  return c;
};
const chain = () =>
  mk(
    plugin('a', { dependencies: [dep('b')], installCommand: cmd('a') }),
    plugin('b', { dependencies: [dep('c')], installCommand: cmd('b') }),
    plugin('c', { installCommand: cmd('c') }),
  );

describe('resolveSet', () => {
  it('follows a dependency chain (AC-38a)', () => {
    const r = resolveSet(chain(), ['a']);
    expect(r.final).toEqual(['a', 'b', 'c']);
    expect(r.addedFor).toEqual({ b: ['a'], c: ['b'] });
  });

  it('ends on a cycle', () => {
    const c = mk(plugin('a', { dependencies: [dep('b')] }), plugin('b', { dependencies: [dep('a')] }));
    expect(resolveSet(c, ['a']).final).toEqual(['a', 'b']);
  });

  it('keeps an explicitly selected dependency out of addedFor', () => {
    const r = resolveSet(chain(), ['a', 'b']);
    expect(r.final).toEqual(['a', 'b', 'c']);
    expect(r.addedFor).toEqual({ c: ['b'] });
  });

  it('reports a dependency outside the catalog once (AC-38b)', () => {
    const c = mk(plugin('a', { dependencies: [dep('x', false, '^1')] }));
    const r = resolveSet(c, ['a']);
    expect(r.missing).toEqual([{ dep: 'x', version: '^1', forName: 'a' }]);
    expect(r.final).toEqual(['a']);
  });

  it('drops unknown names (EC-6)', () => {
    const r = resolveSet(mk(plugin('a')), ['ghost', 'a', 'ghost']);
    expect(r.dropped).toEqual(['ghost']);
    expect(r.selected).toEqual(['a']);
  });
});

describe('cliText', () => {
  it('user scope has no flag (AC-39a)', () => {
    expect(cliText(chain(), ['a', 'b'], 'user')).toBe(['claude plugin marketplace add o/r', cmd('a'), cmd('b')].join('\n'));
  });

  it('project scope flags every line (AC-39b)', () => {
    const lines = cliText(chain(), ['a', 'b'], 'project').split('\n');
    expect(lines).toHaveLength(3);
    for (const l of lines) expect(l.endsWith(' --scope project')).toBe(true);
  });
});

describe('settingsJson', () => {
  it('matches the AC-40 form with sorted keys', () => {
    const text = settingsJson(chain(), ['b', 'a']);
    const want = {
      enabledPlugins: { 'a@fixture': true, 'b@fixture': true },
      extraKnownMarketplaces: { fixture: { source: { repo: 'o/r', source: 'github' } } },
    };
    expect(JSON.parse(text)).toEqual(want);
    expect(text).toBe(JSON.stringify(want, null, 2));
  });
});
