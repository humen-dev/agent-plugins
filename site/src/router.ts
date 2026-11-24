import type { Catalog } from './catalog/types.ts';
import type { SearchState } from './search/search.ts';

export type Route =
  | { name: 'home'; q: string; kinds: string[]; cats: string[] }
  | { name: 'plugin'; plugin: string } | { name: 'artifact'; plugin: string; kind: string; artifact: string }
  | { name: 'install' } | { name: 'new' } | { name: 'notfound' };

const NOT_FOUND: Route = { name: 'notfound' };
const MAX_Q = 200;

export function parseHash(hash: string): Route {
  const s = hash.replace(/^#\/?/, '');
  const qi = s.indexOf('?');
  const params = new URLSearchParams(qi >= 0 ? s.slice(qi + 1) : '');
  let seg: string[];
  try {
    seg = (qi >= 0 ? s.slice(0, qi) : s).split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return NOT_FOUND;
  }
  const list = (k: string) => (params.get(k) ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (seg.length === 0) return { name: 'home', q: (params.get('q') ?? '').slice(0, MAX_Q), kinds: list('kind'), cats: list('cat') };
  if (seg[0] === 'plugins' && seg.length === 2) return { name: 'plugin', plugin: seg[1] };
  if (seg[0] === 'plugins' && seg.length === 4) return { name: 'artifact', plugin: seg[1], kind: seg[2], artifact: seg[3] };
  if (seg.length === 1 && seg[0] === 'install') return { name: 'install' };
  if (seg.length === 1 && seg[0] === 'new') return { name: 'new' };
  return NOT_FOUND;
}

export function sanitize(r: Extract<Route, { name: 'home' }>, c: Catalog): SearchState {
  return {
    q: r.q.slice(0, MAX_Q),
    kinds: c.kinds.filter((k) => r.kinds.includes(k)),
    cats: c.categories.filter((k) => r.cats.includes(k)),
  };
}

export function searchHash(s: SearchState): string {
  const enc = (l: string[]) => l.map(encodeURIComponent).join(',');
  const parts = [
    s.q ? `q=${encodeURIComponent(s.q)}` : '',
    s.kinds.length ? `kind=${enc(s.kinds)}` : '',
    s.cats.length ? `cat=${enc(s.cats)}` : '',
  ].filter(Boolean);
  return parts.length ? `#/?${parts.join('&')}` : '#/';
}
