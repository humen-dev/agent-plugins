import { describe, expect, it } from 'vitest';
import { installHash, parseP } from '../../src/install/link.ts';

describe('installHash', () => {
  it('sorts and encodes', () => {
    expect(installHash(['b', 'a'])).toBe('#/install?p=a,b');
    expect(installHash([])).toBe('#/install');
  });
});

describe('parseP', () => {
  it('returns null without p', () => {
    expect(parseP('#/install')).toBeNull();
    expect(parseP('#/install?x=1')).toBeNull();
  });

  it('reads an empty p', () => {
    expect(parseP('#/install?p=')).toEqual({ names: [], ignored: 0 });
  });

  it('reads names, trimming and dropping empties', () => {
    expect(parseP('#/install?p=a,%20b,,c')).toEqual({ names: ['a', 'b', 'c'], ignored: 0 });
  });

  it('caps entries at 200 and counts the rest', () => {
    const p = parseP(`#/install?p=${Array(1000).fill('a').join(',')}`);
    expect(p?.names).toHaveLength(200);
    expect(p?.ignored).toBe(800);
  });

  it('reads only the first 2000 chars and counts the tail once', () => {
    const p = parseP(`#/install?p=${'z'.repeat(5000)}`);
    expect(p?.names).toEqual([]); // the only entry was cut, so it is dropped
    expect(p?.ignored).toBe(1);
  });

  it('drops an entry the 2000-char cut lands inside, so a truncated name never matches', () => {
    const head = `${'q'.repeat(2000 - 'django-expert'.length - 1)},`;
    const p = parseP(`#/install?p=${head}django-expert-xyz,other`);
    expect(p?.names).toEqual(['q'.repeat(head.length - 1)]);
    expect(p?.names).not.toContain('django-expert');
    expect(p?.ignored).toBe(1);
  });

  it('keeps the last entry when the cut lands exactly on a comma', () => {
    const head = 'q'.repeat(2000);
    expect(parseP(`#/install?p=${head},django-expert`)).toEqual({ names: [head], ignored: 1 });
  });
});
