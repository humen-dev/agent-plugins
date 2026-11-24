import { type Block, type Inline, type ListBlock, LIMITS } from './types.ts';

// Total and linear: every regex below is anchored or runs on a bounded slice, no regex is built from input,
// and HTML is never tokenised (`<…>` stays text, except an http(s) autolink).
type Leaf = Exclude<Inline, { t: 'link' | 'image' }>;

const isWs = (ch: string | undefined) => ch === undefined || ch.charCodeAt(0) <= 32;
const isWord = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

const MAX_TARGET = 2048;
const SPECIAL = new Set([96, 42, 95, 91, 33, 60]); // ` * _ [ ! <
const count = (s: string, from: number, to: number) => {
  let n = 0;
  for (let i = from; i < to; i++) if (s.charCodeAt(i) === 40) n++;
  return n;
};

function inline(s: string, nested: boolean): Inline[] {
  const out: Inline[] = [];
  // next index of `needle` at or after `from`; scans only advance, so a cached answer is reused (keeps unmatched openers O(1))
  const memo = new Map<string, [number, number]>();
  const find = (needle: string, from: number): number => {
    const c = memo.get(needle);
    if (c && c[0] <= from && (c[1] === -1 || c[1] >= from)) return c[1];
    const r = s.indexOf(needle, from);
    memo.set(needle, [from, r]);
    return r;
  };

  const tryAt = (i: number): [number, Inline] | null => {
    const ch = s[i];
    if (ch === '`') {
      const k = find('`', i + 1);
      return k > i + 1 ? [k + 1, { t: 'code', text: s.slice(i + 1, k) }] : null;
    }
    if (ch === '*' && s[i + 1] === '*') {
      const k = find('**', i + 2);
      return k > i + 2 ? [k + 2, { t: 'strong', text: s.slice(i + 2, k) }] : null;
    }
    if (ch === '*' || (ch === '_' && !isWord(s[i - 1]))) {
      const k = find(ch, i + 1);
      if (k > i + 1 && !isWs(s[i + 1]) && !isWs(s[k - 1]) && (ch === '*' || !isWord(s[k + 1]))) {
        return [k + 1, { t: 'em', text: s.slice(i + 1, k) }];
      }
      return null;
    }
    if (nested) return null;
    if (ch === '[' || (ch === '!' && s[i + 1] === '[')) {
      const img = ch === '!';
      const o = img ? i + 1 : i;
      const c = find(']', o + 1);
      if (c < o + (img ? 1 : 2) || s[c + 1] !== '(') return null;
      // the target ends at the matching ")" so "(a(b))" works; shortcut: a target longer than MAX_TARGET stays text, raise it if READMEs need more
      let d = find(')', c + 2);
      if (d < 0 || d - c > MAX_TARGET) return null;
      let open = count(s, c + 2, d);
      while (open > 0) {
        const e = find(')', d + 1);
        if (e < 0 || e - c > MAX_TARGET) return null;
        open += count(s, d + 1, e) - 1;
        d = e;
      }
      const raw = s.slice(c + 2, d).trim();
      const ws = raw.search(/\s/);
      const target = ws < 0 ? raw : raw.slice(0, ws);
      const text = s.slice(o + 1, c);
      if (img) return [d + 1, { t: 'image', src: target, alt: text }];
      return [d + 1, { t: 'link', href: target, children: inline(text, true) as Leaf[] }];
    }
    if (ch === '<' && (s[i + 1] === 'h' || s[i + 1] === 'H') && /^https?:\/\//i.test(s.slice(i + 1, i + 9))) {
      let j = i + 1;
      while (j < s.length && s[j] !== '>' && s[j] !== '<' && !isWs(s[j])) j++;
      if (s[j] !== '>') return null;
      const url = s.slice(i + 1, j);
      return [j + 1, { t: 'link', href: url, children: [{ t: 'text', text: url }] }];
    }
    return null;
  };

  let i = 0;
  let start = 0;
  while (i < s.length) {
    const r = SPECIAL.has(s.charCodeAt(i)) ? tryAt(i) : null;
    if (r) {
      if (i > start) out.push({ t: 'text', text: s.slice(start, i) });
      out.push(r[1]);
      i = start = r[0];
    } else i++;
  }
  if (s.length > start) out.push({ t: 'text', text: s.slice(start) });
  return out;
}

const BLANK = /^\s*$/;
const FENCE = /^\s*```\s*([\w-]*)/;
const FENCE_END = /^\s*```/;
// the "s" flag lets `.` match U+2028/2029, so `\s+(.*)$` can never backtrack through a long whitespace run
const HEADING = /^(#{1,6})\s+(.*)$/s;
const HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const ROW = /^\s*\|/;
const QUOTE = /^\s*>/;
const ITEM = /^(\s*)([-*+]|\d+\.)\s+(.*)$/s;
const CONT = /^\s{2,}\S/;
const SEPARATOR = /^\s*\|?\s*:?-{2,}/;
const PARA_STOP = /^(#{1,6}\s|\s*```|\s*\||\s*([-*+]|\d+\.)\s)/;

const indentOf = (ws: string) => {
  let n = 0;
  for (const ch of ws) n += ch === '\t' ? 4 : 1;
  return n;
};
const cells = (row: string) => {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  return r.split('|').map((c) => c.trim());
};

interface RawList { ordered: boolean; items: { text: string[]; sub: RawList | null }[] }
const toList = (r: RawList): ListBlock => ({
  t: 'list',
  ordered: r.ordered,
  items: r.items.map((it) => ({ children: inline(it.text.join(' '), false), sub: it.sub && toList(it.sub) })),
});

function blocks(L: string[], qd: number): Block[] {
  const B: Block[] = [];
  let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (BLANK.test(l)) { i++; continue; }

    const f = FENCE.exec(l);
    if (f) {
      const buf: string[] = [];
      i++;
      while (i < L.length && !FENCE_END.test(L[i])) buf.push(L[i++]);
      i++; // a fence with no closing line runs to the end
      B.push({ t: 'code', lang: f[1], text: buf.join('\n') });
      continue;
    }
    const h = HEADING.exec(l);
    if (h) {
      B.push({ t: 'heading', level: Math.min(3, h[1].length) as 1 | 2 | 3, children: inline(h[2], false) });
      i++;
      continue;
    }
    if (HR.test(l)) { B.push({ t: 'hr' }); i++; continue; }
    if (qd < LIMITS.quoteDepth && QUOTE.test(l)) {
      const inner: string[] = [];
      while (i < L.length && QUOTE.test(L[i])) {
        const rest = L[i].slice(L[i].indexOf('>') + 1);
        inner.push(rest.startsWith(' ') ? rest.slice(1) : rest);
        i++;
      }
      B.push({ t: 'quote', children: blocks(inner, qd + 1) });
      continue;
    }
    if (ROW.test(l)) {
      const rows: string[] = [];
      while (i < L.length && ROW.test(L[i])) rows.push(L[i++]);
      B.push({
        t: 'table',
        head: cells(rows[0]).map((c) => inline(c, false)),
        rows: rows.slice(1).filter((r) => !SEPARATOR.test(r)).map((r) => cells(r).map((c) => inline(c, false))),
      });
      continue;
    }
    const first = ITEM.exec(l);
    if (first) {
      const base = indentOf(first[1]);
      const top: RawList = { ordered: /\d/.test(first[2]), items: [] };
      let deepest: { text: string[] } | null = null; // the item a continuation line extends
      while (i < L.length) {
        const m = ITEM.exec(L[i]);
        if (m) {
          const item = { text: [m[3]], sub: null };
          const last = top.items[top.items.length - 1];
          if (last && indentOf(m[1]) >= base + 2) {
            // one nested level; anything deeper joins it
            last.sub ??= { ordered: /\d/.test(m[2]), items: [] };
            last.sub.items.push(item);
          } else top.items.push(item);
          deepest = item;
        } else if (deepest && CONT.test(L[i])) deepest.text.push(L[i].trim());
        else break;
        i++;
      }
      B.push(toList(top));
      continue;
    }
    const pb = [l.trim()];
    i++;
    while (i < L.length && !BLANK.test(L[i]) && !PARA_STOP.test(L[i]) && !(qd < LIMITS.quoteDepth && QUOTE.test(L[i]))) pb.push(L[i++].trim());
    B.push({ t: 'para', children: inline(pb.join(' '), false) });
  }
  return B;
}

export function parseMarkdown(source: string): Block[] {
  return blocks(source.split(/\r\n?|\n/), 0);
}
