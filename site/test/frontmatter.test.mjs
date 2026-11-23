import { describe, expect, it } from 'vitest';
import { createDiagnostics } from '../scripts/lib/diagnostics.mjs';
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs';

const run = (/** @type {string} */ fm, body = 'body\n') => {
  const diag = createDiagnostics();
  const r = parseFrontmatter(`---\n${fm}\n---\n${body}`, 'p.md', diag);
  return { ...r, diags: diag.list() };
};

describe('parseFrontmatter', () => {
  it('no frontmatter', () => {
    const diag = createDiagnostics();
    expect(parseFrontmatter('hello', 'p.md', diag)).toEqual({ data: {}, body: 'hello' });
  });

  it('unquoted ": " in a value parses without diagnostic (AC-66)', () => {
    const r = run('description: Use when: X');
    expect(r.data.description).toBe('Use when: X');
    expect(r.diags).toEqual([]);
    expect(r.body).toBe('body\n');
  });

  it('skips comments inside lists and types numbers (AC-3)', () => {
    const r = run('skills:\n  - a:b\n  # note\n  - c\nmaxTurns: 100\nflag: true');
    expect(r.data).toEqual({ skills: ['a:b', 'c'], maxTurns: 100, flag: true });
    // same through the line reader (syntax error elsewhere)
    const l = run('skills:\n  - a:b\n  # note\n  - c\nmaxTurns: 100\nflag: true\ndescription: Use when: X');
    expect(l.data).toEqual({ skills: ['a:b', 'c'], maxTurns: 100, flag: true, description: 'Use when: X' });
    expect(l.diags).toEqual([]);
  });

  it('folds descriptions into one line', () => {
    expect(run('description: >\n  one\n  two').data.description).toBe('one two');
    expect(run('description: >\n  one\n  two\nx: a: b').data.description).toBe('one two');
  });

  it('billion laughs: line reader, warning, fast, bounded (UT-10a/b)', () => {
    let fm = 'a0: &a0 [x, x, x, x, x, x, x, x, x, x]\n';
    for (let i = 1; i < 9; i++) {
      const p = `*a${i - 1}`;
      fm += `a${i}: &a${i} [${Array(10).fill(p).join(', ')}]\n`;
    }
    fm += 'description: ok';
    const t = Date.now();
    const r = run(fm);
    expect(Date.now() - t).toBeLessThan(1000);
    expect(JSON.stringify(r.data).length).toBeLessThan(10_000);
    expect(r.data.description).toBe('ok');
    expect(r.diags).toHaveLength(1);
    expect(r.diags[0].path).toBe('p.md');
    expect(r.diags[0].message).toMatch(/^frontmatter: YAML rejected \(.+\); read line by line$/);
  });

  it('custom tag: line reader plus warning', () => {
    const r = run('name: !!js/function x\ndescription: ok');
    expect(r.data.description).toBe('ok');
    expect(r.diags.map((d) => d.message)).toEqual([
      expect.stringMatching(/^frontmatter: YAML rejected \(.+\); read line by line$/),
    ]);
  });

  it('drops unsupported values and unreadable keys with one warning each', () => {
    const r = run('a:\nb: [1, 2]\nc: ok');
    expect(r.data).toEqual({ c: 'ok' });
    expect(r.diags.map((d) => d.message)).toEqual([
      'frontmatter: key "a" has an unsupported value',
      'frontmatter: key "b" has an unsupported value',
    ]);
    const u = run('junk line\ndescription: x: y');
    expect(u.data).toEqual({ description: 'x: y' });
    expect(u.diags.map((d) => d.message)).toEqual(['frontmatter: key "junk line" could not be read']);
  });
});
