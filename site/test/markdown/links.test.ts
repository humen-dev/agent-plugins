import { describe, expect, it } from 'vitest';
import { resolveTarget } from '../../src/markdown/links.ts';

const root = 'https://github.com/o/r/blob/abc/';
const file = `${root}plugins/p/skills/s/SKILL.md`;
const r = (raw: string, kind: 'link' | 'image' = 'link') => resolveTarget(raw, file, root, kind);

describe('resolveTarget', () => {
  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' \tjavascript:x', 'java\tscript:x', 'data:text/html,x', 'vbscript:x', 'ftp:x', 'file:x'])(
    'rejects %j',
    (raw) => expect(r(raw)).toBeNull(),
  );

  it('allows http, https and mailto for links; mailto not for images', () => {
    expect(r('https://x.example/a')).toEqual({ href: 'https://x.example/a', github: false });
    expect(r('http://x.example/')?.href).toBe('http://x.example/');
    expect(r('mailto:a@b.example')?.href).toBe('mailto:a@b.example');
    expect(r('mailto:a@b.example', 'image')).toBeNull();
    expect(r('https://github.com/o/r')?.github).toBe(true);
  });

  it('resolves relative targets against the file blob URL', () => {
    expect(r('references/x.md')?.href).toBe(`${root}plugins/p/skills/s/references/x.md`);
    expect(r('../../README.md#install')?.href).toBe(`${root}plugins/p/README.md#install`);
    expect(r('#frag')?.href).toBe(`${file}#frag`);
  });

  it('rejects targets outside the blob root', () => {
    for (const raw of ['../../../../../../x', '/x', '//evil.example', '\\\\evil.example']) expect(r(raw), raw).toBeNull();
  });
});
