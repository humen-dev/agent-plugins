# Catalog site M2 (app shell, search page, theme, states) — development plan

| Field | Value |
|---|---|
| Status | approved |
| Goal | A user opens the built site, gets the dark or stored theme on first paint, and searches the real catalog from the search page. Results come from MiniSearch with the spec pipeline, kind and category facets, hash state, and loading, error, empty and not-found states. Everything runs under the NFR-12 CSP, and every string comes from `en.ts`. |
| Requirements source | `docs/specs/catalog-site.md` (SPEC-01, Status: approved `:4`), milestone M2 only (`:920`); design `site/prototype/` (README `:20`: the spec wins); owner brief and answers (C-1..C-13, answers 1–6, review answers Q1–Q4, R1–R4). Input only: this plan never edits them. |
| Execution mode | single-agent (sequential pass), chosen by the owner (Q1 b) |
| Modules touched | root |

## 1. Context

Today `site/` holds the M1 generator (`site/scripts/generate.mjs:30` exports `generate({ root, repo })`), the shared types (`site/src/catalog/types.ts:3-135`), the M1 tests (`site/test/*.test.mjs`) and the prototype. There is no app code yet. `site/package.json:8-28` has only the generator deps and dev tooling. `tsconfig.json:10-15` has no DOM lib, no JSX, and covers `src/**/*.ts` + `scripts/**/*.mjs`. `vitest.config.ts:5` runs only `test/**/*.test.mjs`. `eslint.config.js:6-9` uses node globals and covers `.ts` only. `site/.gitignore:3` ignores `src/generated/`. The "Site" workflow has tests (lint, typecheck, Vitest, audit) and build (generate) (`.github/workflows/site.yml:25-86`). `site/test/workflow.test.mjs:11-54` pins those steps.

Requirements: SPEC-01 M2 rows (`:920`). Search `:309-403`, Global UI `:445-468`, Pages `:432-443`, ACs `:503-534`, `:584-593`, `:615-626`, edge cases `:632-635`, `:644`, UT-3/UT-4 `:766-767`, NFR-11..14 `:735-738`, Testing `:812-852`, CI/CD `:874-900`.

Design sources, all read: `Main.dc.html` markup `:61-190` (shell and search), `:519-539` (not-found, footer), view-model logic `:587-1035`. `Mobile.dc.html:16-17` is Main at 375 px with no own markup. `Components.dc.html:33-93` shows button, chip, badge, runs, command box and search states, and `:140-144` the state panels. `Foundations.dc.html:96-153` has the icons, the token table with contrast ratios, and spacing. `catalog.css:5-40` has the tokens, `:42-206` and `:314-325` the M2 component rules, `:341-384` the mobile and reduced-motion rules.

Binding sources: there is no `AGENTS.md`, `CLAUDE.md` or `INSIGHTS.md` at the root or in `site/` (Glob). No project skills (`.claude/skills/*/SKILL.md` matches nothing). The app layout follows the Vite convention plus the paths the spec names: `site/public/theme-init.js` `:452`, `site/src/i18n/en.ts` `:461`, everything under `site/` `:131-133`. All paths below are relative to the repository root.

### Requirements review
The approved-spec review round (findings 1–13) is closed by the owner's answers.
- Q1: single-agent. Q2 b: the card "Runs code" labels follow `runs.reasons` order. `shell` expands to one "<kind> with shell access" label per distinct kind in `shellArtifacts`, which replaces earlier answer 3. Q3 a: the header "Install set" is a plain link, with no count. Q4 b: `@axe-core/playwright` now, scoped to the theme toggle for AC-61.
- **Accepted** R1 (CSP meta injected only at build), R2 (catalog alias + ambient type; it stays a dynamic `import()` of a content-hashed chunk, C-10), R3 (`npm run e2e` outside `check`; the orchestrator runs it in §7 and CI runs it in "Site: tests"), R4 (UT-3 enforced with ESLint core rules).
- Approved readings: EC-1 (Decision 6), AC-21b/AC-18a (Decision 5).
- Finding 9 (the `plugin-request.yml` form arrives in M4) is in §8.

### Decisions
1. **Spec wins C-1..C-13.** Theme key `catalog.theme`. MiniSearch with the spec pipeline (§3.3). Kind words give ×2 and become chips only per EC-1. "Clear filters" keeps the query. Collapse per AC-18a/b. Ties per AC-17. Snippet per AC-20. Retry = `location.reload()`. Catalog by dynamic `import()`. Footer uses UTC `YYYY-MM-DD` and `marketplace.name`. Hash input sanitised (UT-4, EC-2a). Kind chips from `catalog.kinds`. Request link per §3.6. Rejected: porting the prototype logic (`Main.dc.html:587-650`).
2. **Port approach.** The prototype markup becomes React components with the same class names. Every inline `style=` becomes a class. Tokens move to `:root[data-theme]`. The container query becomes `@media (max-width: 767px)`. The prototype control bar and no-JS demo are dropped (approved). Only M2 rules are ported. M3/M4 rules (facts, tables, collapsible, change rows, install set, Markdown, `.chg .old::after` with visible text) wait for their milestone. Rejected: copying all of `catalog.css`, which also carries text outside `en.ts`.
3. **Placeholder routes** (answer 1): `#/plugins/<p>` shows the plugin name as h1, `#/plugins/<p>/<kind>/<name>` the artifact name, `#/install` and `#/new` their page titles. An unknown plugin or artifact shows not-found (AC-48).
4. **Request-URL builder in M2** (answer 2, §3.6). Its unit test lands here. AC-45/UT-5 stay M4 rows.
5. **Items vs cards** (approved). Filters and chip counts work on items (one per plugin and artifact). An artifact's category is its plugin's. Collapse runs after filtering and only with a non-empty term list, so an empty query never merges (answer 5, AC-26a/b). The live region counts the cards shown.
6. **EC-1** (approved): when a committed query (debounced, Esc, or initial load) has no terms left but has kind hints, the hinted kinds are added to the kind filter once and written to the hash. `q` keeps the query text. Toggling a chip never re-applies hints.
7. **Card details** (answer 4, Q2 b): "User-invoked only" label, `invokeAs` plus `argumentHint`. Runs labels: `hooks` → "hooks", `mcp` → "MCP servers", `scripts` → "scripts", `shell` → one "<kind> with shell access" per distinct kind of `shellArtifacts` ids, in Kind order. A merged card links to the plugin page, shows the plugin description, and omits the plugin link.
8. **Empty-state tags** (answer 6): up to 5 plugin tags, by frequency over `plugins[].tags` descending. Equal frequency sorts by name in code-unit order. Each links to `#/?q=<tag>`.
9. **Hash writes** use `history.replaceState` for query and filter changes, so typing adds no history entries. Route links are plain `href="#/…"`, so back/forward work through `hashchange` (AC-47).
10. **Copy button** on cards: the design behaviour (Clipboard API, "Copied" 2 s, select + hint on failure). It is built now because AC-19a needs the button, and its AC-36/37 tests are M4 rows. Rejected: a stub M4 would replace.
11. **Golden tuning** (`:322-325`, owner decision): if an AC-14 query fails, first tune the synonym table in `src/search/config.ts`. A boost value may also change, as long as the AC-15 order and equalities still hold: name > own tags > description > headings > inherited tags = body. The implementer stops and reports only when passing the golden queries would need a different order or a broken equality. Every changed boost or synonym is listed in the wave report and added to spec follow-up SF-3. The golden list never changes.
12. **Skeletons on every route** while the catalog loads (AC-49 has no route scope). The footer and the header's external links render once the catalog is there, because they need `repoUrl`.
13. **Deterministic text**: every sort compares by UTF-16 code unit, never `localeCompare` (as in M1 Decision 11), so NFR-11 holds.
14. **Skills**: `caveman:lean-build` for U1–U3, where the prototype also covers M3/M4 and overbuilding is the main risk. `none` for U4 and U5. `spec-driven:untrusted-input-threats` is for spec writing (M1 Decision 15).

### Open questions
none

## 2. Affected modules
| Module | Touched? | Why / what changes | Rule that applies |
|---|---|---|---|
| root | yes | `site/` app (index.html, public/, src/ app code, styles, tests, e2e), `site/package.json` + lockfile, configs, `.github/workflows/site.yml`, `site/test/workflow.test.mjs` | spec `:121-126`, `:131-133`, `:445-468`; M1 layout `docs/plans/catalog-site-m1.md:17`; no agent docs |

The app imports the generator's output only through the alias in §3.1. Tests import `generate()` in process (`site/test/real-repo.test.mjs:18-20`). M1 contracts (`types.ts`, generator CLI and lib) stay unchanged.

## 3. Contracts

### 3.1 Catalog chunk (U0)
```ts
// site/src/catalog/catalog-module.d.ts — ambient; tsc never resolves the JSON file
declare module '@generated/catalog' {
  const catalog: import('./types.ts').Catalog;
  export default catalog;
}
// site/src/catalog/load.ts (U2)
export const loadCatalog = (): Promise<Catalog> => import('@generated/catalog').then((m) => m.default);
```
`vite.config.ts`: `base: '/agent-plugins/'`, `resolve.alias['@generated/catalog']` → absolute path of `src/generated/catalog.json`. `build.rollupOptions.output.chunkFileNames: 'assets/[name]-[hash].js'` gives `assets/catalog-<hash>.js`. `vitest.config.ts` uses `mergeConfig` with the Vite config, so the alias is the same in both. No `tsconfig` `paths` entry for it.

### 3.2 CSP and index.html (U2)
```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'
```
`vite.config.ts` exports `CSP` and `htmlPlugin()`, with `apply: 'build'` and `transformIndexHtml` `order: 'post'`. It inserts `<meta http-equiv="Content-Security-Policy" content="<CSP>">` right after `<meta charset>`. It also makes sure `<script src="/agent-plugins/theme-init.js">` (no `async`/`defer`, written `%BASE_URL%theme-init.js` in source) comes before the first stylesheet link. `index.html` keeps `<title>humen-dev plugin catalog</title>`. `<noscript>` says "This catalog needs JavaScript to search and show plugins." with links to `https://github.com/humen-dev/agent-plugins` and its `#readme` (the two allowed literals, `:461-463`).

### 3.3 Search module (U1) — `site/src/search/`
```ts
// config.ts
export const BOOSTS = { name: 5, tagsOwn: 3, tagsInherited: 1, description: 2, headings: 1.5, body: 1 };
export const STOP_WORDS: ReadonlySet<string>;            // spec :334-337 verbatim
export const KIND_WORDS: Readonly<Record<string, Kind>>;  // spec :342-349
export const SYNONYMS: readonly (readonly string[])[];    // spec :354-361; each group symmetric
export const SYNONYM_WEIGHT = 0.5;
// pipeline.ts — steps 1–3 and 5 apply to indexed text, query and synonym keys/values
export function normalise(s: string): string;            // lower-case, NFKD, strip \p{M}
export function tokenise(s: string): string[];           // split on [^\p{L}\p{N}_-]; a token with - or _ also yields its parts
export function stem(t: string): string;                 // length ≥ 5: first of ies→y, ing, ed, es, s
export function indexTerms(text: string): string[];      // 1,2,3,5
export interface ParsedQuery { terms: string[]; synonymTerms: string[]; kindHints: Kind[] }
export function parseQuery(q: string): ParsedQuery;      // q.slice(0, 200) first (EC-2a); kind words → hints (step 4)
// search.ts
export interface SearchState { q: string; kinds: Kind[]; cats: string[] }
export interface ResultCard {
  key: string; kind: Kind;                     // badge kind; merged card = artifact kind
  merged: boolean;                             // label "<kind> · plugin"
  plugin: Plugin; artifact: Artifact | null;   // merged: both set
  score: number; matchedTerms: string[];       // MiniSearch result.terms (indexed terms)
  snippet: { text: string; file: string } | null; // AC-20; file = path relative to plugin folder
}
export interface SearchOutput {
  cards: ResultCard[]; hasTerms: boolean; hintedKinds: Kind[];
  kindCounts: Partial<Record<Kind, number>>; catCounts: Record<string, number>; // AC-21b, over items
}
export function createSearch(c: Catalog): { run(s: SearchState): SearchOutput; topTags: string[] };
// highlight.ts
export function cut(text: string, max: number): string;  // ≤ max chars incl. trailing "…"
export function segments(text: string, matchedTerms: string[]): { text: string; mark: boolean }[]; // word-level; a word is marked when one of its indexTerms is in matchedTerms; no RegExp built from input
```
MiniSearch (`minisearch@^7.1`, `boostTerm` since 7.1.0 [changelog](https://app.unpkg.com/minisearch@7.1.2/files/CHANGELOG.md)): fields per the index table (`:313-320`), `storeFields` none (the doc id maps to the item). Index options: `tokenize` = `tokenise` after `normalise`, `processTerm` = stop words dropped, then `stem`. Search: the query string is the joined `terms + synonymTerms` with identity `tokenize`/`processTerm`, `combineWith: 'OR'`, `prefix: t => t.length >= 3`, `fuzzy: t => t.length >= 5 ? 1 : false`, `boost: BOOSTS`, `boostTerm: t => synonymOnly.has(t) ? 0.5 : 1`, `boostDocument: id => hinted.has(kindOf(id)) ? 2 : 1`. Order: score descending, then Kind order, name, id (code unit). "Best match only in body": every entry of `result.match` is `['body']`.

### 3.4 Router and hash (U2) — `site/src/router.ts`
```ts
export type Route =
  | { name: 'home'; q: string; kinds: string[]; cats: string[] }   // raw lists; q ≤ 200 chars
  | { name: 'plugin'; plugin: string } | { name: 'artifact'; plugin: string; kind: string; artifact: string }
  | { name: 'install' } | { name: 'new' } | { name: 'notfound' };
export function parseHash(hash: string): Route;          // segments decodeURIComponent (bad escape → notfound)
export function sanitize(r: Extract<Route, {name:'home'}>, c: Catalog): SearchState; // UT-4: kinds ∩ catalog.kinds (Kind order), cats ∩ catalog.categories (catalog order), dedup
export function searchHash(s: SearchState): string;      // '#/' + '?q=<encodeURIComponent>&kind=a,b&cat=x', empty params omitted
```

### 3.5 i18n (U2 creates, every UI unit extends) — `site/src/i18n/en.ts`
```ts
export const en = { /* nested groups: app, header, footer, search, card, filters, empty, states, theme, pages */ } as const;
export type Key = /* dotted paths of en */;
export function t(key: Key, vars?: Record<string, string | number>): string; // "{name}" interpolation; plural entries { one, other } chosen by vars.n via Intl.PluralRules('en')
```
Every call is `t('<literal key>', …)`, so the AC-63 test can check keys statically. `runs.`-prefixed keys stay reserved for M3 (AC-32b). Card runs labels use `card.runs.*`.

### 3.6 Request URL (U2) — `site/src/links/request-url.ts`
```ts
export function requestUrl(repoUrl: string, query: string): string;
// `${repoUrl}/issues/new?template=plugin-request.yml&title=${e}&what=${e}`, e = encodeURIComponent(query.trim().slice(0, 200))
```
The current query is the committed query on the search route, else `''`.

### 3.7 site.yml additions (U5)
"Site: tests", between "Vitest" and "Audit (warning only)": `Generate catalog` (`node site/scripts/generate.mjs --out site/src/generated/catalog.json`), `Build site` (`npm run build`, wd `site`), `Install Chromium` (`npx playwright install --with-deps chromium`, wd `site`), `E2E` (`npm run e2e`, wd `site`). "Site: build", after "Generate catalog": `Build site` (`npm run build`), `Fixture check` (`node site/scripts/check-fixtures.mjs site/src/generated/catalog.json`). No deploy, budgets, Lighthouse or concurrency (M5).

### 3.8 package.json scripts (U0)
`dev: vite`, `build: vite build`, `preview: vite preview --port 4173 --strictPort`, `e2e: playwright test`, and the existing `lint`, `typecheck`, `test`, `check`, `generate` unchanged. Playwright `webServer` runs `npm run preview` against an existing `dist/` and uses `baseURL: http://localhost:4173/agent-plugins/`.

## 4. Work units

### U0 — Dependencies, configs, catalog alias (Wave 0)
| Field | Value |
|---|---|
| Kind | orchestrator |
| Skills | — |
| Module | root |
| Wave | 0 |
| Depends on | — |
| Owns (create/modify) | `site/package.json`, `site/package-lock.json`, `site/tsconfig.json`, `site/vitest.config.ts`, `site/eslint.config.js`, `site/.gitignore`, `site/vite.config.ts` (create), `site/playwright.config.ts` (create), `site/src/catalog/catalog-module.d.ts` (create) |
| Must not touch | `site/src/catalog/types.ts`, `site/scripts/**`, `site/prototype/**`, `docs/specs/**` |
| Consumes | — |
| Produces | §3.1, §3.8; installed deps; Chromium for local e2e |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `npm --prefix site install`. Dependencies: `react`, `react-dom`, `minisearch@^7.1`. devDependencies: `vite` (a major that satisfies `vitest@^5` peers), `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@playwright/test`, `@axe-core/playwright`. Commit the lockfile (NFR-16a).
2. `npx --prefix site playwright install chromium`.
3. `tsconfig.json`: `lib: ["ES2023","DOM","DOM.Iterable"]`, `jsx: "react-jsx"`, `types: ["node"]`, include `src/**/*.ts`, `src/**/*.tsx`, `scripts/**/*.mjs`. Tests stay lint-only (M1 Decision 14).
4. `vitest.config.ts`: `mergeConfig(viteConfig, { test: { include: ['test/**/*.test.{mjs,ts,tsx}'], exclude: ['test/fixtures/**','test/e2e/**','node_modules/**'] } })`. Component tests opt in with `// @vitest-environment jsdom`.
5. `eslint.config.js`: tseslint recommended for `**/*.{ts,tsx}`, browser globals for `src/**` and `public/**`, ignores add `playwright-report/`, `test-results/`. `.gitignore` adds the same two.
6. `vite.config.ts` and `playwright.config.ts` per §3.1/§3.8 (Chromium project only, `testDir: 'test/e2e'`, `reuseExistingServer: !process.env.CI`). `catalog-module.d.ts` per §3.1.
7. Scripts per §3.8.

**Acceptance criteria**
- [ ] `npm --prefix site run check` passes with no app code; lockfile committed; `npm ls minisearch` ≥ 7.1 — NFR-16a (M1 row, kept)

### U1 — Search module and search tests (Wave 1)
| Field | Value |
|---|---|
| Kind | library |
| Skills | caveman:lean-build |
| Module | root |
| Wave | 1 |
| Depends on | U0 |
| Owns (create/modify) | `site/src/search/config.ts`, `pipeline.ts`, `search.ts`, `highlight.ts`; `site/test/search/fixture-catalog.ts`, `pipeline.test.ts`, `search.test.ts`, `highlight.test.ts`, `golden.test.ts` |
| Must not touch | `site/src/catalog/types.ts`, `site/scripts/**`, any UI file |
| Consumes | §3.1 types |
| Produces | §3.3 |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `config.ts` and `pipeline.ts` per §3.3 and spec `:327-363`. Synonym keys and values go through steps 1–3 and 5 at module load.
2. `search.ts`. Build one item per plugin and per artifact with the index fields of `:313-320`: plugin description = description + summary, plugin body = README source, artifact body = body + every `files[].body` + hook `command` + MCP `command`/`url`. Keep the body segments with their file paths for the snippet.
3. `run()`, in this order:
   - parse the query;
   - search, or list every item when there are no terms;
   - filter (AC-21a: kind ∩ cat groups);
   - counts per chip with the other group's filter only (AC-21b);
   - collapse when terms exist (Decision 5, AC-18a: one card at the higher score);
   - sort: score and tie rule (§3.3), or by name, then Kind order, then id when there are no terms;
   - with no terms and no filters, plugin items only (AC-26a);
   - snippet (≤ 160 chars around the first hit of a matched term, `…` on cut sides, Decision 7 file label).
   `hintedKinds` = query hints when `terms` is empty (EC-1). `topTags` per Decision 8.
4. `highlight.ts` per §3.3. `cut` keeps ≤ 160 chars, `…` included.
5. Fixture catalog: small hand-written `Catalog` objects with `fixture-` names. For AC-15, one item per index field, each field one token long.
6. `golden.test.ts`: `generate({ root: <repo root>, repo: 'humen-dev/agent-plugins' })` in process (30 s timeout, as `site/test/real-repo.test.mjs:18-20`). Tune only per Decision 11 (synonyms first, then boosts within the AC-15 order) and list every changed boost or synonym in the report.

**Acceptance criteria**
- [ ] each golden query has its expected item in the top 3 on the real catalog — SPEC-01 AC-14
- [ ] one-field-per-item fixture ranks name > own tags > description > headings > inherited tags = body (equal-score pairs ordered by the tie rule) — SPEC-01 AC-15
- [ ] "the" alone gives no card; "need celery" equals "celery" in order and scores — SPEC-01 AC-16a
- [ ] "migration skill" ranks the skill above the plugin; the score is ×2 against the same query without "skill" — SPEC-01 AC-16b
- [ ] "migrations" matches "migration"; `zero-downtime` indexes `zero-downtime`, `zero`, `downtime`; NFKD "Café" matches "cafe" — SPEC-01 AC-16c
- [ ] "audit" matches an item with only "review", at 0.5 of a direct "review" hit; "planning" matches "plan" — SPEC-01 AC-16d
- [ ] "migr" matches "migration"; "mi" does not prefix-match — SPEC-01 AC-16e
- [ ] "celary" matches "celery"; a 4-char typo does not fuzzy-match — SPEC-01 AC-16f
- [ ] tie fixture orders by Kind order, then name, then id — SPEC-01 AC-17
- [ ] plugin and same-name artifact both matching give one merged card at the higher score; with `kinds: ['plugin']` no merge — SPEC-01 AC-18a, AC-18b
- [ ] a term found only in a skill's `files[]` body yields a snippet ≤ 160 chars labelled with that file's plugin-relative path; a name hit yields none — SPEC-01 AC-20
- [ ] kind=skill + cat=backend gives only backend skills; with kind=skill the agent count still counts agents — SPEC-01 AC-21a, AC-21b
- [ ] empty query + no filter: every plugin, by name, no merge; empty query + kind=skill: every skill by name — SPEC-01 AC-26a, AC-26b
- [ ] "I need a" gives no terms and no hints; "I need a skill" gives `hintedKinds: ['skill']` — SPEC-01 EC-1
- [ ] a 250-char query searches with its first 200 chars (equal output to the 200-char prefix) — SPEC-01 EC-2a
- [ ] `<script>`, `.*`, `((` run without throwing; `segments` returns them as plain text — SPEC-01 EC-2b
- [ ] two `createSearch` runs over the same catalog and query give deep-equal ordered output — SPEC-01 NFR-11
- [ ] ranking order used by AC-13 comes from `run()` (the UI adds only the debounce) — SPEC-01 AC-13

### U2 — App shell, theme, router, states, i18n (Wave 2)
| Field | Value |
|---|---|
| Kind | ui |
| Skills | caveman:lean-build |
| Module | root |
| Wave | 2 |
| Depends on | U0, U1 |
| Owns (create/modify) | `site/index.html`, `site/public/theme-init.js`, `site/vite.config.ts` (add `CSP`, `htmlPlugin`), `site/src/main.tsx`, `App.tsx`, `router.ts`, `catalog/load.ts`, `format.ts` (`utcDay`, `shortSha`), `i18n/en.ts`, `links/request-url.ts`, `ui/icons.ts`, `ui/Icon.tsx`, `ui/Header.tsx`, `ui/ThemeToggle.tsx`, `ui/Footer.tsx`, `ui/states.tsx` (Skeletons, CatalogError, NotFound), `pages/Placeholders.tsx`, `styles/tokens.css`, `styles/app.css` (shell rules); tests `site/test/app/router.test.ts`, `request-url.test.ts`, `theme-init.test.ts`, `html-plugin.test.ts`, `shell.test.tsx` |
| Must not touch | `site/src/search/**`, `site/src/catalog/types.ts`, `site/prototype/**` |
| Consumes | §3.1, §3.3 (search page mounts in U3) |
| Produces | §3.2, §3.4, §3.5, §3.6; a `#/` route slot that U3 fills |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `theme-init.js` (plain ES5-safe IIFE): read `localStorage['catalog.theme']` in try/catch, then set `document.documentElement.dataset.theme` to `'light'` only for `"light"`, else `'dark'`. `index.html` and `htmlPlugin` per §3.2.
2. `styles/tokens.css`: `catalog.css:5-40` values on `:root, :root[data-theme="dark"]` and `:root[data-theme="light"]`. `app.css`: `catalog.css:42-67`, `:77-114`, `:314-325`, the M2 mobile subset of `:341-361`, and `:382-384` with `.app` scope. The container query becomes `@media (max-width: 767px)`. Inline styles from `Main.dc.html:90,93,96,520,523,534` become classes (`.main`, `.state-wrap`, `.state-panel h1`, `.ftr strong`).
3. `App.tsx`: on mount, `loadCatalog()`. While pending, show 6 skeleton cards (`Main.dc.html:143-147`). On reject, show `CatalogError` (`:92-101`); Retry calls `location.reload()`. Route from `parseHash(location.hash)` on `hashchange`. Focus `main` on route change (prototype `:692-696`). Skip link and a polite live region (`:62-63`).
4. Routes: home → U3 slot (U2 renders the hero heading until U3). Placeholders per Decision 3. Unknown → `NotFound` (`:519-528`) with a link to `#/`.
5. `Header.tsx` (`:65-88`): brand, nav (Search, Install set link with no count per Q3 a, What's new, Request, GitHub), desktop theme toggle, mobile menu with its own toggle. External links get `target="_blank" rel="noopener noreferrer"`. `ThemeToggle`: label `t('theme.light')`, `aria-pressed` true while light, flips `dataset.theme`, stores in try/catch.
6. `Footer.tsx` (`:532-539`): `marketplace.name`, version as text, "built from <sha7> on <utcDay(commitDate)>" linking `${repoUrl}/commit/${commit}`, repository link, request link.
7. `icons.ts`: the 30 paths of `Foundations.dc.html:96-108`. `Icon` renders `<svg class="ico" aria-hidden="true">`.
8. `router.ts` and `request-url.ts` per §3.4/§3.6. Every visible string goes through `t()`.

**Acceptance criteria**
- [ ] `parseHash` maps the six route shapes of `:136-143`; a bad escape or unknown path gives `notfound` — SPEC-01 AC-47, AC-48
- [ ] `sanitize` drops unknown `kind`/`cat` values and keeps known ones in catalog order — SPEC-01 UT-4
- [ ] `parseHash` caps `q` at 200 chars — SPEC-01 EC-2a
- [ ] `requestUrl(repo, 'x&labels=bug')` keeps one `title` and one `what` value; empty query gives empty params; the 201st char is dropped — SPEC-01 AC-24 (builder per AC-45/UT-5, rows owned by M4)
- [ ] theme-init: no storage, `"bogus"`, throwing storage → `dark`; `"light"` → `light` — SPEC-01 AC-59, AC-60c
- [ ] `htmlPlugin` output has the exact §3.2 CSP meta after `<meta charset>`, and the theme-init script before the first stylesheet link — SPEC-01 NFR-12, AC-60c
- [ ] component: toggle flips `data-theme`, writes `catalog.theme`, has an accessible name and `aria-pressed="true"` only in light — SPEC-01 AC-60a, AC-60b, AC-61
- [ ] component: footer shows name, version text and `built from <7 chars> on <UTC day>` linking the commit, same text with `process.env.TZ` unchanged and a UTC+9 commitDate near midnight — SPEC-01 AC-51
- [ ] component: rejected loader shows the error with Retry; Retry calls `location.reload` (stubbed); pending loader shows skeleton cards — SPEC-01 AC-50a, AC-50b, AC-49
- [ ] no request leaves the origin: the shell renders no `<img>`, font or script with a foreign URL — SPEC-01 NFR-13 (e2e in U5)

### U3 — Search page, cards, filters, empty state (Wave 3)
| Field | Value |
|---|---|
| Kind | ui |
| Skills | caveman:lean-build |
| Module | root |
| Wave | 3 |
| Depends on | U1, U2 |
| Owns (create/modify) | `site/src/pages/SearchPage.tsx`, `site/src/ui/Card.tsx`, `ui/Filters.tsx`, `ui/EmptyState.tsx`, `ui/CommandBox.tsx`, `site/src/catalog/runs.ts`, `site/src/styles/search.css`; modify `site/src/App.tsx` (mount page), `site/src/i18n/en.ts` (add keys), `site/src/ui/Header.tsx` (request link query); tests `site/test/app/card.test.tsx`, `filters.test.tsx`, `search-page.test.tsx`, `runs.test.ts` |
| Must not touch | `site/src/search/**` (report a needed change instead), `site/src/catalog/types.ts` |
| Consumes | §3.3, §3.4, §3.5, §3.6 |
| Produces | the `#/` page |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `SearchPage` (markup `Main.dc.html:103-190`): hero, search box, count line (`role="status"`, `aria-live="polite"`, plural "N results" + ", best match first" / ", sorted by name"), filter column, results.
   - Input state updates at once. The committed query updates 120 ms after the last keystroke.
   - On commit or filter change, call `run()`, apply EC-1 hints once (Decision 6), and write the hash with `searchHash` via `replaceState`.
   - On load, read `sanitize(parseHash())` (AC-23b).
   - `/` outside an input, textarea, select or contenteditable focuses the box (navigating to `#/` first on other routes); `Esc` in the box clears and commits. The clear (×) button has its tooltip.
2. `Filters` (`:118-140`): kind chips only for `catalog.kinds`, category chips for `catalog.categories`, counts from `kindCounts`/`catCounts`, `aria-pressed`, disabled at 0 unless pressed, "Clear filters" when any filter is active. Below 768 px: a "Filters" toggle with active count, a sheet with Done (`catalog.css:355-359`). Drop the prototype's "selected from the words in your search" note (C-4).
3. `Card` (`:152-170`):
   - kind badge (merged: `<kind> · plugin`), "User-invoked only";
   - name link: artifact `#/plugins/<p>/<kind>/<name>`, plugin or merged `#/plugins/<p>`;
   - "in <plugin>" link on artifact cards; category when not null;
   - description `cut(…, 160)` or the snippet with "in `<file>`";
   - `<mark>` via `segments` on name and description or snippet;
   - Runs badge with `runsLabels(plugin)` (Decision 7) when `runs.runsCode`;
   - `invokeAs` + `argumentHint`; `CommandBox` with `plugin.installCommand` (Decision 10).
   All text goes through text nodes.
4. `EmptyState` (`:175-186`): title with the query or "these filters", `topTags` chips, "Clear filters" when filters are active (removes every filter, keeps `q`), "Request it" with `requestUrl(repoUrl, committedQuery)`. The header and footer request links use the same query on `#/`.
5. `search.css`: `catalog.css:116-206` and the mobile lines `:349-361`. EC-3a: card name `-webkit-line-clamp: 2`, description `-webkit-line-clamp: 4`, both `overflow: hidden`, with `overflow-wrap: anywhere` kept. Prototype inline styles `:123,137,142,181` become classes.

**Acceptance criteria**
- [ ] component: a card shows kind badge, name link, plugin link only on artifact cards, category, description ≤ 160 chars, install copy button — SPEC-01 AC-19a
- [ ] component: matched terms in name and description are `<mark>` elements; unmatched words are not — SPEC-01 AC-19b
- [ ] component: the skill card shows `/spec-driven:specify`-style `invokeAs`; a hook card shows none — SPEC-01 AC-19c
- [ ] component: a body-only match shows the snippet with its file label instead of the description — SPEC-01 AC-20
- [ ] component: a catalog without command/mcp kinds renders no Command or MCP chip and no empty section — SPEC-01 AC-22, EC-11
- [ ] component: hostile name/description/tag (`<img src=x onerror=alert(1)>`) render as text; no `img` element exists — SPEC-01 UT-3
- [ ] `runsLabels`: reasons order; `shell` from one agent → "agent with shell access"; two agents + one skill → one "skill …" then one "agent …" label — SPEC-01 AC-19a (card content per owner Q2 b)
- [ ] component (fake timers): typing then 120 ms shows ranked cards and writes `#/?q=…`; a hash with `q`/`kind`/`cat` restores them — SPEC-01 AC-13, AC-23a, AC-23b
- [ ] component: "I need a skill" selects the Skill chip and writes `kind=skill` with `q` kept; deselecting it does not reselect — SPEC-01 EC-1
- [ ] component: no-result query shows ≤ 5 tag chips and the prefilled request link, with and without filters; "Clear filters" only with filters, and clicking it keeps `q` — SPEC-01 AC-24, AC-64a, AC-64b
- [ ] component: `/` focuses the box from outside a field; `Esc` in the box clears it — SPEC-01 AC-25a, AC-25b
- [ ] below 768 px the filters sit behind the toggle (class/state; geometry in U5) — SPEC-01 AC-62b
- [ ] long names and descriptions are clamped with an ellipsis (CSS rule present; geometry in U5) — SPEC-01 EC-3a

### U4 — Translations test, UT-3 lint rule, NFR-14 test (Wave 4)
| Field | Value |
|---|---|
| Kind | library |
| Skills | none |
| Module | root |
| Wave | 4 |
| Depends on | U2, U3 |
| Owns (create/modify) | `site/test/i18n.test.ts`, `site/test/lint-ut3.test.ts`, `site/test/app/external-links.test.tsx`; modify `site/eslint.config.js` (UT-3 rule); fix any offending string in `site/src/**/*.tsx` / `en.ts` the tests find |
| Must not touch | `site/src/search/**` logic, `site/src/catalog/types.ts` |
| Consumes | §3.5 |
| Produces | — |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `i18n.test.ts`: walk `site/src/**/*.tsx` with the TypeScript compiler API. Fail on any `JsxText` with a letter. Fail on a string literal with a letter in `aria-label`, `title`, `placeholder` or `alt`, including `{'…'}` expressions. Collect every `t()` first argument: it must be a string literal and resolve in `en`.
2. `eslint.config.js` (`src/**`): `no-restricted-syntax` for `JSXAttribute[name.name='dangerouslySetInnerHTML']`, `MemberExpression[property.name=/^(innerHTML|outerHTML)$/]`, `CallExpression[callee.property.name='insertAdjacentHTML']`. `lint-ut3.test.ts` runs ESLint's API `lintText` on one snippet per selector and expects an error.
3. `external-links.test.tsx`: render `Header`, `Footer`, a result list and `EmptyState` from a fixture catalog. Every `a[href]` whose origin differs from `location.origin` has `rel` containing `noopener` and `noreferrer`.

**Acceptance criteria**
- [ ] translations test passes on the tree and fails on a planted JSX text / `aria-label` literal / unknown key (each checked in the test) — SPEC-01 AC-63
- [ ] ESLint reports each banned HTML sink; `npm run lint` is clean on `src/` — SPEC-01 UT-3
- [ ] every rendered cross-origin link carries `rel="noopener noreferrer"` — SPEC-01 NFR-14

### U5 — E2E suite, fixture check, workflow (Wave 5)
| Field | Value |
|---|---|
| Kind | e2e |
| Skills | none |
| Module | root |
| Wave | 5 |
| Depends on | U0–U4 |
| Owns (create/modify) | `site/test/e2e/helpers.ts`, `shell.spec.ts`, `search.spec.ts`, `security.spec.ts`; `site/scripts/check-fixtures.mjs`, `site/test/check-fixtures.test.mjs`; `.github/workflows/site.yml`; `site/test/workflow.test.mjs` |
| Must not touch | `site/scripts/generate.mjs`, `site/scripts/lib/**`, app source (report failures instead) |
| Consumes | §3.2, §3.7, §3.8; the built `dist/` |
| Produces | — |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` (e2e: NOT VERIFIABLE locally by the implementer; run in §7 and CI) |

**Steps**
1. `helpers.ts`: read `site/src/generated/catalog.json` for expectations. No hard-coded counts (`:827-831`) except golden and named real cases.
2. `shell.spec.ts`:
   - each route (home, first plugin, first artifact, install, new, unknown) by direct load, reload, back/forward, asserting the h1;
   - an unknown plugin or artifact shows not-found with a search link;
   - catalog chunk (`**/assets/catalog-*.js`) delayed: skeletons; fulfilled 500: error and Retry; Retry triggers a new navigation;
   - footer text equal under `timezoneId` `Asia/Tokyo` and `UTC`;
   - fresh context with both `colorScheme` values gives dark;
   - toggle changes `data-theme`, a sampled background and `catalog.theme`;
   - stored light: `data-theme` is light at `DOMContentLoaded`, plus a screenshot;
   - `AxeBuilder.include('<theme toggle selector>')` gives 0 violations in both themes;
   - scroll width ≤ viewport at 320/375/768/1280/1920 on every route.
3. `search.spec.ts`: type "I need a skill for safe migrations", wait, assert card order equals the catalog-driven expectation; one card for django-safe-migration; `#/?kind=plugin` shows no merged card; kind=skill + cat=backend; chip counts; hash after typing; reload restores; nonsense query with and without filters (tags, request href, clear filters); `/` and `Esc`; `#/` lists every plugin by name; `#/?kind=skill` every skill; "I need a" and "I need a skill" (EC-1); 320 px card name and description clamped; filters behind the toggle at 375 px, visible at 768 px.
4. `security.spec.ts`: on every route, 0 `securitypolicyviolation` events (collected by an init script) and 0 CSP console errors; the served meta equals §3.2; every request URL has the site's origin.
5. `check-fixtures.mjs <catalog>`: exit 1 with `fixture data in catalog: <names>` when any `plugins[].name` or `artifacts[].plugin` starts with `fixture-`, else exit 0. Test both with temp files.
6. `site.yml` per §3.7. Extend `workflow.test.mjs`: tests job order Vitest < Generate < Build < Install Chromium < E2E < Audit; build job has Build site then Fixture check after Generate; still exactly two jobs.

**Acceptance criteria**
- [ ] e2e green on Chromium against `vite preview` of the real build — SPEC-01 AC-13, AC-18a, AC-18b, AC-21a, AC-21b, AC-23a, AC-23b, AC-24, AC-25a, AC-25b, AC-26a, AC-26b, AC-64a, AC-64b, EC-1, EC-3a, AC-62b
- [ ] e2e green for routes and states — SPEC-01 AC-47, AC-48, AC-49, AC-50a, AC-50b, AC-51
- [ ] e2e green for theme and layout; axe scoped to the toggle shows 0 violations — SPEC-01 AC-59, AC-60a, AC-60b, AC-60c, AC-61, AC-62a
- [ ] 0 CSP violations and only same-origin requests on every route — SPEC-01 NFR-12, NFR-13
- [ ] a catalog with a `fixture-` plugin or artifact plugin makes the fixture check, and so "Site: build", fail; the real catalog passes — SPEC-01 AC-7b
- [ ] `workflow.test.mjs` passes with the new steps (CI run is NOT VERIFIABLE locally) — SPEC-01 AC-7b

## 5. Waves
| Wave | Units | Runs | Why this order |
|---|---|---|---|
| 0 | U0 | sequential | deps, configs and alias first (shared checkout) |
| 1 | U1 | sequential | search logic has no UI dependency |
| 2 | U2 | sequential | shell, router, i18n, CSP; mounts the U1-backed page slot |
| 3 | U3 | sequential | search page needs U1 output and U2 router/i18n |
| 4 | U4 | sequential | translations/link tests need all `.tsx` from U2 and U3 |
| 5 | U5 | sequential | e2e needs the finished app; workflow last |

Serialized files: `site/package.json`, `site/package-lock.json`, `site/tsconfig.json`, `site/vitest.config.ts`, `site/playwright.config.ts` (U0 only). `site/vite.config.ts` (U0 creates, U2 adds the plugin). `site/eslint.config.js` (U0, U4). `site/src/i18n/en.ts` (U2 creates, U3 and U4 extend). `site/src/App.tsx` and `site/src/ui/Header.tsx` (U2 creates, U3 modifies). `.github/workflows/site.yml` and `site/test/workflow.test.mjs` (U5 only).

## 6. Test plan
| Module | Tests | Owner (unit) | Needs a running stack? |
|---|---|---|---|
| root | `test/search/*.test.ts` (pipeline, ranking, ties, collapse, facets, snippet, EC-2a/b, NFR-11) | U1 | no |
| root | `test/search/golden.test.ts` (AC-14, in-process `generate()` on the checkout) | U1 | no (needs full git history) |
| root | `test/app/router`, `request-url`, `theme-init`, `html-plugin`, `shell` | U2 | no (jsdom) |
| root | `test/app/card`, `filters`, `search-page`, `runs` | U3 | no (jsdom, fake timers) |
| root | `test/i18n.test.ts`, `test/lint-ut3.test.ts`, `test/app/external-links.test.tsx` | U4 | no |
| root | `test/check-fixtures.test.mjs`, `test/workflow.test.mjs` | U5 | no |
| root | `test/e2e/*.spec.ts` (Playwright Chromium + axe on the toggle) | U5 | yes: generated catalog, `vite build`, `vite preview`, Chromium. Implementers report NOT VERIFIABLE; §7 and CI run them |

## 7. Verification (orchestrator, after the last wave)
1. `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check`
2. `GITHUB_REPOSITORY=humen-dev/agent-plugins npm --prefix site run generate`
3. `npm --prefix site run build`, then `node site/scripts/check-fixtures.mjs site/src/generated/catalog.json`
4. `npm --prefix site run e2e` (mandatory; its result is the evidence for every e2e row)
5. Inspect `site/dist/index.html`: CSP meta exact, theme-init before the stylesheet, `assets/catalog-*.js` present.
6. Pre-PR: work on `feature/catalog-site-m2` only, never commit to `main`. No Co-Authored-By or "Generated with" lines in commits or the PR body. The owner sees the diff before any PR is opened. Bump no plugin version: no plugin is touched.

## 8. Risks
- **Golden queries fail on BM25 + OR**: AC-14 red. Mitigation: tune the synonym table first, then boost values that keep the AC-15 order and equalities (name > own tags > description > headings > inherited tags = body) (Decision 11). Every change goes into the wave report and SF-3. Work stops and goes to the owner only if the golden queries need a different order or a broken equality; the golden list never changes.
- **Vite tag order**: the stylesheet link lands before theme-init and the first paint flashes dark. Mitigation: `htmlPlugin` reorders the tags; `html-plugin.test.ts` and AC-60c e2e catch it.
- **CSP vs build output**: an inline script or style (modulepreload polyfill, a React inline style) is blocked in preview. Mitigation: no inline `style=` in the components; the `security.spec.ts` violation listener; Vite emits the polyfill inside the entry chunk.
- **Request link before M4**: `plugin-request.yml` (AC-46) does not exist yet, so the link opens GitHub without the form. Nothing is deployed until M5, and only the href is asserted.
- **Alias drift**: a missing `src/generated/catalog.json` makes `vite build` fail with a resolve error. `check` stays green, because tsc uses the ambient module. §7 step 2 and CI generate before the build.
- **Vite/Vitest peer mismatch**: install fails or Vitest breaks. U0 picks the Vite major that `vitest@^5` declares.
- **Untrusted catalog text**: summaries and descriptions are plain but untrusted (M1 plan §8). Text nodes only; the U4 lint rule and the U3 hostile-string test.

## 9. Out of scope
M3–M5 rows; plugin, artifact, install and what's-new page content (placeholders only, Decision 3); the install-set count in the header (Q3 a, M4); AC-36/37 copy tests and EC-7 storage tests (M4), although the copy box exists; Markdown rendering; size budgets, Lighthouse, the axe matrix, deploy, concurrency (M5); `.github/ISSUE_TEMPLATE/plugin-request.yml` (M4); `site/prototype/**` (kept as reference, not built); generator and `types.ts` changes.

### Spec follow-ups (owner: user / spec author)
- SF-2: the Search section's empty result (`:387-389`) should state the tag tie-break: equal frequency → tag name ascending, code-unit order.
- SF-3: the Search index table (`:313-320`) and the synonym table (`:352-361`) should take the boost and synonym values changed in M2 golden-query tuning, as listed in the U1 wave report (Decision 11). None if nothing changed.
