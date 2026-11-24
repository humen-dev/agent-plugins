// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownBlock } from '../../src/markdown/MarkdownBlock.tsx';
import { catalogOf, md } from '../search/fixture-catalog.ts';

afterEach(cleanup);

const cat = catalogOf([]);
const path = 'plugins/p/skills/s/SKILL.md';
const view = (source: string) => render(<MarkdownBlock doc={md(path, source)} catalog={cat} />).container;
const created = (c: HTMLElement) => c.querySelectorAll('script, img, iframe, object, embed, [onerror]').length;

describe('MarkdownBlock', () => {
  it('HTML renders as visible text in blocks, inline, table cells and link text', () => {
    const src = '<script>a</script>\n\ntext <img src=x onerror=alert(1)> <iframe src=x></iframe>\n\n| h |\n|---|\n| <script>c</script> |\n\n[<img onerror=x>](https://x.example)';
    const c = view(src);
    expect(created(c)).toBe(0);
    expect(c.textContent).toContain('<script>a</script>');
    expect(c.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(c.textContent).toContain('<script>c</script>');
  });

  it.each([
    ['paragraph', '[x](JaVaScRiPt:alert(1))'],
    ['heading', '# [x](javascript:alert(1))'],
    ['list', '- [x](data:text/html,y)'],
    ['quote', '> [x](vbscript:y)'],
    ['table', '| [x](ftp:x) |'],
    ['tab', '[x]( \tjavascript:y)'],
    ['file', '[x](file:y)'],
  ])('dangerous link in %s gives the text and no anchor', (_n, src) => {
    const c = view(src);
    expect(c.querySelector('a')).toBeNull();
    expect(c.textContent).toContain('x');
  });

  it('https and mailto give safe anchors', () => {
    const c = view('[a](https://x.example) [b](mailto:m@x.example) [c](https://github.com/o/r)');
    const a = [...c.querySelectorAll('a')];
    expect(a).toHaveLength(3);
    for (const x of a) {
      expect(x.getAttribute('target')).toBe('_blank');
      expect(x.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(a[0].textContent).toContain('(external link)');
    expect(a[1].textContent).not.toContain('(external link)');
    expect(a[2].textContent).toContain('(opens on GitHub)');
  });

  it('relative links resolve to the pinned blob URL', () => {
    const c = view('[x](references/x.md) [y](#frag) [z](/x) [w](//evil.example)');
    const hrefs = [...c.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      'https://github.com/o/r/blob/c/plugins/p/skills/s/references/x.md',
      `https://github.com/o/r/blob/c/${path}#frag`,
    ]);
  });

  it('images become links, never img', () => {
    const c = view('![d](https://x.example/y.png)');
    expect(c.querySelector('img')).toBeNull();
    expect(c.querySelector('a')?.getAttribute('href')).toBe('https://x.example/y.png');
    expect(c.textContent).toContain('d');
    expect(c.textContent).toContain('(image, not loaded)');
    const bad = view('![x](javascript:alert(1))');
    expect(bad.querySelector('a')).toBeNull();
    expect(bad.textContent).toBe('x');
  });

  it('mermaid fence is a captioned code block, verbatim', () => {
    const c = view('```mermaid\ngraph TD; A-->B\n```');
    expect(c.querySelector('figcaption')?.textContent).toBe('Mermaid diagram (shown as code)');
    expect(c.querySelector('pre')?.getAttribute('tabindex')).toBe('0');
    expect(c.querySelector('pre code')?.textContent).toBe('graph TD; A-->B');
  });

  it('blockquote, nested list, em and linked code', () => {
    const c = view('> q\n\n- a\n  - b\n    - c\n\n*e* _f_ [`k`](https://x.example)');
    expect(c.querySelector('blockquote')).not.toBeNull();
    expect(c.querySelectorAll('ul ul')).toHaveLength(1);
    expect(c.querySelectorAll('ul ul ul')).toHaveLength(0);
    expect(c.querySelectorAll('em')).toHaveLength(2);
    expect(c.querySelector('a > code')?.textContent).toBe('k');
    expect(c.querySelectorAll('blockquote blockquote blockquote blockquote')).toHaveLength(0);
  });

  it('heading, table region', () => {
    const c = view('## T\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(c.querySelector('[role=heading]')?.getAttribute('aria-level')).toBe('4');
    expect(c.querySelector('[role=region][aria-label=Table]')).not.toBeNull();
    expect(c.querySelectorAll('[role=cell]')).toHaveLength(2);
    expect(c.querySelectorAll('[role=columnheader]')).toHaveLength(2);
    expect(c.querySelector('.md-table-capped')).toBeNull();
  });

  const table = (cols: number, rows: number) => {
    const row = (s: string) => `|${Array.from({ length: cols }, () => s).join('|')}|`;
    return [row('h'), row('---'), ...Array.from({ length: rows }, () => row('x'))].join('\n');
  };
  const fileUrl = `https://github.com/o/r/blob/c/${path}`;

  it.each([
    ['rows only', 250, 3, 200, 3, '50 rows'],
    ['columns only', 5, 25, 5, 20, '5 columns'],
    ['both', 205, 22, 200, 20, '5 rows and 2 columns'],
  ])('table capped: %s', (_n, rows, cols, shownRows, shownCols, hidden) => {
    const c = view(table(cols, rows));
    expect(c.querySelectorAll('[role=cell]')).toHaveLength(shownRows * shownCols);
    expect(c.querySelectorAll('[role=columnheader]')).toHaveLength(shownCols);
    const notes = c.querySelectorAll('.md-table-capped');
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toContain(`Not shown: ${hidden}.`);
    expect(notes[0].querySelector('a')?.getAttribute('href')).toBe(fileUrl);
    expect(notes[0].textContent).toContain('(opens on GitHub)');
  });

  it('two capped tables each get their own notice', () => {
    const c = view(`${table(2, 201)}\n\n${table(21, 1)}`);
    const notes = [...c.querySelectorAll('.md-table-capped')].map((n) => n.textContent);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('Not shown: 1 row.');
    expect(notes[1]).toContain('Not shown: 1 column.');
  });
});
