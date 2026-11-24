import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownBlock } from '../../src/markdown/MarkdownBlock.tsx';
import { parseMarkdown } from '../../src/markdown/parse.ts';
import { catalogOf, md } from '../search/fixture-catalog.ts';

const cat = catalogOf([]);
const MB = 1_000_000;
const rep = (s: string, n: number) => s.repeat(Math.ceil(n / s.length));

const cases: [string, string][] = [
  ...['[', '*', '`', '![', '<', '_', '](', '[a](', '<http://a ', '# ' + ' '.repeat(10)].map((s): [string, string] => [`1 MB of ${JSON.stringify(s)}`, rep(s, MB)]),
  ['1 MB of whitespace then a line separator after "#"', '#' + ' '.repeat(MB) + ' '],
  ['1 MB of whitespace then a line separator after "-"', '-' + ' '.repeat(MB) + ' '],
  ['10 000 nested >', '>'.repeat(10_000) + ' x'],
  ['1 000 list levels', Array.from({ length: 1000 }, (_, i) => `${' '.repeat(i * 2)}- item`).join('\n')],
  ['2 000 x 50 table', Array.from({ length: 2000 }, () => `|${'a|'.repeat(50)}`).join('\n')],
  ['HTML in blocks, inline, tables, link text', '<script>a</script>\n\nx <img onerror=y> <iframe>\n\n| <script> |\n|---|\n| <b onclick=x> |\n\n[<img src=x onerror=y>](https://x.example)'],
  [
    'script schemes in links and images',
    ['javascript:a', 'JaVaScRiPt:a', ' javascript:a', 'java\tscript:a', 'data:text/html,a', 'vbscript:a']
      .flatMap((u) => [`[x](${u})`, `![x](${u})`])
      .join('\n\n'),
  ],
];

describe('hostile input stays fast and inert', () => {
  it.each(cases)('%s', (_name, src) => {
    const t0 = performance.now();
    parseMarkdown(src);
    const t1 = performance.now();
    const html = renderToString(createElement(MarkdownBlock, { doc: md('plugins/p/x.md', src), catalog: cat }));
    const t2 = performance.now();
    expect(t1 - t0).toBeLessThan(500);
    expect(t2 - t1).toBeLessThan(2000);
    expect(html).not.toMatch(/<(script|img|iframe)[\s>]/i);
    expect(html).not.toMatch(/href="(javascript|data|vbscript):/i);
  }, 10_000);
});
