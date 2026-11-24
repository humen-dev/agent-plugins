import type { Kind } from '../catalog/types.ts';
import { KIND_ORDER, KIND_WORDS, STOP_WORDS, SYNONYMS } from './config.ts';

export const normalise = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');

export function tokenise(s: string): string[] {
  const out: string[] = [];
  for (const tok of s.split(/[^\p{L}\p{N}_-]+/u)) {
    if (!/[\p{L}\p{N}]/u.test(tok)) continue;
    out.push(tok);
    if (/[-_]/.test(tok)) for (const part of tok.split(/[-_]+/)) if (part && part !== tok) out.push(part);
  }
  return out;
}

export function stem(t: string): string {
  if (t.length < 5) return t;
  if (t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  for (const suffix of ['ing', 'ed', 'es', 's']) if (t.endsWith(suffix)) return t.slice(0, -suffix.length);
  return t;
}

export const indexTerms = (text: string): string[] =>
  tokenise(normalise(text)).filter((t) => !STOP_WORDS.has(t)).map(stem);

export interface ParsedQuery { terms: string[]; synonymTerms: string[]; kindHints: Kind[] }

const SYN = SYNONYMS.map((g) => g.map(indexTerms).filter((p) => p.length > 0));

function expand(terms: Set<string>): string[] {
  const out = new Set<string>();
  const has = (phrase: string[]) => phrase.every((t) => terms.has(t));
  for (const [key, ...values] of SYN) {
    if (!key) continue;
    if (has(key)) for (const v of values) for (const t of v) out.add(t);
    if (values.some(has)) for (const t of key) out.add(t);
  }
  return [...out].filter((t) => !terms.has(t));
}

export function parseQuery(q: string): ParsedQuery {
  const terms = new Set<string>();
  const hints = new Set<Kind>();
  for (const tok of tokenise(normalise(q.slice(0, 200)))) {
    if (STOP_WORDS.has(tok)) continue;
    if (Object.hasOwn(KIND_WORDS, tok)) hints.add(KIND_WORDS[tok]);
    else terms.add(stem(tok));
  }
  return {
    terms: [...terms],
    synonymTerms: expand(terms),
    kindHints: KIND_ORDER.filter((k) => hints.has(k)),
  };
}
