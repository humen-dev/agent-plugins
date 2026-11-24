import MiniSearch from 'minisearch';
import type { Artifact, Catalog, Kind, Plugin } from '../catalog/types.ts';
import { BOOSTS, KIND_ORDER, STOP_WORDS, SYNONYM_WEIGHT } from './config.ts';
import { firstHit } from './highlight.ts';
import { normalise, parseQuery, stem, tokenise } from './pipeline.ts';

export interface SearchState { q: string; kinds: Kind[]; cats: string[] }
export interface ResultCard {
  key: string; kind: Kind;
  merged: boolean;
  plugin: Plugin; artifact: Artifact | null;
  score: number; matchedTerms: string[];
  snippet: { text: string; file: string } | null;
}
export interface SearchOutput {
  cards: ResultCard[]; hasTerms: boolean; hintedKinds: Kind[];
  kindCounts: Partial<Record<Kind, number>>; catCounts: Record<string, number>;
}

interface Doc { id: string; name: string; tagsOwn?: string; tagsInherited?: string; description: string; headings: string; body: string }
interface Seg { file: string; text: string }
interface Item { id: string; kind: Kind; plugin: Plugin; artifact: Artifact | null; segs: Seg[]; doc: Doc }
interface Hit { item: Item; score: number; match: Record<string, string[]> }

const SNIPPET_MAX = 160;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0); // UTF-16 code units (NFR-11)
const kindRank = (k: Kind) => KIND_ORDER.indexOf(k);
const rel = (p: Plugin, path: string) => (path.startsWith(`${p.path}/`) ? path.slice(p.path.length + 1) : path);

function readmeHeadings(src: string): string[] {
  const out: string[] = [];
  let fence = false;
  for (const line of src.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    else if (!fence && /^#{1,3}\s/.test(line)) out.push(line.replace(/^#+/, '').replace(/#+$/, '').trim());
  }
  return out;
}

function artifactSegs(p: Plugin, a: Artifact): Seg[] {
  const segs: Seg[] = [];
  if (a.body) segs.push({ file: rel(p, a.path), text: a.body.source });
  for (const f of a.files) segs.push({ file: rel(p, f.path), text: f.body.source });
  if (a.kind === 'hook' && a.command) segs.push({ file: rel(p, a.definedIn), text: a.command });
  if (a.kind === 'mcp') segs.push({ file: rel(p, a.definedIn), text: [a.command, a.url].filter(Boolean).join(' ') });
  return segs;
}

function buildItems(c: Catalog): Item[] {
  const items: Item[] = [];
  const byName = new Map(c.plugins.map((p) => [p.name, p]));
  for (const p of c.plugins) {
    const segs = p.readme ? [{ file: rel(p, p.readme.path), text: p.readme.source }] : [];
    items.push({
      id: `plugin:${p.name}`, kind: 'plugin', plugin: p, artifact: null, segs,
      doc: {
        id: `plugin:${p.name}`, name: p.name, tagsOwn: p.tags.join(' '),
        description: `${p.description} ${p.summary}`,
        headings: p.readme ? readmeHeadings(p.readme.source).join('\n') : '',
        body: segs.map((s) => s.text).join('\n'),
      },
    });
  }
  for (const a of c.artifacts) {
    const p = byName.get(a.plugin);
    if (!p) continue;
    const segs = artifactSegs(p, a);
    items.push({
      id: a.id, kind: a.kind, plugin: p, artifact: a, segs,
      doc: {
        id: a.id, name: a.name, tagsInherited: p.tags.join(' '), description: a.description,
        headings: a.headings.join('\n'), body: segs.map((s) => s.text).join('\n'),
      },
    });
  }
  return items;
}

/** <= SNIPPET_MAX chars around `at`, with "…" on each cut side. */
function around(text: string, at: number): string {
  const start = Math.max(0, at - 50);
  const avail = SNIPPET_MAX - (start > 0 ? 1 : 0);
  const end = text.length - start <= avail ? text.length : start + avail - 1;
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function snippetOf(item: Item, matched: string[]): ResultCard['snippet'] {
  for (const seg of item.segs) {
    const text = seg.text.replace(/\s+/g, ' ').trim();
    const at = firstHit(text, matched);
    if (at >= 0) return { text: around(text, at), file: seg.file };
  }
  return null;
}

const bodyOnly = (h: Hit) => {
  const fields = Object.values(h.match);
  return fields.length > 0 && fields.every((f) => f.length === 1 && f[0] === 'body');
};

export function createSearch(c: Catalog): { run(s: SearchState): SearchOutput; topTags: string[] } {
  const items = buildItems(c);
  const byId = new Map(items.map((i) => [i.id, i]));
  const ms = new MiniSearch<Doc>({
    fields: ['name', 'tagsOwn', 'tagsInherited', 'description', 'headings', 'body'],
    tokenize: (s) => tokenise(normalise(s)),
    processTerm: (t) => (STOP_WORDS.has(t) ? null : stem(t)),
  });
  ms.addAll(items.map((i) => i.doc));

  const freq = new Map<string, number>();
  for (const p of c.plugins) for (const t of p.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
  const topTags = [...freq].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).slice(0, 5).map(([t]) => t);

  const hitOrder = (a: { score: number; item: Item }, b: { score: number; item: Item }) =>
    b.score - a.score || kindRank(a.item.kind) - kindRank(b.item.kind) || cmp(a.item.doc.name, b.item.doc.name) || cmp(a.item.id, b.item.id);

  function run(s: SearchState): SearchOutput {
    const pq = parseQuery(s.q);
    const hasTerms = pq.terms.length > 0;
    let hits: Hit[];
    if (hasTerms) {
      const synonymOnly = new Set(pq.synonymTerms);
      const hinted = new Set(pq.kindHints);
      hits = ms.search([...pq.terms, ...pq.synonymTerms].join(' '), {
        combineWith: 'OR',
        tokenize: (q) => q.split(' '),
        processTerm: (t) => t,
        prefix: (t) => t.length >= 3,
        fuzzy: (t) => (t.length >= 5 ? 1 : false),
        boost: BOOSTS,
        boostTerm: (t) => (synonymOnly.has(t) ? SYNONYM_WEIGHT : 1),
        boostDocument: (id) => (hinted.has(byId.get(id as string)!.kind) ? 2 : 1),
      }).map((r) => ({ item: byId.get(r.id as string)!, score: r.score, match: r.match }));
    } else {
      hits = items.map((item) => ({ item, score: 0, match: {} }));
    }

    const inKinds = (h: Hit) => s.kinds.length === 0 || s.kinds.includes(h.item.kind);
    const inCats = (h: Hit) => s.cats.length === 0 || (h.item.plugin.category !== null && s.cats.includes(h.item.plugin.category));
    const kindCounts: Partial<Record<Kind, number>> = {};
    for (const h of hits) if (inCats(h)) kindCounts[h.item.kind] = (kindCounts[h.item.kind] ?? 0) + 1;
    const catCounts: Record<string, number> = Object.fromEntries(c.categories.map((k) => [k, 0]));
    for (const h of hits) if (inKinds(h) && h.item.plugin.category !== null) catCounts[h.item.plugin.category] = (catCounts[h.item.plugin.category] ?? 0) + 1;

    hits = hits.filter((h) => inKinds(h) && inCats(h));
    if (!hasTerms && s.kinds.length === 0 && s.cats.length === 0) hits = hits.filter((h) => h.item.kind === 'plugin');
    hits.sort(hitOrder);

    // `h` is the card's own hit (the artifact when merged); `p` is the merged plugin hit.
    const toCard = (h: Hit, p?: Hit): ResultCard => {
      const win = p && p.score > h.score ? p : h; // the higher score ranks the card (AC-18a)
      const matched = [...new Set([...Object.keys(win.match), ...Object.keys((win === h ? p : h)?.match ?? {})])];
      return {
        key: h.item.id, kind: h.item.kind, merged: p !== undefined,
        plugin: h.item.plugin, artifact: h.item.artifact,
        score: win.score, matchedTerms: matched,
        snippet: hasTerms && bodyOnly(win) ? snippetOf(win.item, matched) : null,
      };
    };

    // Collapse (AC-18a): a plugin joins the best artifact of its own plugin with the same name.
    const paired = new Map<Hit, Hit>(); // artifact hit -> plugin hit
    const used = new Set<Hit>();
    if (hasTerms) {
      const pluginHits = new Map(hits.filter((h) => h.item.kind === 'plugin').map((h) => [h.item.plugin.name, h]));
      for (const h of hits) {
        const p = h.item.artifact && pluginHits.get(h.item.plugin.name);
        if (p && !used.has(p) && h.item.doc.name === p.item.doc.name) { paired.set(h, p); used.add(p); }
      }
    }
    const cards = hits
      .filter((h) => !used.has(h))
      .map((h) => toCard(h, paired.get(h)))
      .sort((a, b) => {
        const byName = cmp(a.artifact?.name ?? a.plugin.name, b.artifact?.name ?? b.plugin.name);
        const byKind = kindRank(a.kind) - kindRank(b.kind);
        return hasTerms
          ? b.score - a.score || byKind || byName || cmp(a.key, b.key)
          : byName || byKind || cmp(a.key, b.key);
      });

    return { cards, hasTerms, hintedKinds: hasTerms ? [] : pq.kindHints, kindCounts, catCounts };
  }

  return { run, topTags };
}
