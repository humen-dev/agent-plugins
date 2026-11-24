import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const cwd = join(import.meta.dirname, '..');
const eslint = new ESLint({ cwd });

const SNIPPETS: Record<string, string> = {
  dangerouslySetInnerHTML: `export const a = (h: string) => <div dangerouslySetInnerHTML={{ __html: h }} />;`,
  innerHTML: `export const a = (e: Element, h: string) => { e.innerHTML = h; };`,
  outerHTML: `export const a = (e: Element, h: string) => { e.outerHTML = h; };`,
  insertAdjacentHTML: `export const a = (e: Element, h: string) => { e.insertAdjacentHTML('beforeend', h); };`,
};

describe('UT-3 banned HTML sinks', () => {
  for (const [name, code] of Object.entries(SNIPPETS)) {
    it(`reports ${name} under src/`, async () => {
      const [r] = await eslint.lintText(code, { filePath: join(cwd, 'src', 'snippet.tsx') });
      expect(r.messages.filter((m) => m.ruleId === 'no-restricted-syntax')).toHaveLength(1);
    });
  }

  it('accepts plain text rendering', async () => {
    const [r] = await eslint.lintText(`export const a = (s: string) => <p>{s}</p>;`, { filePath: join(cwd, 'src', 'snippet.tsx') });
    expect(r.messages).toEqual([]);
  });
});
