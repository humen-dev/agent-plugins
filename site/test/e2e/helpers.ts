import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import type { Catalog } from '../../src/catalog/types.ts';
import { en } from '../../src/i18n/en.ts';
import { createSearch, type SearchState } from '../../src/search/search.ts';

/** The real generated catalog: expectations come from it, never from hard-coded counts. */
export const catalog = JSON.parse(readFileSync(new URL('../../src/generated/catalog.json', import.meta.url), 'utf8')) as Catalog;

const search = createSearch(catalog);
export const expected = (s: Partial<SearchState>) => search.run({ q: '', kinds: [], cats: [], ...s });
export const keysOf = (s: Partial<SearchState>) => expected(s).cards.map((c) => c.key);

export const plugin0 = catalog.plugins[0];
export const artifact0 = catalog.artifacts[0];

export interface RouteCase { name: string; hash: string; h1: string }
export const ROUTES: RouteCase[] = [
  { name: 'home', hash: '#/', h1: en.search.heading },
  { name: 'plugin', hash: `#/plugins/${encodeURIComponent(plugin0.name)}`, h1: plugin0.name },
  {
    name: 'artifact',
    hash: `#/plugins/${encodeURIComponent(artifact0.plugin)}/${artifact0.kind}/${encodeURIComponent(artifact0.name)}`,
    h1: artifact0.name,
  },
  { name: 'install', hash: '#/install', h1: en.pages.installTitle },
  { name: 'new', hash: '#/new', h1: en.pages.newTitle },
  { name: 'unknown', hash: '#/no/such/route', h1: en.states.notFoundTitle },
];

export const VIEWPORTS = [320, 375, 768, 1280, 1920];

export const pluginByName = (name: string) => {
  const p = catalog.plugins.find((x) => x.name === name);
  if (!p) throw new Error(`plugin ${name} missing from catalog.json`);
  return p;
};

/** Plugin names plus their transitive `inCatalog` dependencies, and who pulled each dependency in. */
export function closureOf(names: string[]) {
  const final = new Set(names);
  const addedFor: Record<string, Set<string>> = {};
  for (const n of final) {
    for (const d of pluginByName(n).dependencies) {
      if (!d.inCatalog) continue;
      if (!names.includes(d.name)) (addedFor[d.name] ??= new Set()).add(n);
      final.add(d.name); // growing a Set during iteration visits the new entry too
    }
  }
  return { final: [...final].sort(), addedFor };
}

/** Exact textContent (toHaveText would collapse the newlines of a multi-line command). */
export const textOf = (loc: Locator) => loc.evaluate((e) => e.textContent);

/** Data rows of a `.tbl` (header row excluded). */
export const rowsOf = (page: Page, tbl: string) => page.locator(`${tbl} .tr:not(.head)`);

/** Collects requests whose origin differs from the site's. */
export function trackForeign(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const foreign: string[] = [];
  page.on('request', (req) => { if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== origin) foreign.push(req.url()); });
  return foreign;
}

/** Card keys in DOM order; a card's `aria-labelledby` is `card-<key>`. */
export const cardKeys = (page: Page) =>
  page.getByRole('article').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-labelledby') ?? '').replace(/^card-/, '')));

export const cardNames = (page: Page) =>
  page.getByRole('article').getByRole('heading', { level: 3 }).evaluateAll((els) => els.map((e) => e.textContent ?? ''));
