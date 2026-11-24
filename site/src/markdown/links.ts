export type Target = { href: string; github: boolean } | null; // null = render as plain text

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// ASCII controls, space and DEL are ignored when classifying a scheme ("java\tscript:", " javascript:").
function stripControls(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c > 32 && c !== 127) out += ch;
  }
  return out;
}

/** One resolver for every link and image node (Decision 2). Only http(s), mailto (links only) and in-repo blob URLs survive. */
export function resolveTarget(raw: string, fileBlobUrl: string, blobRoot: string, kind: 'link' | 'image'): Target {
  const s = raw.trim();
  const scheme = SCHEME.exec(stripControls(s));
  try {
    let href: string;
    if (scheme) {
      const u = new URL(s);
      const allowed = kind === 'image' ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:'];
      if (!allowed.includes(scheme[0].toLowerCase()) || !allowed.includes(u.protocol)) return null;
      href = u.href;
    } else {
      href = new URL(s, fileBlobUrl).href;
      if (!href.startsWith(blobRoot)) return null;
    }
    return { href, github: href.startsWith('https://github.com/') };
  } catch {
    return null;
  }
}
