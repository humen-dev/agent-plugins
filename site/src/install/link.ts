import { P_LIMITS, type ParsedP } from './types.ts';

export function parseP(hash: string): ParsedP | null {
  const s = hash.replace(/^#\/?/, '');
  const qi = s.indexOf('?');
  const value = new URLSearchParams(qi >= 0 ? s.slice(qi + 1) : '').get('p');
  if (value === null) return null;
  const cut = value.length > P_LIMITS.chars;
  const parts = value.slice(0, P_LIMITS.chars).split(',');
  // A cut inside an entry leaves a partial name that could match a real plugin: drop it (counted in the +1 below).
  if (cut && value[P_LIMITS.chars] !== ',') parts.pop();
  const entries = parts.map((x) => x.trim()).filter(Boolean);
  return {
    names: entries.slice(0, P_LIMITS.entries),
    ignored: Math.max(0, entries.length - P_LIMITS.entries) + (cut ? 1 : 0),
  };
}

export function installHash(selected: readonly string[]): string {
  return selected.length ? `#/install?p=${[...selected].sort().map(encodeURIComponent).join(',')}` : '#/install';
}
