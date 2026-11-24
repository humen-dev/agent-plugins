import { describe, expect, it } from 'vitest';
import { CSP, htmlPlugin } from '../../vite.config.ts';

const transform = (html: string): string => {
  const hook = htmlPlugin().transformIndexHtml as { handler: (h: string) => string };
  return hook.handler(html);
};

const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

describe('htmlPlugin', () => {
  it('pins the CSP', () => {
    expect(CSP).toBe(EXPECTED_CSP);
  });

  it('adds the CSP meta after <meta charset> and puts theme-init before the first stylesheet', () => {
    // Vite appends the stylesheet link after the source's own tags; the source script may sit after it.
    const out = transform(
      '<head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/agent-plugins/assets/a.css">' +
        '<script src="/agent-plugins/theme-init.js"></script></head>',
    );
    const csp = `<meta http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}">`;
    expect(out).toContain(`<meta charset="utf-8">\n    ${csp}`);
    expect(out.match(/theme-init\.js/g)).toHaveLength(1);
    const script = out.indexOf('<script src="/agent-plugins/theme-init.js"></script>');
    expect(script).toBeGreaterThan(-1);
    expect(script).toBeLessThan(out.indexOf('<link rel="stylesheet"'));
  });

  it('fails the build when the exact theme-init tag is missing', () => {
    expect(() => transform('<head><meta charset="utf-8"><link rel="stylesheet" href="a.css"></head>')).toThrow(
      /theme-init\.js"><\/script> not found/,
    );
    // A variant tag (here with defer) is not the one we move, so it must not be silently accepted.
    expect(() =>
      transform('<head><meta charset="utf-8"><script defer src="/agent-plugins/theme-init.js"></script></head>'),
    ).toThrow(/not found/);
  });
});
