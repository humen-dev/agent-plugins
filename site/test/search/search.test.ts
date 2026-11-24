import { describe, expect, it } from 'vitest';
import { createSearch, type SearchState } from '../../src/search/search.ts';
import { artifact, catalogOf, fieldCatalog, md, plugin } from './fixture-catalog.ts';

const state = (q: string, o: Partial<SearchState> = {}): SearchState => ({ q, kinds: [], cats: [], ...o });
const keys = (c: ReturnType<typeof createSearch>, q: string, o: Partial<SearchState> = {}) => c.run(state(q, o)).cards.map((x) => x.key);

const base = catalogOf(
  [
    plugin('fixture-mig', { category: 'backend', description: 'migration helpers' }),
    plugin('fixture-review', { category: 'docs', description: 'only review here' }),
    plugin('fixture-audit', { category: 'docs', description: 'only audit here' }),
    plugin('fixture-plan', { category: 'docs', description: 'plan the work' }),
    plugin('fixture-cafe', { category: 'docs', description: 'Café menu' }),
    plugin('fixture-work', { category: 'docs', description: 'celery work' }),
    plugin('fixture-down', { category: 'docs', description: 'zero-downtime rollout' }),
  ],
  [artifact('skill', 'fixture-mig', 'runner', { description: 'migration helpers' })],
);
const search = createSearch(base);
const score = (q: string, key: string) => search.run(state(q)).cards.find((c) => c.key === key)?.score;

describe('AC-15 field order', () => {
  it('ranks name > own tags > description > headings > inherited tags = body', () => {
    const out = createSearch(fieldCatalog()).run(state('alpha'));
    expect(out.cards.map((c) => c.key)).toEqual([
      'plugin:alpha', 'plugin:beta', 'plugin:gamma', 'skill:delta/eta', 'skill:delta/theta', 'skill:beta/zeta',
    ]);
    const s = out.cards.map((c) => c.score);
    expect(s[0]).toBeGreaterThan(s[1]);
    expect(s[1]).toBeGreaterThan(s[2]);
    expect(s[2]).toBeGreaterThan(s[3]);
    expect(s[3]).toBeGreaterThan(s[4]);
    expect(s[4]).toBe(s[5]);
  });
});

describe('query behaviour', () => {
  it('"the" alone has no terms; "need celery" equals "celery" (AC-16a)', () => {
    expect(search.run(state('the')).hasTerms).toBe(false);
    expect(search.run(state('need celery'))).toEqual(search.run(state('celery')));
  });

  it('kind word boosts the kind x2 and is not a term (AC-16b)', () => {
    const out = search.run(state('migration skill'));
    expect(out.cards.map((c) => c.key).slice(0, 2)).toEqual(['skill:fixture-mig/runner', 'plugin:fixture-mig']);
    expect(score('migration skill', 'skill:fixture-mig/runner')).toBe(2 * score('migration', 'skill:fixture-mig/runner')!);
  });

  it('stems, splits hyphens and folds accents (AC-16c)', () => {
    expect(keys(search, 'migrations')).toContain('plugin:fixture-mig');
    expect(keys(search, 'downtime')).toEqual(['plugin:fixture-down']);
    expect(keys(search, 'zero-downtime')).toEqual(['plugin:fixture-down']);
    expect(keys(search, 'cafe')).toEqual(['plugin:fixture-cafe']);
  });

  it('synonyms count at 0.5 (AC-16d)', () => {
    expect(keys(search, 'audit')).toEqual(expect.arrayContaining(['plugin:fixture-review', 'plugin:fixture-audit']));
    expect(score('audit', 'plugin:fixture-review')).toBeCloseTo(0.5 * score('review', 'plugin:fixture-review')!, 10);
    expect(keys(search, 'planning')).toContain('plugin:fixture-plan');
  });

  it('prefix needs 3 chars (AC-16e)', () => {
    expect(keys(search, 'migr')).toContain('plugin:fixture-mig');
    expect(keys(search, 'mi')).toEqual([]);
  });

  it('fuzzy needs 5 chars (AC-16f)', () => {
    expect(keys(search, 'celary')).toEqual(['plugin:fixture-work']);
    expect(keys(search, 'wark')).toEqual([]); // distance 1 from "work", but only 4 chars
  });
});

describe('ties and collapse', () => {
  const tie = createSearch(
    catalogOf(
      [plugin('zz', { description: 'tie' }), plugin('aa', { description: 'tie' }), plugin('bb', { description: 'tie' })],
      [
        artifact('agent', 'aa', 'mm', { description: 'tie' }),
        artifact('skill', 'bb', 'mm', { description: 'tie' }),
        artifact('skill', 'aa', 'mm', { description: 'tie' }),
      ],
    ),
  );

  it('orders equal scores by Kind order, name, id (AC-17)', () => {
    const out = tie.run(state('tie'));
    expect(new Set(out.cards.map((c) => c.score)).size).toBe(1);
    expect(out.cards.map((c) => c.key)).toEqual([
      'plugin:aa', 'plugin:bb', 'plugin:zz', 'skill:aa/mm', 'skill:bb/mm', 'agent:aa/mm',
    ]);
  });

  const twin = createSearch(
    catalogOf(
      [plugin('fixture-twin', { description: 'twin things' })],
      [artifact('skill', 'fixture-twin', 'fixture-twin', { description: 'twin skill things here' })],
    ),
  );

  it('merges a plugin and its same-name artifact at the higher score (AC-18a)', () => {
    const out = twin.run(state('twin'));
    expect(out.cards).toHaveLength(1);
    const [card] = out.cards;
    expect(card).toMatchObject({ merged: true, kind: 'skill', key: 'skill:fixture-twin/fixture-twin' });
    expect(card.plugin.name).toBe('fixture-twin');
    const plugOnly = twin.run(state('twin', { kinds: ['plugin'] })).cards[0].score;
    const skillOnly = twin.run(state('twin', { kinds: ['skill'] })).cards[0].score;
    expect(card.score).toBe(Math.max(plugOnly, skillOnly));
  });

  it('does not merge with kind=plugin (AC-18b)', () => {
    const out = twin.run(state('twin', { kinds: ['plugin'] }));
    expect(out.cards).toHaveLength(1);
    expect(out.cards[0]).toMatchObject({ merged: false, kind: 'plugin', artifact: null });
  });
});

describe('snippet', () => {
  const long = `${'lorem ipsum '.repeat(30)}xyzzy ${'dolor sit '.repeat(30)}`;
  const notes = createSearch(
    catalogOf(
      [plugin('fixture-notes')],
      [
        artifact('skill', 'fixture-notes', 'notes', {
          body: md('plugins/fixture-notes/skills/notes/SKILL.md', 'intro text'),
          files: [{ path: 'plugins/fixture-notes/skills/notes/ref/deep.md', title: 'Deep', body: md('plugins/fixture-notes/skills/notes/ref/deep.md', long) }],
        }),
      ],
    ),
  );

  it('shows a <=160 char snippet with the plugin-relative file for a body-only hit (AC-20)', () => {
    const [card] = notes.run(state('xyzzy')).cards;
    expect(card.snippet?.file).toBe('skills/notes/ref/deep.md');
    expect(card.snippet!.text.length).toBeLessThanOrEqual(160);
    expect(card.snippet!.text).toContain('xyzzy');
    expect(card.snippet!.text.startsWith('…') && card.snippet!.text.endsWith('…')).toBe(true);
  });

  it('shows none for a name hit (AC-20)', () => {
    expect(notes.run(state('notes')).cards[0].snippet).toBeNull();
  });
});

describe('filters and empty query', () => {
  const facets = createSearch(
    catalogOf(
      [plugin('fixture-back', { category: 'backend' }), plugin('fixture-doc', { category: 'docs' }), plugin('fixture-twin')],
      [
        artifact('skill', 'fixture-back', 's1'),
        artifact('agent', 'fixture-back', 'a1'),
        artifact('skill', 'fixture-doc', 's2'),
        artifact('agent', 'fixture-doc', 'a2'),
        artifact('skill', 'fixture-twin', 'fixture-twin'),
      ],
    ),
  );

  it('intersects kind and category groups; counts use the other group only (AC-21a, AC-21b)', () => {
    const out = facets.run(state('', { kinds: ['skill'], cats: ['backend'] }));
    expect(out.cards.map((c) => c.key)).toEqual(['skill:fixture-back/s1']);
    expect(out.kindCounts.agent).toBe(1); // category filter applies, kind filter does not
    expect(out.kindCounts.skill).toBe(1);
    expect(out.catCounts).toEqual({ backend: 1, docs: 1 }); // kind filter applies, category filter does not
  });

  it('lists every plugin by name with no merge for an empty query (AC-26a)', () => {
    const out = facets.run(state(''));
    expect(out.cards.map((c) => c.key)).toEqual(['plugin:fixture-back', 'plugin:fixture-doc', 'plugin:fixture-twin']);
    expect(out.cards.every((c) => !c.merged)).toBe(true);
  });

  it('lists every skill by name for an empty query with kind=skill (AC-26b)', () => {
    expect(keys(facets, '', { kinds: ['skill'] })).toEqual([
      'skill:fixture-twin/fixture-twin', 'skill:fixture-back/s1', 'skill:fixture-doc/s2',
    ]);
  });

  it('reports hinted kinds only when no term is left (EC-1)', () => {
    expect(facets.run(state('I need a'))).toMatchObject({ hasTerms: false, hintedKinds: [] });
    expect(facets.run(state('I need a skill'))).toMatchObject({ hasTerms: false, hintedKinds: ['skill'] });
    expect(facets.run(state('s1 skill')).hintedKinds).toEqual([]);
  });

  it('ranks tags by frequency, then name', () => {
    const c = createSearch(catalogOf([plugin('a', { tags: ['x', 'b'] }), plugin('b', { tags: ['b', 'a'] }), plugin('c', { tags: ['z'] })]));
    expect(c.topTags).toEqual(['b', 'a', 'x', 'z']);
  });
});

describe('robustness', () => {
  it('searches the first 200 chars only (EC-2a)', () => {
    const q = `celery${' '.repeat(194)}worker${'x'.repeat(44)}`;
    expect(search.run(state(q))).toEqual(search.run(state(q.slice(0, 200))));
  });

  it('runs hostile queries without throwing (EC-2b)', () => {
    for (const q of ['<script>', '.*', '((', '\\', '[a-', '$&']) expect(() => search.run(state(q))).not.toThrow();
  });

  it('is deterministic and sorted by score (NFR-11, AC-13)', () => {
    const a = createSearch(base).run(state('review migration'));
    const b = createSearch(base).run(state('review migration'));
    expect(a).toEqual(b);
    const scores = a.cards.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
  });
});
