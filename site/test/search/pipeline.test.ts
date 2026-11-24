import { describe, expect, it } from 'vitest';
import { indexTerms, normalise, parseQuery, stem, tokenise } from '../../src/search/pipeline.ts';

describe('pipeline', () => {
  it('normalises case, NFKD and combining marks (AC-16c)', () => {
    expect(normalise('Café')).toBe('cafe');
    expect(indexTerms('Café')).toEqual(['cafe']);
  });

  it('keeps hyphenated tokens whole and split (AC-16c)', () => {
    expect(tokenise('zero-downtime')).toEqual(['zero-downtime', 'zero', 'downtime']);
    expect(indexTerms('zero-downtime')).toEqual(['zero-downtime', 'zero', 'downtime']);
    expect(tokenise('snake_case a.b')).toEqual(['snake_case', 'snake', 'case', 'a', 'b']);
  });

  it('stems tokens of 5+ chars with the first matching suffix (AC-16c)', () => {
    expect(stem('migrations')).toBe('migration');
    expect(stem('stories')).toBe('story');
    expect(stem('planning')).toBe('plann');
    expect(stem('tested')).toBe('test');
    expect(stem('boxes')).toBe('box');
    expect(stem('tests')).toBe('test');
    expect(stem('plan')).toBe('plan'); // under 5 chars
  });

  it('drops stop words from indexed text and queries (AC-16a)', () => {
    expect(indexTerms('the use of a tool')).toEqual([]);
    expect(parseQuery('the').terms).toEqual([]);
    expect(parseQuery('need celery').terms).toEqual(parseQuery('celery').terms);
  });

  it('moves kind words to hints, in Kind order (EC-1)', () => {
    expect(parseQuery('I need a')).toEqual({ terms: [], synonymTerms: [], kindHints: [] });
    expect(parseQuery('I need a skill')).toEqual({ terms: [], synonymTerms: [], kindHints: ['skill'] });
    expect(parseQuery('servers hooks migration').kindHints).toEqual(['hook', 'mcp']);
    expect(parseQuery('constructor').terms).toEqual(['constructor']); // no prototype lookup
  });

  it('expands synonyms in both directions, never repeating a direct term (AC-16d)', () => {
    expect(parseQuery('audit').synonymTerms).toEqual(['review']); // a value expands to its key
    expect(parseQuery('review').synonymTerms).toEqual(['audit', 'reviewer', 'code']); // a key expands to its values
    expect(parseQuery('planning').synonymTerms).toEqual(['plan']);
    expect(parseQuery('code review').synonymTerms).toEqual(expect.arrayContaining(['audit', 'reviewer']));
    expect(parseQuery('review audit').synonymTerms).not.toContain('audit');
  });

  it('reads only the first 200 chars of the query (EC-2a)', () => {
    const q = `celery${' '.repeat(194)}worker${'x'.repeat(44)}`;
    expect(q).toHaveLength(250);
    expect(parseQuery(q)).toEqual(parseQuery(q.slice(0, 200)));
  });
});
