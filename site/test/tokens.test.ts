import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from './helpers/contrast.ts';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const block = (open: string) => {
  const start = css.indexOf(open);
  if (start < 0) throw new Error(`tokens.css: ${open} not found`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};
const themes: Record<string, Record<string, string>> = {
  dark: block(':root, :root[data-theme="dark"]'),
  light: block(':root[data-theme="light"]'),
};

const pairs: [number, string[], string[]][] = [
  [4.5, ['text', 'text-2', 'muted', 'link', 'link-visited'], ['bg', 'surface']],
  [4.5, ['muted'], ['sunken']],
  [4.5, ['on-accent'], ['accent', 'accent-hover', 'accent-pressed']],
  [4.5, ['k-plugin', 'k-skill', 'k-agent', 'k-hook', 'k-command', 'k-mcp'], ['kind-bg']],
  [4.5, ['warn'], ['warn-bg']],
  [4.5, ['ok'], ['ok-bg']],
  [4.5, ['err'], ['err-bg']],
  [4.5, ['info'], ['info-bg']],
  [4.5, ['c-added', 'c-version', 'c-change'], ['surface']],
  [4.5, ['text'], ['mark']],
  [4.5, ['code'], ['code-bg']],
  [3, ['border'], ['bg', 'surface', 'sunken']],
  [3, ['focus'], ['bg', 'surface']],
  [3, ['accent'], ['bg']],
];

describe.each(Object.entries(themes))('token contrast, %s theme', (_name, tokens) => {
  for (const [min, fgs, bgs] of pairs) {
    for (const fg of fgs) {
      for (const bg of bgs) {
        it(`--${fg} on --${bg} >= ${min}:1`, () => {
          expect(tokens[fg], `--${fg} missing`).toBeDefined();
          expect(tokens[bg], `--${bg} missing`).toBeDefined();
          expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
        });
      }
    }
  }
});
