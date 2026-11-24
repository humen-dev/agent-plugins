import type { Catalog } from '../catalog/types.ts';
import type { MissingDep, ResolvedSet, Scope } from './types.ts';

const byName = (c: Catalog, n: string) => c.plugins.find((p) => p.name === n);

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, sortKeys(x)]));
  }
  return v;
}

export function resolveSet(c: Catalog, names: readonly string[]): ResolvedSet {
  const dropped: string[] = [];
  const picked = new Set<string>();
  for (const n of names) {
    if (byName(c, n)) picked.add(n);
    else if (!dropped.includes(n)) dropped.push(n);
  }
  const selected = [...picked].sort();
  const final = new Set(selected);
  const addedFor: Record<string, Set<string>> = {};
  const missing: MissingDep[] = [];
  const queue = [...selected];
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    for (const d of byName(c, from)?.dependencies ?? []) {
      if (d.inCatalog && byName(c, d.name)) {
        if (!picked.has(d.name)) (addedFor[d.name] ??= new Set()).add(from);
        if (!final.has(d.name)) {
          final.add(d.name);
          queue.push(d.name);
        }
      } else if (!missing.some((m) => m.dep === d.name && m.forName === from)) {
        missing.push({ dep: d.name, version: d.version, forName: from });
      }
    }
  }
  return {
    selected,
    final: [...final].sort(),
    addedFor: Object.fromEntries(Object.entries(addedFor).map(([k, v]) => [k, [...v].sort()])),
    missing,
    dropped,
  };
}

export function cliText(c: Catalog, final: readonly string[], scope: Scope): string {
  return [c.marketplace.addCommand, ...final.map((n) => byName(c, n)?.installCommand ?? '')]
    .map((l) => (scope === 'project' ? `${l} --scope project` : l))
    .join('\n');
}

export function settingsJson(c: Catalog, final: readonly string[]): string {
  const m = c.marketplace;
  return JSON.stringify(
    sortKeys({
      enabledPlugins: Object.fromEntries(final.map((n) => [`${n}@${m.name}`, true])),
      extraKnownMarketplaces: { [m.name]: { source: { source: 'github', repo: m.repo } } },
    }),
    null,
    2,
  );
}
