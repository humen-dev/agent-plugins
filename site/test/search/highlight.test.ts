import { describe, expect, it } from 'vitest';
import { cut, firstHit, segments } from '../../src/search/highlight.ts';

describe('highlight', () => {
  it('cut keeps at most max chars including the ellipsis', () => {
    expect(cut('short', 160)).toBe('short');
    const out = cut('word '.repeat(100), 160);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
  });

  it('marks words by their index terms', () => {
    expect(segments('Safe Migrations, now', ['migration'])).toEqual([
      { text: 'Safe ', mark: false },
      { text: 'Migrations', mark: true },
      { text: ', now', mark: false },
    ]);
    expect(firstHit('a b migrations', ['migration'])).toBe(4);
    expect(firstHit('nothing', ['migration'])).toBe(-1);
  });

  it('returns hostile input as plain text (EC-2b)', () => {
    const text = '<script>alert(1)</script> .* ((';
    const out = segments(text, ['script']);
    expect(out.map((s) => s.text).join('')).toBe(text);
    expect(out.filter((s) => s.mark).map((s) => s.text)).toEqual(['script', 'script']);
  });
});
