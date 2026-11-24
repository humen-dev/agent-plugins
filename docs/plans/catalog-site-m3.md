# Catalog site M3 (plugin page, artifact page, What it runs, Markdown) — development plan

| Field | Value |
|---|---|
| Status | approved |
| Goal | A user opens `#/plugins/<name>` or `#/plugins/<p>/<kind>/<name>` and sees every plugin-page or artifact-page element whose data is present. This includes the What-it-runs security profile, copied from the catalog. README, bodies, supporting files and notices are rendered as Markdown through text nodes only, with allow-listed links and no image loads. |
| Requirements source | `docs/specs/catalog-site.md` (SPEC-01, Status: approved `:4`), milestone M3 only (`:921`); design `site/prototype/` (README `:20`: the spec wins); owner M3 brief; the planner's Requirements review (C-1..C-13, U-1, U-2, G-1, G-2, E-1..E-3, I-1..I-3) and the owner's answer to Q3 / Recommendation 1. Input only: this plan never edits them. |
| Execution mode | single-agent (sequential pass). Confirmed by the owner (Q4 b). |
| Modules touched | root |

## 1. Context

M1 and M2 are merged. The app routes `#/plugins/<p>` and `#/plugins/<p>/<kind>/<name>` to stand-ins that show only an h1 or not-found (`site/src/pages/Placeholders.tsx:12-23`, `site/src/App.tsx:69`). The parts M3 reuses are listed below.
- Catalog types: `site/src/catalog/types.ts`, with the model at spec `:149-281`.
- Router: `site/src/router.ts:12-29`. `#/new?plugin=` already parses as `new` (`:27`).
- `t()` and the `en` groups: `site/src/i18n/en.ts:1-101`. The `runs.` prefix is reserved for M3 (M2 plan §3.5).
- Kind labels: `site/src/ui/Card.tsx:9-17`.
- `CommandBox`: `site/src/ui/CommandBox.tsx:5-43`. Its aria-label is fixed to `card.install` (`:35`).
- `runsLabels`: `site/src/catalog/runs.ts:6-14`. It reads the `card.runs.*` keys.
- `utcDay`/`shortSha`: `site/src/format.ts:2-4`. Icons (`chevR`, `file`, `ext`, `warn`, `pkg`, kinds): `site/src/ui/icons.ts:2-14`.
- Styles: tokens, `app.css` and `search.css` are linked from `site/index.html:8-10`. Each new stylesheet is a new `<link>` there.
- The UT-3 lint ban: `site/eslint.config.js:20-31`. The AC-63 scan: `site/test/i18n.test.ts:8-44`. It checks `aria-label`, `title`, `placeholder` and `alt`, not `data-*`.
- Component fixtures are built two ways: hand-made with `site/test/search/fixture-catalog.ts:7-28`, or generated in process from `site/test/fixtures/repo` the way `site/test/generate.test.mjs:24-31` does it.

Requirements: SPEC-01 M3 rows (`:921`), the Security profile (`:405-430`), the Pages table rows for plugin, artifact and What it runs (`:437-439`), AC-27a..AC-35 (`:540-554`), EC-3b..EC-5, EC-13..EC-16 (`:636-651`), UT-1 and UT-2a (`:763-764`).

Design sources read:
- `Main.dc.html:192-364` (plugin page markup), `:366-430` (artifact page markup) and `:842-929` (their view models).
- `Markdown.dc.html:16-124` (the Markdown block and its parser).
- `Components.dc.html:121-137` (collapsible, breadcrumb, facts, the MCP and agent tables, the plain sentence).
- `catalog.css:208-312` and `:327-338` (page, table, collapsible, change-row, notice and Markdown rules), and `:362-373` (the mobile reflow).

Binding sources: there is no `AGENTS.md` or `CLAUDE.md` at the root or in `site/`, and there are no project skills. `INSIGHTS.md:3-4` holds two MiniSearch entries, and M3 does not touch search. New files follow the M2 layout:
- `src/pages/` for pages and `src/ui/` for components;
- `src/links/` for URL builders, following `links/request-url.ts`;
- a new `src/markdown/` library folder, following `src/search/`;
- `src/styles/*.css` linked from `index.html`;
- `test/app/*.test.tsx` for component tests and `test/e2e/*.spec.ts` for e2e.

### Requirements review
- **Confirmed by the owner** (Q1 a): C-1..C-13, U-1, U-2 and E-1..E-3 apply as written in the review. They are restated where a unit needs them (Decisions 2–9).
- **G-1 / Q2 b, confirmed by the owner**: "Add to install set" is left out of M3 (§9, SF-5).
- **G-2 / Q3 answered**: the parser choice is Decision 1. Raw HTML is shown as text. Every link and image goes through one allow-list. Nesting depth is capped. Hostile-input tests have a time limit.
- **Recommendation 1: accepted.** The four extra rules (blockquote, one nested list level, `*em*`/`_em_`, inline code in link text) are in U1. The parser choice was decided in the plan, as the owner asked.
- **Recommendation 2: accepted** (Q2 b, confirmed by the owner).
- Info: I-1 (EC-16 is already built at `site/index.html:13-16` and is now checked in U4), I-2 (recent changes render now; the filter itself is M4), I-3 (the "See what it runs" control scrolls and focuses the section without changing the hash).

### Decisions
1. **Markdown parser: option (a), extend the prototype's hand-written parser.**

   | Option | Pros | Cons |
   |---|---|---|
   | (a) Extended hand-written parser (`Markdown.dc.html:63-123` plus the 4 rules) | No new dependency: lockfile and audit unchanged (NFR-16a). It adds only a few KB of app code, so the NFR-1a budget keeps its headroom. HTML is never tokenised, so raw HTML can only ever be text. The allow-list and the depth caps live in our own code. It matches the approved design exactly. | Not CommonMark: rare constructs (reference links, setext headings, lazy continuation, HTML blocks) render as plain text or in a simpler form. It has to be written linear-time by hand, and the hostile tests guard that. |
   | (b) `mdast-util-from-markdown` + `micromark-extension-gfm-table` + `mdast-util-gfm-table`, with our own React mapper | Full CommonMark/GFM fidelity. `micromark` is built to resist pathological input. | It adds 3 direct and about 20 transitive packages. Bundlephobia gzip sizes: [mdast-util-from-markdown 2.1.0: 15.7 KB](https://bundlephobia.com/api/size?package=mdast-util-from-markdown), [micromark-extension-gfm-table 2.1.2: 2.5 KB](https://bundlephobia.com/api/size?package=micromark-extension-gfm-table), [mdast-util-gfm-table 2.0.1: 8.8 KB](https://bundlephobia.com/api/size?package=mdast-util-gfm-table). The sum is ≈ 27 KB gzip, about 22 % of the 120 KB initial-JS budget (NFR-1a `:719`). It is an upper bound, because shared micromark deps are counted twice and the to-markdown half is tree-shaken. Lazy loading would keep it out of the initial JS, but every Markdown section would then need a loading state. The mapper still has to drop `html` nodes and apply the allow-list and depth caps itself. |

   Chosen: (a). The required subset is small. The design is the prototype parser. (b) costs budget and supply-chain surface for fidelity that the real READMEs barely use (G-2). The current initial-JS size was not measured in this round, so §7 step 4 measures it. Rejected: (b), for the reasons above.
2. **Links (C-1, UT-2a, EC-14)**: one resolver for every link and image node (§3.2).
   - Schemes are allow-listed: http, https and mailto for links; http and https for images.
   - Any other scheme gives plain text. Classification is case-insensitive and ignores ASCII controls and whitespace.
   - Relative targets resolve with `new URL()` against the file's blob URL. `#frag` becomes `<file blob URL>#frag`.
   - A result outside `<repoUrl>/blob/<commit>/` gives plain text. That covers `../` above the root, `/x` and `//host`.
3. **Images (C-2, EC-15a/b, U-2)**: an http(s) image becomes a link to its URL with the alt text, plus an sr-only `md.imageNotLoaded` suffix. A relative image becomes a link to its blob URL. Any other scheme gives the alt text only. No `<img>` element is ever created.
4. **Rendering (C-3)**: the README, `thirdPartyNotices` (collapsed), the artifact body, each supporting file (collapsed) and each `whatItRuns` text all use `MarkdownBlock`. The "excerpt" label is dropped.
5. **What it runs (C-4, C-5, C-6, C-10, C-11, C-12)**:
   - The MCP table has Server · Type · Command + args or URL · Env vars.
   - The hook description row links `definedIn` and each script source.
   - An allowed-tools table appears only when a skill or command has `allowedTools !== null`.
   - A null matcher or timeout reads `runs.notSet`. A timeout reads "{n} s".
   - Hook commands sit in a block code box that scrolls horizontally.
   - The badge keeps the M2 per-kind labels (from the `runs.*` keys). The reasons line then names each `shellArtifacts` entry, linked to its artifact page.
6. **Agents (C-7, AC-31)**: `tools: null` reads "not declared: inherits the session's tools". `tools: []` reads "none". A null `model` reads "not declared", never "inherit".
7. **Artifact page (C-8, C-9)**: the shell badge shows when `plugin.runs.shellArtifacts` contains the artifact id. Facts are written per kind, command and MCP included (§3.5).
8. **Strings (C-13, U-1)**: every `data-label` comes from `t()`, and the AC-63 scan adds `data-label`. Every text the What-it-runs section renders itself uses `runs.*`. The embedded Markdown block uses `md.*`. The AC-32b scan bans the four phrases in both groups.
9. **M2 extensions (E-1..E-3)**:
   - `CommandBox` gets an optional `label`. `runsLabels` gets an optional key group. Both defaults are unchanged.
   - `Placeholder` keeps only install and new. `App` routes plugin and artifact to the new pages.
   - The router, `types.ts`, search, `Card` and `request-url` are unchanged.
10. **Preloaded skills**: a value `<plugin>:<skill>` links to `#/plugins/<plugin>/skill/<skill>` when that skill is in the catalog. Otherwise it is plain text, so the page never links to a not-found page.
11. **Design extras kept as drawn**: the "What it adds" count line, the missing-dependency notice, the Tags panel, the Links panel and "All changes for <plugin>" (`#/new?plugin=<name>`) all come from `Main.dc.html:215-360`. They show catalog data only.
12. **Skills**: `none` for every unit (owner decision). A third-party skill outside this repo's marketplace would make the flow non-reproducible, and overbuilding is already bounded by each unit's Owns / Must not touch and by the verifier.

### Open questions
None. The owner confirmed Q1 a (C-1..C-13, U-1, U-2 and E-1..E-3 as written), Q2 b (no "Add to install set" in M3) and Q4 b (single-agent) at approval.

## 2. Affected modules
| Module | Touched? | Why / what changes | Rule that applies |
|---|---|---|---|
| root | yes | `site/src/markdown/**` (new), `site/src/links/source-url.ts` and `hash.ts`, `site/src/pages/PluginPage.tsx` and `ArtifactPage.tsx`, `site/src/ui/WhatItRuns.tsx` and `Collapsible.tsx`, `site/src/styles/markdown.css` and `pages.css`, plus edits to `App.tsx`, `Placeholders.tsx`, `en.ts`, `runs.ts`, `CommandBox.tsx` and `index.html`; tests under `site/test/markdown/`, `site/test/app/` and `site/test/e2e/` | spec `:131-133`, `:437-439`, `:459-463`; closest modules `site/src/search/` and `site/src/links/request-url.ts`; M2 plan Decision 2 (port classes; inline styles become classes) |

There are no dependency or config changes. M1 contracts (`types.ts`, the generator) and the M2 router, search and `request-url` contracts stay unchanged.

## 3. Contracts

### 3.1 Markdown AST (U0 writes `site/src/markdown/types.ts` verbatim)
```ts
export type Inline =
  | { t: 'text'; text: string }
  | { t: 'code'; text: string }
  | { t: 'strong'; text: string }
  | { t: 'em'; text: string }
  | { t: 'link'; href: string; children: Exclude<Inline, { t: 'link' | 'image' }>[] } // href raw, resolved at render
  | { t: 'image'; src: string; alt: string };                                         // src raw; never an <img>
export interface ListBlock { t: 'list'; ordered: boolean; items: { children: Inline[]; sub: ListBlock | null }[] }
export type Block =
  | { t: 'heading'; level: 1 | 2 | 3; children: Inline[] }   // # → 1, ## → 2, ###..###### → 3
  | { t: 'para'; children: Inline[] }
  | ListBlock                                                 // sub is set only on top-level items
  | { t: 'code'; lang: string; text: string }                 // fenced; verbatim
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'quote'; children: Block[] }
  | { t: 'hr' };
export const LIMITS = { quoteDepth: 3, listDepth: 2 } as const;
// a ">" beyond quoteDepth stays literal text; an item indented beyond listDepth joins the level-2 item list
```

### 3.2 Parser, resolver, source URLs (U1)
```ts
// site/src/markdown/parse.ts — total, linear-time, no RegExp built from input, HTML never tokenised
export function parseMarkdown(source: string): Block[];
// site/src/markdown/links.ts
export type Target = { href: string; github: boolean } | null;   // null = render as plain text
export function resolveTarget(raw: string, fileBlobUrl: string, blobRoot: string, kind: 'link' | 'image'): Target;
//  s = raw.trim(); probe = s without [\u0000- \u007F]
//  /^[a-z][a-z0-9+.-]*:/i on probe → scheme ∈ {http:, https:, mailto:} (image: http:, https:) ? new URL(s).href : null
//  else u = new URL(s, fileBlobUrl); u.href.startsWith(blobRoot) ? u.href : null   (URL errors → null)
//  github = href starts with 'https://github.com/'
// site/src/links/source-url.ts — AC-35
export const blobUrl = (c: Catalog, path: string) => `${c.marketplace.repoUrl}/blob/${c.build.commit}/${path}`;
export const treeUrl = (c: Catalog, path: string) => `${c.marketplace.repoUrl}/tree/${c.build.commit}/${path}`;
// site/src/markdown/MarkdownBlock.tsx
export function MarkdownBlock({ doc, catalog }: { doc: Markdown; catalog: Catalog }): JSX.Element;
//  fileBlobUrl = blobUrl(catalog, doc.path); blobRoot = blobUrl(catalog, '')
```

### 3.3 M2 extensions (U2)
```ts
export function CommandBox({ text, label }: { text: string; label?: string }); // aria-label = label ?? t('card.install')
export function runsLabels(p: Plugin, group: 'card' | 'runs' = 'card'): string[]; // same order and rules; 'runs' reads runs.* keys
// site/src/links/hash.ts
export const pluginHash = (name: string) => `#/plugins/${encodeURIComponent(name)}`;
export const artifactHash = (a: Pick<Artifact, 'plugin' | 'kind' | 'name'>) => `${pluginHash(a.plugin)}/${a.kind}/${encodeURIComponent(a.name)}`;
```

### 3.4 Pages and i18n groups
```ts
export function PluginPage({ catalog, plugin }: { catalog: Catalog; plugin: Plugin }): JSX.Element;            // U2
export function WhatItRuns({ catalog, plugin }: { catalog: Catalog; plugin: Plugin }): JSX.Element;            // U2
export function Collapsible({ title, sub, children }: { title: string; sub: string; children: ReactNode }); // U2: <details class="coll">
export function ArtifactPage({ catalog, plugin, artifact }: { catalog: Catalog; plugin: Plugin; artifact: Artifact }): JSX.Element; // U3
// App: plugin/artifact route → page when found (lookup as Placeholders.tsx:17-22), else NotFound
```
New `en` groups: `md` (U1), `plugin` and `runs` (U2), `artifact` (U3). No value in `runs` or `md` contains "safe", "secure", "trusted" or "no network" (case-insensitive).

### 3.5 Artifact facts (U3), rows in this order, a row omitted when its value is null unless stated
```text
all kinds: Plugin (name + version when set) · Kind
skill:   Invoke as · Argument hint · Invocation (userOnly / by you or Claude) · Allowed tools (null omit, [] "none") · Model · Path
command: Invoke as · Argument hint · Allowed tools (null omit, [] "none") · Model · Path
agent:   Invoke as · Model (null → "not declared") · Tools (null → AC-31 text, [] → "none") · Disallowed tools (non-empty)
         · Preloaded skills (Decision 10) · Max turns · Path
hook:    Event · Matcher (null → "not set") · Type · Command (block code box, EC-3b; null omit) · Timeout ("{n} s", null → "not set")
         · Scripts (links, non-empty) · Defined in (blob link)
mcp:     Transport (null → "not set") · Command · Args (non-empty) · URL · Env vars (names, non-empty) · Defined in (blob link)
```

## 4. Work units

### U0 — Markdown AST contract (Wave 0)
| Field | Value |
|---|---|
| Kind | orchestrator |
| Skills | — |
| Module | root |
| Wave | 0 |
| Depends on | none |
| Owns (create/modify) | `site/src/markdown/types.ts` (create) |
| Must not touch | everything else |
| Consumes | — |
| Produces | §3.1 |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. Write §3.1 verbatim. No dependency, config or move is needed (Decision 1).

**Acceptance criteria**
- [ ] `npm --prefix site run check` passes with the new file — contract for SPEC-01 UT-1, UT-2a

### U1 — Markdown block, link resolver, source URLs (Wave 1)
| Field | Value |
|---|---|
| Kind | ui |
| Skills | none |
| Module | root |
| Wave | 1 |
| Depends on | U0 |
| Owns (create/modify) | `site/src/markdown/parse.ts`, `links.ts`, `MarkdownBlock.tsx`; `site/src/links/source-url.ts`; `site/src/styles/markdown.css`; modify `site/src/i18n/en.ts` (add `md`), `site/index.html` (link `markdown.css` after `search.css`); tests `site/test/markdown/parse.test.ts`, `links.test.ts`, `hostile.test.ts`, `markdown-block.test.tsx`, `site/test/app/source-url.test.ts` |
| Must not touch | `site/src/markdown/types.ts`, `site/src/search/**`, `site/src/catalog/types.ts`, `site/eslint.config.js` (the UT-3 ban stays as is), `site/prototype/**` |
| Consumes | §3.1 |
| Produces | §3.2; `md.*` keys |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `parse.ts`: port `mdParse`/`mdInline` (`Markdown.dc.html:63-123`) to §3.1, and add:
   - blockquote (`>`, nesting up to `LIMITS.quoteDepth`);
   - one nested list level (`LIMITS.listDepth`);
   - `*em*`/`_em_`;
   - inline code, strong and em inside link text.

   Other rules:
   - Tables split on `|` and drop the separator row.
   - A fence with no closing line runs to the end.
   - CRLF is normalised.
   - `<…>` text stays text. The only exception is an autolink `<http(s)://…>`, which becomes a link node.
   - The inline scanner must be linear: a run of unmatched `[`, `*`, `` ` ``, `![` or `<` must never cause a rescan to the end of the text from every position.
2. `links.ts`: `resolveTarget` per §3.2 and Decision 2.
3. `MarkdownBlock.tsx`: the root is `<div class="md">`.
   - Headings are `role="heading"` with `aria-level = level + 2`, as in the prototype `:94`.
   - `p`, `ul`/`ol` (nested), `blockquote` and `hr` map to their elements.
   - Code is `<figure>` + `<figcaption>`, with the lang verbatim, or `md.code`, or `md.mermaid` for `mermaid` (EC-13). It holds `<pre tabindex="0" aria-label>` and `<code>`.
   - A table is a scrollable `role="region"` with `role="table"` rows (`:41-46`) and `aria-label` `md.table`.
   - Link nodes: null target → children as text. Otherwise `<a target="_blank" rel="noopener noreferrer">`. A GitHub link gets the `ext` icon and the sr-only `md.opensOnGithub`; any other http(s) link gets the sr-only `md.external`.
   - Image nodes: Decision 3.
   - Text nodes only; no HTML sink (`site/eslint.config.js:21-30`).
4. `source-url.ts` per §3.2.
5. `markdown.css`: port `catalog.css:327-338` and the inline styles of `Markdown.dc.html:16-48` as classes. Add blockquote, nested list and `em` rules with tokens only.
6. `hostile.test.ts`: each case asserts `parseMarkdown` ≤ 500 ms and a `MarkdownBlock` render ≤ 2000 ms (measured with `performance.now()`, test timeout 10 s). The cases are:
   - 1 MB of `[`, `*`, `` ` ``, `![` and `<`;
   - 10 000 nested `>`;
   - 1 000 list levels;
   - a 2 000 × 50 table;
   - HTML tags in blocks, inline, in tables and in link text;
   - `javascript:`, `data:` and `vbscript:` in links and images, in mixed case, with leading whitespace and with an embedded tab.

**Acceptance criteria**
- [ ] `<script>`, `<img onerror>` and `<iframe>` (block, inline, table cell, link text) render as visible text; the container has no `script`, `img`, `iframe` or other element created from them — SPEC-01 UT-1
- [ ] `[x](javascript:alert(1))`, `JaVaScRiPt:`, `data:text/html,…`, `vbscript:`, `ftp:x`, `file:x` and `" \tjavascript:"` render the text "x" with no `a` element, in a paragraph, a heading, a list, a quote and a table; `https:` and `mailto:` give links — SPEC-01 UT-2a
- [ ] `references/x.md` in `plugins/p/skills/s/SKILL.md` → `<repoUrl>/blob/<commit>/plugins/p/skills/s/references/x.md`; `../../README.md#install` resolves by URL semantics; `#frag` → file blob URL + `#frag`; `../` above the root, `/x` and `//evil.example` give text — SPEC-01 EC-14
- [ ] `![d](https://x/y.png)` gives a link to that URL with the text "d" and the sr-only "not loaded" suffix, and no `img` element exists — SPEC-01 EC-15a
- [ ] `![x](javascript:alert(1))` gives the text "x" and no link — SPEC-01 EC-15b
- [ ] a ```` ```mermaid ```` fence renders as a code block captioned `md.mermaid`, with the text verbatim — SPEC-01 EC-13
- [ ] blockquote, one nested list level, `*em*`/`_em_` and `` [`code`](url) `` render as `blockquote`, nested `ul`, `em` and `a > code`; `>` beyond depth 3 and items beyond level 2 stay bounded (no deeper element) — Recommendation 1 (accepted)
- [ ] every hostile case finishes within its time limit — Q3 answer (accepted)
- [ ] `blobUrl`/`treeUrl` give `<repoUrl>/blob|tree/<build.commit>/<path>` — SPEC-01 AC-35 (unit)

### U2 — Plugin page and What it runs (Wave 2)
| Field | Value |
|---|---|
| Kind | ui |
| Skills | none |
| Module | root |
| Wave | 2 |
| Depends on | U1 |
| Owns (create/modify) | `site/src/pages/PluginPage.tsx`, `site/src/ui/WhatItRuns.tsx`, `site/src/ui/Collapsible.tsx`, `site/src/links/hash.ts`, `site/src/styles/pages.css`; modify `site/src/App.tsx`, `site/src/pages/Placeholders.tsx`, `site/src/catalog/runs.ts`, `site/src/ui/CommandBox.tsx`, `site/src/i18n/en.ts` (add `plugin`, `runs`), `site/index.html` (link `pages.css`), `site/test/i18n.test.ts` (add `data-label` to `ATTRS`, plus one planted case); tests `site/test/app/fixture-full.ts` (generated catalog helper), `plugin-page.test.tsx`, `what-it-runs.test.tsx`, `runs-keys.test.ts`, and extend `site/test/app/runs.test.ts` |
| Must not touch | `site/src/markdown/**` (report a needed change), `site/src/router.ts`, `site/src/search/**`, `site/src/ui/Card.tsx`, `site/src/catalog/types.ts` |
| Consumes | §3.1, §3.2 |
| Produces | §3.3, `PluginPage`, `WhatItRuns`, `Collapsible`; `runs.*`/`plugin.*` keys |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `fixture-full.ts`: in `beforeAll`, build the fixture repo as `site/test/generate.test.mjs:24-31` does, then `generate({ root, repo: 'o/r' })` (30 s timeout) and export the catalog.
2. §3.3 changes to `CommandBox` and `runsLabels`, and `hash.ts`.
3. `PluginPage` (markup `Main.dc.html:192-364`, logic `:842-890`):
   - The header has the plugin badge, category, h1 and a facts line (version, author with link, license, updated `utcDay`). Each item is omitted when null (AC-27b, C-10).
   - The Runs badge uses `runsLabels(p, 'runs')` when `runsCode`. Its "See what it runs" control scrolls to the section and focuses it (I-3).
   - Then the summary; "What it adds" (artifacts in Kind order, then name, code-unit compare; badge, name link, invokeAs or `runs on <event>`, description `cut(…,160)`, source link) or EC-4; dependencies (EC-5 plus the notice); `WhatItRuns`; README via `MarkdownBlock` when `readme` is set; notices in a `Collapsible` (closed); recent changes (`<from> → <to>`, `utcDay`, subject, sha link, "All changes for" link).
   - The aside has the install box (`addCommand` and `installCommand`, each a `CommandBox` with its own label), the Links panel (source `treeUrl`, plus homepage and repository when set) and Tags (`#/?q=<tag>`).
   - There is no install-set button (Q2 b).
4. `WhatItRuns` (`:241-302`, Decisions 5 and 6):
   - It opens with the intro line linking the commit, the badge, the shell-entry line, and the AC-30 sentence when there are no hooks, MCP servers or scripts.
   - Tables: hooks (with the description row and the `definedIn`/script links), scripts (path, source link, hook links or "not named in a hook command"), MCP servers, agents, allowed tools.
   - "Author's description" shows each `whatItRuns` heading and its `MarkdownBlock`.
   - Every `data-label` and header comes from `runs.*`.
5. `Collapsible`: `<details class="coll">` with the chevron, the title and the `sub` path (`Components.dc.html:122-123`).
6. `App.tsx`: the plugin route renders `PluginPage`, or `NotFound` when the plugin is missing. `Placeholders.tsx` keeps only install and new.
7. `pages.css`:
   - Port `catalog.css:208-260`, `:262-271`, `:273-285` (without `.chg .old::after`), `:305-312` and the mobile lines `:362-373` under `@media (max-width: 767px)`.
   - Prototype inline styles (`Main.dc.html:203,207,299,341,351`) become classes.
   - EC-3b: `.cmd-block { white-space: pre; overflow-x: auto; overflow-wrap: normal }`, which wins over `.tbl .td`.
8. `runs-keys.test.ts`: every string in `en.runs` and `en.md` is free of the four banned phrases (case-insensitive). A planted value fails.

**Acceptance criteria**
- [ ] component on `fixture-full`: every Pages-table plugin element is present: header facts, Runs badge, both install boxes, summary, artifact table, dependencies, What it runs, README, notices (closed `details`), recent changes, source/homepage/repository links — SPEC-01 AC-27a
- [ ] component on a minimal plugin (all nullable fields null, no notices, no deps, no changes): none of those elements and no empty heading — SPEC-01 AC-27b
- [ ] artifact table link count equals `artifactIds.length`; each href is its artifact hash — SPEC-01 AC-28
- [ ] fixture-full hook rows show event, matcher, type, verbatim command, timeout and description; a null timeout reads "not set" — SPEC-01 AC-29a
- [ ] fixture MCP row shows transport, command + args or URL, and env var names only — SPEC-01 AC-29b
- [ ] script rows show path, source link and referencing hooks; an unreferenced script shows "not named in a hook command" — SPEC-01 AC-29c
- [ ] agent rows show model, tools and disallowed tools; `tools: []` reads "none"; a null model reads "not declared" — SPEC-01 AC-29d
- [ ] a plugin with no hooks, MCP servers or scripts shows the AC-30 sentence; adding one hook removes it — SPEC-01 AC-30
- [ ] an agent with `tools: null` shows "not declared: inherits the session's tools" — SPEC-01 AC-31
- [ ] `whatItRuns` entries render under the "Author's description" heading through `MarkdownBlock` — SPEC-01 AC-32a
- [ ] the scan of `runs.*` and `md.*` passes and fails on a planted "safe" — SPEC-01 AC-32b
- [ ] `runsLabels(p, 'runs')` equals the `card` labels in order and count; the badge shows on header and section exactly when `runsCode` — SPEC-01 AC-33 (unit)
- [ ] zero artifacts → the EC-4 sentence and no table — SPEC-01 EC-4
- [ ] a dependency with `inCatalog: false` is plain text marked "not in this marketplace"; one in the catalog is a link — SPEC-01 EC-5
- [ ] the AC-63 scan flags a planted `data-label="Kind"` and passes on the tree — Decision 8 (C-13)
- [ ] the hook command element has class `cmd-block` (geometry in U4) — SPEC-01 EC-3b

### U3 — Artifact page (Wave 3)
| Field | Value |
|---|---|
| Kind | ui |
| Skills | none |
| Module | root |
| Wave | 3 |
| Depends on | U1, U2 |
| Owns (create/modify) | `site/src/pages/ArtifactPage.tsx`; modify `site/src/App.tsx` (artifact route), `site/src/i18n/en.ts` (add `artifact`), `site/src/styles/pages.css` (artifact rules only); tests `site/test/app/artifact-page.test.tsx`, and extend `site/test/app/external-links.test.tsx` with both pages |
| Must not touch | `site/src/markdown/**`, `site/src/ui/WhatItRuns.tsx`, `site/src/router.ts`, `site/src/catalog/types.ts` |
| Consumes | §3.2, §3.3, §3.4 (`Collapsible`, `CommandBox`, `kindLabel`, `artifactHash`), §3.5 |
| Produces | `ArtifactPage` |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `ArtifactPage` (markup `Main.dc.html:366-430`, logic `:892-929`):
   - breadcrumb: plugin link › kind plural link `#/?kind=<kind>` › name (`aria-current`);
   - kind badge, user-only label, h1, description (omitted when `""`), invokeAs and argument hint;
   - shell badge per Decision 7;
   - the Facts `dl` per §3.5;
   - supporting files: one closed `Collapsible` each (title, path relative to the artifact folder), with `MarkdownBlock` and an "Open on GitHub" blob link;
   - body via `MarkdownBlock` for skill, agent and command, with no "excerpt" label; hook and MCP get no body section;
   - "All frontmatter": one row per key, array values one `- x` line each;
   - aside: "ships in <plugin>" link, the plugin's `installCommand` box, the source link (`sourceUrl`).
2. `App.tsx`: the artifact route renders `ArtifactPage`, or `NotFound` when the artifact is missing.

**Acceptance criteria**
- [ ] component on fixture-full, one artifact per kind present (skill, agent, command, hook, mcp): breadcrumb, badge, description, invokeAs, the §3.5 facts, install command, source link; supporting files are closed `details` with rendered Markdown; hook/MCP have no body — SPEC-01 AC-34a
- [ ] the "All frontmatter" row count equals `Object.keys(frontmatter).length` and values are verbatim — SPEC-01 AC-34b
- [ ] the Defined-in, file and source hrefs equal `blobUrl`; the plugin source equals `treeUrl` — SPEC-01 AC-35
- [ ] agent `tools: null` fact shows the AC-31 text; preloaded skills link only when in the catalog — SPEC-01 AC-31, Decision 10
- [ ] the shell badge shows for a skill whose id is in `shellArtifacts` and not for one outside it — Decision 7 (C-8)
- [ ] every cross-origin link on both pages has `rel` with `noopener` and `noreferrer` — SPEC-01 NFR-14 (M2 row, kept)

### U4 — E2E for plugin and artifact pages, noscript (Wave 4)
| Field | Value |
|---|---|
| Kind | e2e |
| Skills | none |
| Module | root |
| Wave | 4 |
| Depends on | U1–U3 |
| Owns (create/modify) | `site/test/e2e/plugin.spec.ts`, `site/test/e2e/artifact.spec.ts`, `site/test/e2e/noscript.spec.ts`; modify `site/test/e2e/helpers.ts` (add helpers only) |
| Must not touch | app source (report failures instead), `.github/workflows/site.yml` |
| Consumes | the built `dist/`, `catalog.json` |
| Produces | — |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` (e2e: NOT VERIFIABLE by the implementer; run in §7) |

**Steps**
1. `plugin.spec.ts`, for every plugin in `catalog.json`:
   - artifact link count = `artifactIds.length`;
   - hook rows and commands equal its hooks;
   - script rows and referencing hooks equal `runs.scripts`;
   - agent row count equals its agents;
   - Runs badge presence and reasons equal `runsLabels(p, 'runs')`;
   - the AC-30 sentence exactly when there are no hooks, MCP servers or scripts.

   Real cases:
   - django-reviewer: notices, homepage, dependencies, "agent with shell access", the AC-30 sentence;
   - spec-driven: What it runs, hooks, and `scripts/lib/*.mjs` shown as "not named in a hook command";
   - codebase-onboarding: no notices section.

   At 320 px, the longest hook command box has `scrollWidth > clientWidth`, and the page scroll width is ≤ the viewport. No request is made to a non-site origin, so no image is fetched.
2. `artifact.spec.ts`: one artifact per kind present. Assert the breadcrumb, facts and frontmatter row count = `Object.keys(frontmatter).length`. Every source href equals `<repoUrl>/blob/<commit>/<path>`.
3. `noscript.spec.ts`: a context with `javaScriptEnabled: false` shows the noscript message and the repository and README links.

**Acceptance criteria**
- [ ] e2e green on Chromium against `vite preview` — SPEC-01 AC-27a, AC-27b, AC-28, AC-29a, AC-29c, AC-29d, AC-30, AC-33
- [ ] e2e green — SPEC-01 AC-34a, AC-34b, AC-35, EC-3b
- [ ] no image or other foreign request on plugin pages with Markdown images — SPEC-01 EC-15a
- [ ] the noscript message and both links show with JS off — SPEC-01 EC-16

## 5. Waves
| Wave | Units | Runs | Why this order |
|---|---|---|---|
| 0 | U0 | sequential (orchestrator) | AST contract first |
| 1 | U1 | sequential | both pages render Markdown and source URLs |
| 2 | U2 | sequential | plugin page; produces `Collapsible`, `hash.ts`, M2 extensions |
| 3 | U3 | sequential | artifact page reuses U1 and U2 |
| 4 | U4 | sequential | e2e needs both pages |

Serialized files:
- `site/src/i18n/en.ts`: U1 (`md`), then U2 (`plugin`, `runs`), then U3 (`artifact`).
- `site/src/App.tsx`: U2, then U3.
- `site/index.html`: U1, then U2.
- `site/src/styles/pages.css`: U2 creates it, U3 extends it.
- `site/test/i18n.test.ts`: U2 only.
- `site/test/e2e/helpers.ts`: U4 only.
- No migrations, vendored folders, agent docs or `INSIGHTS.md` edits.

## 6. Test plan
| Module | Tests | Owner (unit) | Needs a running stack? |
|---|---|---|---|
| root | `test/markdown/parse`, `links`, `hostile` (time limits), `markdown-block` (jsdom); `test/app/source-url` | U1 | no |
| root | `test/app/plugin-page`, `what-it-runs` (generated fixture-full, 30 s), `runs`, `runs-keys`; `test/i18n.test.ts` (`data-label`) | U2 | no (needs git for the fixture repo) |
| root | `test/app/artifact-page`, `external-links` | U3 | no |
| root | `test/e2e/plugin`, `artifact`, `noscript` | U4 | yes: generated catalog, `vite build`, `vite preview` on port 4173, Chromium. The implementer reports NOT VERIFIABLE; §7 runs them |

## 7. Verification (orchestrator, after the last wave)
1. `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check`
2. `npm --prefix site run generate`, then `npm --prefix site run build`, then `node site/scripts/check-fixtures.mjs site/src/generated/catalog.json`
3. Free port 4173 (stop any process listening on it), then run `npm --prefix site run e2e`, which covers M2 and M3 specs. Its result is the evidence for every e2e row.
4. Measure the initial JS: `node -e "const z=require('zlib'),f=require('fs'),d='site/dist/assets/';for(const n of f.readdirSync(d))if(/^index-.*\.js$/.test(n))console.log(n,z.gzipSync(f.readFileSync(d+n)).length)"`. Report the result against 120 KB (NFR-1a; enforcing it is M5). Information only.
5. Pre-PR: work on `feature/catalog-site-m3` only and never commit to `main`. Commits and the PR body carry no Co-Authored-By or "Generated with" lines. The owner sees the diff before a PR is opened. No plugin is touched, so no plugin version is bumped.

## 8. Risks
- **Quadratic inline scanning** (the prototype's `[^\]]+` from each `[`): a hostile README hangs the page. Mitigation: linear scanner (U1 step 1) and the 1 MB hostile cases with time limits.
- **Allow-list bypass** through case, whitespace or control characters, or a relative path that escapes the repo: an XSS or an off-repo link. Mitigation: classify on the stripped probe, `new URL` resolution, a prefix check against `blobRoot`, and tests in every block type.
- **Spec–design drift** (C-1..C-13 resolutions differ from the prototype): rework after review. Mitigation: the owner confirmed every resolution at approval, and SF-4..SF-8 go to the spec owner.
- **Fixture-repo generation in component tests** is slow, or fails on Windows path or git config. Mitigation: reuse the M1 helper as `generate.test.mjs` does, with a 30 s timeout (M2 fix 597313e).
- **`en.ts` growth**: the AC-63 scan now also covers `data-label`. A missed literal fails `check`, by design.
- **Untrusted catalog text** (README, bodies, frontmatter values): text nodes only, the UT-3 lint ban unchanged, no `img` element anywhere.

## 9. Out of scope
- "Add to install set", the install-set store, the header count and the dependency closure (M4, Q2 b).
- The what's-new plugin filter behind "All changes for <plugin>" (M4, AC-43).
- AC-36/37 copy tests (M4).
- Heading deep links (non-goal).
- Size budgets and CI enforcement (M5).
- Generator, `types.ts`, router, search and `Card` changes.
- `site/prototype/**` (reference only).
- Full CommonMark (Decision 1).

### Spec follow-ups (owner: user / spec author)
- SF-4: Security profile `:410-412` says one "<kind> with shell access" label per `shellArtifacts` entry. AC-33 and the M2 owner decision Q2 b use one label per distinct kind. Align the text with Decision 5: per-kind badge labels, plus a line naming each entry.
- SF-5: the Pages table "Add to install set" (`:437`) is covered by AC-27a in M3 but is built in M4. Move it to M4's rows, or note the deferral.
- SF-6: EC-15a/EC-15b do not cover relative images. Add the U-2 rule: a link to the blob URL with the alt text.
- SF-7: AC-31 covers only `tools: null`. State `tools: []` → "none" and a null `model` → "not declared" (Decision 6).
- SF-8: AC-32b "every non-catalog text" leaves the embedded Markdown block's strings open. State that `md.*` keys fall under the same banned words (Decision 8).
