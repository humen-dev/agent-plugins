import { describe, expect, it } from 'vitest';
import { parseHash, sanitize, searchHash } from '../../src/router.ts';
import { catalogOf, plugin, artifact } from '../search/fixture-catalog.ts';

describe('parseHash', () => {
  it('maps the six route shapes', () => {
    expect(parseHash('')).toEqual({ name: 'home', q: '', kinds: [], cats: [] });
    expect(parseHash('#/?q=a%20b&kind=skill,hook&cat=backend')).toEqual({ name: 'home', q: 'a b', kinds: ['skill', 'hook'], cats: ['backend'] });
    expect(parseHash('#/plugins/p')).toEqual({ name: 'plugin', plugin: 'p' });
    expect(parseHash('#/plugins/p/skill/n')).toEqual({ name: 'artifact', plugin: 'p', kind: 'skill', artifact: 'n' });
    expect(parseHash('#/install?p=a,b')).toEqual({ name: 'install' });
    expect(parseHash('#/new')).toEqual({ name: 'new' });
  });

  it('gives notfound for unknown paths and bad escapes', () => {
    for (const h of ['#/nope', '#/plugins', '#/plugins/a/b', '#/plugins/%E0%A4%A', '#/new/x']) {
      expect(parseHash(h)).toEqual({ name: 'notfound' });
    }
  });

  it('caps q at 200 chars', () => {
    const r = parseHash(`#/?q=${'a'.repeat(250)}`);
    expect(r.name === 'home' && r.q.length).toBe(200);
  });
});

describe('sanitize / searchHash', () => {
  const c = catalogOf(
    [plugin('a', { category: 'backend' }), plugin('b', { category: 'data' })],
    [artifact('skill', 'a', 's'), artifact('hook', 'a', 'h')],
  );

  it('drops unknown kinds and cats, keeps known ones in catalog order, dedups', () => {
    const s = sanitize({ name: 'home', q: 'x', kinds: ['hook', 'bogus', 'skill', 'skill'], cats: ['data', 'zzz', 'backend'] }, c);
    expect(s).toEqual({ q: 'x', kinds: ['skill', 'hook'], cats: ['backend', 'data'] });
  });

  it('writes only non-empty params', () => {
    expect(searchHash({ q: '', kinds: [], cats: [] })).toBe('#/');
    expect(searchHash({ q: 'a&b', kinds: ['skill', 'hook'], cats: ['x y'] })).toBe('#/?q=a%26b&kind=skill,hook&cat=x%20y');
  });
});
