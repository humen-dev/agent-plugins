import { describe, expect, it } from 'vitest';
import { createDiagnostics, formatWarning } from '../scripts/lib/diagnostics.mjs';

describe('diagnostics', () => {
  it('sorts by path then message, by code unit', () => {
    const d = createDiagnostics();
    d.warn('b', 'x');
    d.warn('a', 'z');
    d.warn('a', 'B');
    d.warn('a', 'a');
    expect(d.list().map((x) => `${x.path}:${x.message}`)).toEqual(['a:B', 'a:a', 'a:z', 'b:x']);
    expect(d.list()[0].level).toBe('warning');
  });

  it('formatWarning keeps a hostile message on one line (AC-65b)', () => {
    const line = formatWarning({ level: 'warning', path: 'a:b,c.md', message: '100%\n::error::x\r' });
    expect(line).toBe('::warning file=a%3Ab%2Cc.md::100%25%0A::error::x%0D');
    expect(line).not.toMatch(/[\r\n]/);
  });
});
