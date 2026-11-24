import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en.ts';

const BANNED = /safe|secure|trusted|no network/i;

const leaves = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : typeof v === 'object' && v !== null ? Object.values(v).flatMap(leaves) : [];

/** AC-32b: strings that could read as a safety claim. */
const banned = (group: unknown): string[] => leaves(group).filter((s) => BANNED.test(s));

describe('AC-32b banned phrases', () => {
  it('runs.* and md.* contain none', () => {
    expect(banned(en.runs)).toEqual([]);
    expect(banned(en.md)).toEqual([]);
  });

  it('flags a planted value, nested and in any case', () => {
    expect(banned({ a: 'This is Safe' })).toEqual(['This is Safe']);
    expect(banned({ a: { one: 'x', other: 'No Network needed' } })).toHaveLength(1);
    expect(banned({ a: 'Trusted', b: 'secure', c: 'fine' })).toHaveLength(2);
  });
});
