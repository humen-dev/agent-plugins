import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('../../public/theme-init.js', import.meta.url), 'utf8');

function run(storage: { getItem(k: string): string | null }): string | null {
  const root = { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } };
  new Function('document', 'localStorage', src)({ documentElement: root }, storage);
  return root.attrs['data-theme'] ?? null;
}

describe('theme-init.js', () => {
  it('defaults to dark', () => {
    expect(run({ getItem: () => null })).toBe('dark');
    expect(run({ getItem: () => 'bogus' })).toBe('dark');
  });
  it('stays dark when storage throws', () => {
    expect(run({ getItem: () => { throw new Error('blocked'); } })).toBe('dark');
  });
  it('uses light only for "light"', () => {
    expect(run({ getItem: (k) => (k === 'catalog.theme' ? 'light' : null) })).toBe('light');
  });
});
