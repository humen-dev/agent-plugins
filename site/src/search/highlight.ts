import { indexTerms } from './pipeline.ts';

const WORD = /[\p{L}\p{N}\p{M}_-]+/gu;

/** At most `max` UTF-16 units including the trailing "…". */
export function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = max - 1;
  if (end > 0 && (text.charCodeAt(end - 1) & 0xfc00) === 0xd800) end--; // do not split a surrogate pair
  return `${text.slice(0, Math.max(end, 0)).trimEnd()}…`;
}

const isHit = (word: string, set: ReadonlySet<string>) => indexTerms(word).some((t) => set.has(t));

/** Offset of the first word with a matched index term, or -1. */
export function firstHit(text: string, matchedTerms: readonly string[]): number {
  const set = new Set(matchedTerms);
  for (const m of text.matchAll(WORD)) if (isHit(m[0], set)) return m.index;
  return -1;
}

export function segments(text: string, matchedTerms: readonly string[]): { text: string; mark: boolean }[] {
  const set = new Set(matchedTerms);
  const out: { text: string; mark: boolean }[] = [];
  const push = (t: string, mark: boolean) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev && prev.mark === mark) prev.text += t;
    else out.push({ text: t, mark });
  };
  let last = 0;
  for (const m of text.matchAll(WORD)) {
    push(text.slice(last, m.index), false);
    push(m[0], isHit(m[0], set));
    last = m.index + m[0].length;
  }
  push(text.slice(last), false);
  return out;
}
