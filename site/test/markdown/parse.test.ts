import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../../src/markdown/parse.ts';

describe('parseMarkdown', () => {
  it('headings clamp to level 3 and CRLF is normalised', () => {
    const b = parseMarkdown('# a\r\n## b\r\n###### c');
    expect(b.map((x) => x.t === 'heading' && x.level)).toEqual([1, 2, 3]);
  });

  it('fenced code is verbatim; an unclosed fence runs to the end', () => {
    expect(parseMarkdown('```js\na <b>\n\n  c\n```')).toEqual([{ t: 'code', lang: 'js', text: 'a <b>\n\n  c' }]);
    expect(parseMarkdown('```\nx\ny')).toEqual([{ t: 'code', lang: '', text: 'x\ny' }]);
  });

  it('inline: code, strong, em, links with formatted text, images, autolinks', () => {
    const [p] = parseMarkdown('a `c` **s** *e* _u_ [`k`](u) ![al](i.png) <https://x.example/y> snake_case_name');
    expect(p).toMatchObject({ t: 'para' });
    const kids = (p as { children: { t: string }[] }).children;
    expect(kids.map((k) => k.t)).toEqual(['text', 'code', 'text', 'strong', 'text', 'em', 'text', 'em', 'text', 'link', 'text', 'image', 'text', 'link', 'text']);
    expect(kids[9]).toEqual({ t: 'link', href: 'u', children: [{ t: 'code', text: 'k' }] });
    expect(kids[11]).toEqual({ t: 'image', src: 'i.png', alt: 'al' });
    expect(kids[14]).toEqual({ t: 'text', text: ' snake_case_name' });
  });

  it('HTML stays text', () => {
    expect(parseMarkdown('<script>x</script>')).toEqual([{ t: 'para', children: [{ t: 'text', text: '<script>x</script>' }] }]);
  });

  it('tables drop the separator row', () => {
    const [tb] = parseMarkdown('| A | B |\n|---|:--|\n| 1 | 2 |');
    expect(tb).toMatchObject({ t: 'table' });
    const t = tb as { head: unknown[]; rows: unknown[] };
    expect(t.head).toHaveLength(2);
    expect(t.rows).toHaveLength(1);
  });

  it('quotes nest to depth 3, deeper ">" stays literal', () => {
    let b = parseMarkdown('>>>> x')[0];
    let depth = 0;
    while (b.t === 'quote') { depth++; b = b.children[0]; }
    expect(depth).toBe(3);
    expect(b).toEqual({ t: 'para', children: [{ t: 'text', text: '> x' }] });
  });

  it('lists: one nested level, deeper items join level 2, continuation lines extend an item', () => {
    const [l] = parseMarkdown('- a\n  1. b\n    - c\n  more\n- d');
    expect(l).toMatchObject({ t: 'list', ordered: false });
    const list = l as { items: { sub: { ordered: boolean; items: { sub: unknown }[] } | null }[] };
    expect(list.items).toHaveLength(2);
    expect(list.items[0].sub?.ordered).toBe(true);
    expect(list.items[0].sub?.items).toHaveLength(2);
    expect(list.items[0].sub?.items.every((i) => i.sub === null)).toBe(true);
  });

  it('hr and paragraph joining', () => {
    expect(parseMarkdown('a\nb\n\n---')).toEqual([{ t: 'para', children: [{ t: 'text', text: 'a b' }] }, { t: 'hr' }]);
  });
});
