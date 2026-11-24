# Catalog site M4 (install set, what's new, old-name display, request link and issue form) — development plan

| Field | Value |
|---|---|
| Status | approved |
| Goal | A user builds an install set on `#/install` (or from a plugin page) and copies its CLI lines or the settings JSON. Dependencies are added and marked. The set is shared by `?p=` and kept in `localStorage`. The user reads `#/new` grouped by UTC day, with a plugin filter and old names as plain text. Every request link opens the new `plugin-request` issue form, prefilled. |
| Requirements source | `docs/specs/catalog-site.md` (SPEC-01, Status: approved `:4`), milestone M4 only (`:922`); design `site/prototype/` (README `:20`: the spec wins); the owner's M4 brief; the planner's Requirements review (findings 1–15) with the owner's answers Q1 a, Q2 a (C-1 made explicit), Q3 a, Q4 b, and Recommendations 1 (with the owner's input bound) and 2. Input only: this plan never edits them. |
| Execution mode | single-agent (sequential pass), chosen by the owner (Q4 b) |
| Modules touched | root |

## 1. Context
M1–M3 are merged.
- `#/install` and `#/new` render h1-only stand-ins (`site/src/pages/Placeholders.tsx:10-14`, `site/src/App.tsx:78`).
- The router parses `#/install?p=…` and `#/new?plugin=…` to routes without params (`site/src/router.ts:26-27`).
- The header "Install set" link has no count (`site/src/ui/Header.tsx:29`).

Already built, so M4 only adds the tests for them:
- copy, "Copied" for 2 s, select-on-failure and the hint, missing Clipboard API: `site/src/ui/CommandBox.tsx:12-40`. No clipboard test exists in `site/test`.
- request URL: `site/src/links/request-url.ts:1-4`, used in `Header.tsx:33`, `Footer.tsx:21` and `EmptyState.tsx:18`. Its test covers `&` and `=` (`site/test/app/request-url.test.ts:7-13`).
- recent changes with `<from> → <to>`: `site/src/pages/PluginPage.tsx:32-47`, `:183-194`.
- the theme half of EC-7 and UT-6: `Header.tsx:19-21`, `site/test/app/shell.test.tsx:35-41`, `site/test/app/theme-init.test.ts:13-19`.

Reused as is: catalog types (`site/src/catalog/types.ts`), `t()`/`en` (`site/src/i18n/en.ts:1-263`), `CommandBox` with `label` (`CommandBox.tsx:5`), `pluginHash` (`site/src/links/hash.ts`), `utcDay`/`shortSha` (`site/src/format.ts`), `cut` (`site/src/search/highlight.ts`), icons `plus check info warn list` (`site/src/ui/icons.ts:6-12`), `GhLink` (`site/src/ui/WhatItRuns.tsx`). The UT-3 lint ban is `site/eslint.config.js:20-31`; the AC-63 scan is `site/test/i18n.test.ts`.

Requirements: SPEC-01 M4 rows (`:922`). Pages table install set and what's new (`:440-443`), AC-36a..AC-46 (`:560-582`), AC-69 (`:580`), EC-6, EC-7, EC-12 (`:639-645`), UT-5, UT-6 (`:768-769`), client state (`:696-698`).

Design sources: `Main.dc.html:346-347` (plugin-page button), `:435-490` (install page), `:492-517` (what's new), `:776-797` and `:931-963` (their logic). Also `Components.dc.html:98-118` and `catalog.css:274-309`, `:376-377`.

Binding sources:
- There is no `AGENTS.md`/`CLAUDE.md` at the root or in `site/`, and there are no project skills.
- `INSIGHTS.md:8` (`t()` takes plain literals only; write `cond ? t('a') : t('b')`) applies to U2 and U3.
- Layout follows M2/M3. A new library folder goes in `src/install/` (like `src/search/`, `src/markdown/`), pages in `src/pages/`, components in `src/ui/`, styles in `src/styles/pages.css`, component tests in `test/app/`, e2e in `test/e2e/`. Node YAML tests follow `site/test/workflow.test.mjs:1-8`.

### Requirements review
- Findings 1–6 (C-1..C-6), 10, 11 and 13 were confirmed by the owner as written (Q2 a). C-1 is made explicit: ` --scope project` is appended to every CLI line, `marketplace add` included, only WHILE the scope switch is project; user scope adds no flag; both scopes are unit-tested.
- Finding 7: plugin page only (Q1 a). Cards and the artifact page are unchanged.
- Finding 8: issue form content per Q3 a (Decision 9).
- Finding 9: header count built here (Decision 6, SF-10).
- Findings 12, 14, 15: info; handled in U5, U1 and U6.
- **Recommendation 1: accepted**, with the owner's addition. The EC-6 notice is one line naming at most 5 names, each cut to 40 chars, then "and N more". `?p=` is bounded before parsing to its first 2 000 characters and at most 200 entries; the rest is ignored and counted into the same "and N more" (Decision 4).
- **Recommendation 2: accepted.** An issue-form YAML test (U5).

### Decisions
1. **Install-set library in `src/install/`** (§3.1, §3.2), with pure functions plus one store. Rejected: logic inside the page, because the header, the plugin page and the install page all need the same closure.
2. **Router unchanged.** Each page reads its own param from `location.hash` and writes it with `history.replaceState`, as `SearchPage.tsx:38` does. Rejected: params in `Route`. `routeId` (`App.tsx:39-46`) would change on every checkbox edit and move focus to `<main>`.
3. **Selection semantics (AC-41a..AC-41c).**
   - `#/install` with a `p` param (even an empty one) previews that selection in memory: the stored value stays unchanged and the header count shows the preview.
   - The preview lives only while `#/install` is mounted: leaving the page drops it (`clearPreview`), so the header count and the plugin-page button fall back to the stored selection, and a later edit elsewhere never persists a shared link the user did not edit (owner fix round).
   - The first edit, on any page, persists the edited selection.
   - The hash is written only while the route is `install` (`#/install`, or `#/install?p=<sorted names>`).
   - Scope is in memory only, defaults to `user`, and is not in the hash. An incoming `scope=` is ignored (C-2).
   - Storage is read on start and validated per UT-6. It is rewritten only on an edit.
4. **EC-6 notice (C-3, Recommendation 1 with the owner's addition).**
   - `parseP` reads `URLSearchParams.get('p')`, keeps its first 2 000 chars, splits on `,`, trims, drops empties and keeps the first 200 entries.
   - `ignored` = the entries after the 200th inside the kept 2 000 chars, plus 1 when the value was longer than 2 000 chars (the cut tail counts as one ignored entry). When the cut lands inside an entry (char 2 001 is not `,`), that partial last entry is dropped before the 200 cap and counted into the same +1, so a truncated name never matches a real plugin (owner fix round).
   - Names not in the catalog (stored or URL) are dropped.
   - When `dropped.length + ignored > 0`, `#/install` shows one `role="status"` notice of one sentence. It names the first 5 dropped names, each `cut(name, 40)`, as text nodes, then "and N more", where N = (dropped − shown) + ignored.
   - The notice disappears after the first edit, as in the design (`Main.dc.html:790`).
5. **Output built only from catalog data (finding 14).**
   - Names are matched exactly against `catalog.plugins[].name`.
   - CLI lines come from `marketplace.addCommand` and each plugin's `installCommand`. AC-39a's `claude plugin install <p>@<marketplace>` is the `installCommand` value, by the data model `:192`.
   - The JSON comes from `marketplace.name`, `marketplace.repo` and the plugin names, recursively key-sorted, 2-space indent (C-6).
   - The dependency closure keeps a visited set, so a cycle ends.
6. **Header count (finding 9)**: `Header` gets an optional `installCount` prop. When it is set, the link shows `.count-pill` (`on` when > 0) plus the sr-only `header.installCountSr`. App passes `resolveSet(catalog, selection).final.length` once the catalog is ready. Rejected: Header reading the store itself, because Header renders before the catalog.
7. **What's new (C-5, AC-42, AC-43, AC-69).**
   - Changes keep catalog order and are grouped by consecutive `utcDay(date)`.
   - `?plugin=<name>` filters when the name is a catalog plugin; otherwise all plugins are shown. A chip click writes `#/new?plugin=<name>`, or `#/new` for "All plugins".
   - `ChangeRow` moves from `PluginPage.tsx:32-47` to `src/ui/ChangeRow.tsx` with a `second` cell, `date` or `plugin`.
   - A plugin not in the catalog renders as `<span class="old">` with the name plus the `new.oldName` suffix from `en.ts`. There is no link and no CSS `content` (C-4).
8. **Multi-line outputs**: the two `CommandBox`es sit in `<div class="out-cmd">`. The CSS `.out-cmd .cmd-text { white-space: pre; line-height: 1.7 }` and `.out-cmd .cmd-text::before { content: none }` do the layout. `CommandBox` is unchanged. Labels: `install.cliLabel`, `install.jsonLabel`.
9. **Issue form (Q3 a)**: §3.3.
10. **Placeholders**: after U3 nothing imports `Placeholders.tsx`, so the orchestrator deletes it (U4). The keys `pages.installTitle` and `pages.newTitle` stay as the new h1s (`test/e2e/helpers.ts:26-27`, `shell.test.tsx:89`).
11. **Skills**: `none` for every unit (owner rule, as in M3 Decision 12). `spec-driven:untrusted-input-threats` is "Not for … implementation advice" by its description.

### Open questions
none

## 2. Affected modules
| Module | Touched? | Why / what changes | Rule that applies |
|---|---|---|---|
| root | yes | New: `site/src/install/**`, `site/src/pages/InstallPage.tsx` and `NewPage.tsx`, `site/src/ui/ChangeRow.tsx`, `.github/ISSUE_TEMPLATE/plugin-request.yml`. Edited: `App.tsx`, `Header.tsx`, `PluginPage.tsx`, `en.ts`, `pages.css`, `request-url.test.ts`. Deleted: `Placeholders.tsx`. Tests go under `site/test/install/`, `site/test/app/`, `site/test/e2e/`, plus `site/test/issue-form.test.mjs`. | spec `:131-133` (new code under `site/` plus "an issue form"); closest modules `site/src/search/`, `site/src/markdown/`, `site/test/workflow.test.mjs`; `INSIGHTS.md:8` |
| shared / duplicated contracts | no | There are no dependency or config changes. M1 `types.ts`, the M2 router / search / `request-url` / `CommandBox`, and M3 `hash.ts` / `source-url.ts` / `markdown/**` stay unchanged. | — |

## 3. Contracts

### 3.1 Install-set types (U0 writes `site/src/install/types.ts` verbatim)
```ts
export type Scope = 'user' | 'project';
export interface MissingDep { dep: string; version: string | null; forName: string } // AC-38b
export interface ResolvedSet {
  selected: string[];                  // input names that are catalog plugins; unique, sorted (code-unit order)
  final: string[];                     // selected ∪ transitive in-catalog dependencies; unique, sorted
  addedFor: Record<string, string[]>;  // auto-added name (not in selected) → sorted names whose dependency pulled it in
  missing: MissingDep[];               // deps with inCatalog false or not in catalog.plugins; walk order; unique per dep+forName
  dropped: string[];                   // input names not in the catalog; input order; unique
}
export interface ParsedP { names: string[]; ignored: number } // Decision 4
export const P_LIMITS = { chars: 2000, entries: 200 } as const;
export const NOTICE_LIMITS = { names: 5, nameChars: 40 } as const;
export const STORAGE_KEY = 'catalog.installSet';
```

### 3.2 Install-set functions and store (U1)
```ts
// site/src/install/resolve.ts — pure
export function resolveSet(c: Catalog, names: readonly string[]): ResolvedSet;
export function cliText(c: Catalog, final: readonly string[], scope: Scope): string;
//  [c.marketplace.addCommand, ...final.map((n) => plugin(n).installCommand)]
//    .map((l) => (scope === 'project' ? `${l} --scope project` : l)).join('\n')
export function settingsJson(c: Catalog, final: readonly string[]): string;
//  JSON.stringify(sortKeys({ enabledPlugins: { [`${n}@${c.marketplace.name}`]: true, … },
//    extraKnownMarketplaces: { [c.marketplace.name]: { source: { source: 'github', repo: c.marketplace.repo } } } }), null, 2)
// site/src/install/link.ts — pure
export function parseP(hash: string): ParsedP | null;        // null = no `p` param in the hash query
export function installHash(selected: readonly string[]): string; // '#/install' | '#/install?p=' + sorted.map(encodeURIComponent).join(',')
// site/src/install/store.ts
export function readStored(storage: Pick<Storage, 'getItem'> | null): string[]; // UT-6: not a JSON array of strings, or throws → []
export interface InstallStore {
  get(): string[];                 // preview ?? in-memory edit ?? readStored(...)
  edit(next: readonly string[]): void; // clears preview; writes STORAGE_KEY; IF setItem throws THEN keep in memory, no error (EC-7)
  preview(names: readonly string[]): void; // AC-41c: in memory only, storage untouched
  clearPreview(): void;            // drop the preview only (storage untouched); InstallPage calls it on unmount
  reset(): void;                   // drop preview and memory, re-read storage (tests)
  subscribe(fn: () => void): () => void;
}
export function createInstallStore(storage: () => Storage | null): InstallStore; // storage() may throw → treated as null
export const installStore: InstallStore;            // createInstallStore(() => window.localStorage)
export function useInstallSelection(): string[];   // useSyncExternalStore(installStore.subscribe, installStore.get)
```
`get()` must return the same array reference until a change (a `useSyncExternalStore` requirement).

### 3.3 Issue form (U5 writes `.github/ISSUE_TEMPLATE/plugin-request.yml`)
```yaml
name: Plugin request
description: Ask for a skill, agent, command, hook, MCP server or plugin the catalog does not have.
labels: [plugin-request]
body:
  - type: markdown
    attributes: { value: "Do not include secrets, tokens, passwords or private code." }
  - type: input
    id: what
    attributes: { label: What do you need?, description: The task or tool you looked for. }
    validations: { required: true }
  - type: textarea
    id: use-case
    attributes: { label: Use case, description: What you want to do with it. }
  - type: dropdown
    id: kind
    attributes: { label: Kind, options: [Skill, Agent, Command, Hook, MCP server, Plugin, Not sure] }
```
The `title` field is prefilled by the URL (`request-url.ts:3`).

### 3.4 Pages, components and i18n groups
```ts
export function InstallPage({ catalog }: { catalog: Catalog }): JSX.Element;          // U2
export function NewPage({ catalog }: { catalog: Catalog }): JSX.Element;              // U3
export function ChangeRow({ c, catalog, second }: { c: Change; catalog: Catalog; second: 'date' | 'plugin' }): JSX.Element; // U3
// Header: new optional prop `installCount?: number` (U2)
```
New `en` groups: `install` (U2) and `new` (U3). New keys in the existing `header` (U2) and `plugin` (U2: `addToSet`, `inSetRemove`, `addedAsDep`, `openSet`) groups.

## 4. Work units

### U0 — Install-set types (Wave 0)
| Field | Value |
|---|---|
| Kind | orchestrator |
| Skills | — |
| Module | root |
| Wave | 0 |
| Depends on | none |
| Owns (create/modify) | `site/src/install/types.ts` (create) |
| Must not touch | everything else |
| Consumes | — |
| Produces | §3.1 |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. Write §3.1 verbatim. No dependency, config change or move is needed.

**Acceptance criteria**
- [ ] `npm --prefix site run check` passes with the new file — contract for SPEC-01 AC-38a, AC-39a, AC-40, UT-6

### U1 — Install-set library and store (Wave 1)
| Field | Value |
|---|---|
| Kind | library |
| Skills | none |
| Module | root |
| Wave | 1 |
| Depends on | U0 |
| Owns (create/modify) | `site/src/install/resolve.ts`, `link.ts`, `store.ts`; tests `site/test/install/resolve.test.ts`, `link.test.ts`, `store.test.ts` |
| Must not touch | `site/src/install/types.ts`, `site/src/router.ts`, `site/src/catalog/types.ts`, any `.tsx` |
| Consumes | §3.1 |
| Produces | §3.2 |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `resolve.ts` per §3.2 and Decision 5. Use a breadth-first walk with a visited set. A name in `selected` is never in `addedFor`. Sort with code-unit compare, as `PluginPage.tsx:17` does.
2. `link.ts`: `parseP` per Decision 4. Split the path and query like `router.ts:13-15`. `installHash` per §3.2.
3. `store.ts` per §3.2. Every storage call is wrapped in `try`. Notify subscribers on `edit`, `preview` and `reset`.
4. Tests build fixtures with `site/test/search/fixture-catalog.ts:7-28` (`plugin(name, { dependencies, installCommand })`, `catalogOf`).

**Acceptance criteria**
- [ ] chain A → B → C: `final` = [A, B, C]; `addedFor` = { B: [A], C: [B] }; a cycle A ↔ B ends with [A, B]; an explicitly selected dependency is not in `addedFor` — SPEC-01 AC-38a (unit)
- [ ] a dependency with `inCatalog: false` yields one `MissingDep` with its name, version and `forName` and is not in `final` — SPEC-01 AC-38b (unit)
- [ ] `cliText` user scope: snapshot of `addCommand` then one `installCommand` line per `final` name, sorted, with no flag on any line — SPEC-01 AC-39a
- [ ] `cliText` project scope: every line, `addCommand` included, ends with ` --scope project`; user scope has no line with `--scope` — SPEC-01 AC-39b (owner's C-1 wording)
- [ ] `JSON.parse(settingsJson(...))` deep-equals the AC-40 form, and the text equals `JSON.stringify` of the recursively sorted object with 2-space indent — SPEC-01 AC-40
- [ ] `installHash(['b','a'])` = `#/install?p=a,b`; `installHash([])` = `#/install` — SPEC-01 AC-41b (unit)
- [ ] `parseP`: no `p` → null; `p=` → `{names: [], ignored: 0}`; 1 000 bogus names → 200 names and the rest counted in `ignored`; a 5 000-char value → names read only from the first 2 000 chars, with the tail counted once — SPEC-01 EC-6, UT-4 (Recommendation 1, owner's addition)
- [ ] `resolveSet` with `['ghost', 'a', 'ghost']` → `dropped: ['ghost']`, `selected: ['a']` — SPEC-01 EC-6 (unit)
- [ ] `readStored` returns `[]` for `null`, `'x'`, `'{}'`, `'[1]'`, `'["a",2]'` and a throwing `getItem`, and the array for `'["a"]'` — SPEC-01 UT-6
- [ ] `preview` leaves `STORAGE_KEY` unchanged; `edit` writes it as a JSON array — SPEC-01 AC-41a, AC-41c (unit)
- [ ] with throwing `getItem`/`setItem`, `edit` keeps the selection in `get()` and throws nothing — SPEC-01 EC-7 (unit)

### U2 — Install page, header count, plugin-page button (Wave 2)
| Field | Value |
|---|---|
| Kind | ui |
| Skills | none |
| Module | root |
| Wave | 2 |
| Depends on | U1 |
| Owns (create/modify) | `site/src/pages/InstallPage.tsx`; modify `site/src/App.tsx` (install route, header count), `site/src/ui/Header.tsx` (`installCount`), `site/src/pages/PluginPage.tsx` (set button in the install aside only), `site/src/i18n/en.ts` (add `install`; keys in `header`, `plugin`), `site/src/styles/pages.css` (install rules); tests `site/test/app/install-page.test.tsx`, extend `site/test/app/plugin-page.test.tsx` |
| Must not touch | `site/src/install/**` (report a needed change as `BLOCKED:`), `site/src/ui/CommandBox.tsx`, `site/src/ui/Card.tsx`, `site/src/pages/ArtifactPage.tsx`, `site/src/router.ts`, `site/eslint.config.js` |
| Consumes | §3.1, §3.2 |
| Produces | `InstallPage`, `Header` `installCount` |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `InstallPage` (markup `Main.dc.html:435-490`, logic `:931-950`).
   - On mount and on `hashchange` while the route is install: `parseP(location.hash)`. When it is not null, call `installStore.preview(names)` and keep `ignored`.
   - Notice per Decision 4, cleared after the first edit.
   - One `notice warn` per `missing` entry (AC-38b). The version is omitted when null.
   - `ul.cb-list`: one row per catalog plugin, sorted. The checkbox is checked when the plugin is in `final`. It is disabled for auto-added rows, which show `auto-label` "added for {names}". The row also has `cat-label`, a "Runs code" mark when `runs.runsCode`, and a "Details" link (`pluginHash`).
   - A toggle calls `installStore.edit(...)` on `selected` ± the name, then `history.replaceState(null, '', installHash(next))`.
   - Scope `.seg` with User / Project (`aria-pressed`), held in local state, plus the scope help text. Settings path: `~/.claude/settings.json` for user, `.claude/settings.json` for project, as in the design.
   - Empty state when `final` is empty. Otherwise `.out-grid` with two `CommandBox`es in `.out-cmd` (Decision 8), the line count, and the share link `installHash(selected)`.
2. `PluginPage` aside, after the install boxes (`Main.dc.html:346-347`, `:886-888`):
   - The button shows `aria-pressed` = explicitly selected, and the label `plugin.inSetRemove` / `plugin.addedAsDep` / `plugin.addToSet`. A click toggles the plugin with `installStore.edit`.
   - The `plugin.openSet` link (count = `final.length`) shows when the plugin is in `final`.
   - Nothing else on the page changes.
3. `Header`: Decision 6. `App` reads `useInstallSelection()` and passes `installCount` when the catalog is ready. The install route renders `InstallPage`.
4. `pages.css`: port `catalog.css:295` (checkbox), `:298` (auto-label), `:299-303` (`.seg`, `.out-grid`), `:309` (`notice.info`), `:376-377` (mobile), plus Decision 8. Use tokens only.
5. Strings follow `INSIGHTS.md:8`. The CLI and JSON text are not JSX literals; they come from §3.2.

**Acceptance criteria**
- [ ] on fixture A → B → C, ticking A checks B and C, marked "added for A" and "added for B", and the header pill shows 3 — SPEC-01 AC-38a (component)
- [ ] a fixture dependency not in the catalog shows a warning naming it — SPEC-01 AC-38b
- [ ] the CLI box text equals `cliText(...)` for both scope buttons; only Project adds ` --scope project` — SPEC-01 AC-39a, AC-39b (component)
- [ ] the settings box text equals `settingsJson(...)` — SPEC-01 AC-40 (component)
- [ ] a checkbox edit writes `catalog.installSet` and replaces the hash with `installHash(selected)`; the plugin-page button edit writes storage and leaves the hash unchanged — SPEC-01 AC-41a, AC-41b (component)
- [ ] `#/install?p=b` with a stored `["a"]` shows b checked and storage still `["a"]` until a tick — SPEC-01 AC-41c, AC-41a (component)
- [ ] `#/install?p=a,ghost` shows one status line naming "ghost"; 1 000 bogus names show one line with 5 names, each ≤ 40 chars, and "and N more" with the right N; a stored `["ghost"]` shows the same notice — SPEC-01 EC-6 (Recommendation 1)
- [ ] with `Storage.prototype.getItem` and `setItem` throwing, ticking works, the selection survives a re-render, and no error/alert renders — SPEC-01 EC-7 (component)
- [ ] the plugin-page button cycles through its three labels and `aria-pressed`, per Pages table `:437` — SF-5 (component)
- [ ] the AC-63 scan (`site/test/i18n.test.ts`) passes on the new files — SPEC-01 AC-63 (M2 row, kept)

### U3 — What's new page and old-name display (Wave 3)
| Field | Value |
|---|---|
| Kind | ui |
| Skills | none |
| Module | root |
| Wave | 3 |
| Depends on | U2 (shared `App.tsx`, `en.ts`, `pages.css`) |
| Owns (create/modify) | `site/src/pages/NewPage.tsx`, `site/src/ui/ChangeRow.tsx`; modify `site/src/pages/PluginPage.tsx` (replace the local `ChangeRow` with the import, `second="date"`), `site/src/App.tsx` (new route; remove the `Placeholder` import and branch), `site/src/i18n/en.ts` (add `new`), `site/src/styles/pages.css` (`.day-h`, `.chg .old`, new-page rules); tests `site/test/app/new-page.test.tsx` |
| Must not touch | `site/src/pages/Placeholders.tsx` (U4 deletes it), `site/src/install/**`, `site/src/router.ts`, `site/src/catalog/types.ts` |
| Consumes | §3.4 `ChangeRow`; `pluginHash`, `utcDay`, `shortSha`, `GhLink` |
| Produces | `NewPage`, `ChangeRow` |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `ChangeRow`: move `PluginPage.tsx:32-47` as is. `second` is `date` (the `time` element) or `plugin`. For `plugin`, a catalog plugin is a link (`pluginHash`); any other name is `<span class="old">{name}<span>{t('new.oldName')}</span></span>` (Decision 7). The subject is a text node.
2. `NewPage` (markup `Main.dc.html:492-517`, logic `:951-963`, Decision 7):
   - h1 `pages.newTitle` and the lead.
   - The chip group "All plugins" plus catalog plugins sorted, each with its count, `aria-pressed`, and the hash written on click.
   - The count line `role="status"` (`{n} changes on {d} days`, plural keys).
   - One `section` per day with `h2.day-h > time[datetime]` and `ol.chg-list` of `ChangeRow second="plugin"`.
3. `App`: the new route renders `NewPage`. After this, `Placeholder` is unused.
4. `pages.css`: port `catalog.css:279` and `:286-287`, without `:280` (C-4).
5. Strings follow `INSIGHTS.md:8`.

**Acceptance criteria**
- [ ] fixture changes across 3 UTC days (one at `T23:30-02:00`) render 3 day groups in catalog order, newest first; each row has a type badge (added, `from → to`, change), plugin, subject as text and a commit link to `c.url` — SPEC-01 AC-42 (component)
- [ ] `?plugin=a` and a chip click show only the changes with `plugin === 'a'`; `?plugin=ghost` shows all — SPEC-01 AC-43 (component)
- [ ] a Change with `plugin: "spec-creator"` (not in the catalog) renders the name as text with no `a` element, plus the `new.oldName` suffix — SPEC-01 AC-69
- [ ] the plugin page still shows recent changes with `<from> → <to>` through the moved `ChangeRow` (existing `plugin-page.test.tsx` passes unchanged) — SPEC-01 AC-44 (component)
- [ ] a subject `<img src=x onerror=1>` renders as text with no `img` element — SPEC-01 UT-3 (M2 row, kept)

### U4 — Delete the placeholder (Wave 4)
| Field | Value |
|---|---|
| Kind | orchestrator |
| Skills | — |
| Module | root |
| Wave | 4 |
| Depends on | U3 |
| Owns (create/modify) | `site/src/pages/Placeholders.tsx` (delete) |
| Must not touch | everything else |
| Consumes | — |
| Produces | — |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. Grep `site/src` and `site/test` for `Placeholder`; expect no import. Then delete the file (Decision 10).

**Acceptance criteria**
- [ ] check passes with the file gone — Decision 10

### U5 — Issue form, copy tests, request-link tests (Wave 5)
| Field | Value |
|---|---|
| Kind | ui |
| Skills | none |
| Module | root |
| Wave | 5 |
| Depends on | U4 |
| Owns (create/modify) | `.github/ISSUE_TEMPLATE/plugin-request.yml` (create); tests `site/test/issue-form.test.mjs`, `site/test/app/command-box.test.tsx`; modify `site/test/app/request-url.test.ts` (add cases) |
| Must not touch | `site/src/**` (report a failing behaviour instead), `.github/workflows/**`, `docs/specs/**` |
| Consumes | §3.3; `CommandBox`, `requestUrl` |
| Produces | the issue form |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. Write §3.3 as block YAML (the same content).
2. `issue-form.test.mjs` (pattern `site/test/workflow.test.mjs:1-8`):
   - The body ids are exactly `what`, `use-case`, `kind`; `what` has `validations.required: true`; `labels` is `[plugin-request]`.
   - Every non-markdown item's `label`, `description`, `placeholder` and `options` fail to match `/secret|token|password|credential|api key/i`.
   - The markdown intro equals the §3.3 sentence.
3. `command-box.test.tsx` (jsdom, `vi.useFakeTimers`):
   - A stubbed `navigator.clipboard.writeText` receives the exact text.
   - "Copied" shows, is still there at 1 999 ms and is gone at 2 000 ms.
   - A rejected write selects the code element's contents and shows the hint.
   - With `navigator.clipboard` undefined, the result is the same.
4. `request-url.test.ts`: the query `a#b?c=d&e` keeps one `title` and one `what` equal to the query, and the raw URL contains `%23`, `%3F`, `%3D` and `%26`.

**Acceptance criteria**
- [ ] the issue-form test passes; the form has `what` (required), `use-case` and `kind` — SPEC-01 AC-46 (Recommendation 2)
- [ ] `writeText` gets the exact shown text — SPEC-01 AC-36a (component; e2e in U6)
- [ ] "Copied" shows for 2 s on fake timers — SPEC-01 AC-36b
- [ ] a rejected write selects the command text — SPEC-01 AC-37a
- [ ] a rejected write shows the "press Ctrl/Cmd+C" hint — SPEC-01 AC-37b
- [ ] with no Clipboard API, both the AC-37a and AC-37b behaviours show — SPEC-01 EC-12
- [ ] `&`, `=`, `#` and `?` are percent-encoded and the query stays one `title` value — SPEC-01 UT-5
- [ ] the URL is `<repoUrl>/issues/new?template=plugin-request.yml` with `title` and `what` = the first 200 chars (existing tests kept) — SPEC-01 AC-45 (unit)

### U6 — E2E for install set, what's new, request links, copy (Wave 6)
| Field | Value |
|---|---|
| Kind | e2e |
| Skills | none |
| Module | root |
| Wave | 6 |
| Depends on | U1–U5 |
| Owns (create/modify) | `site/test/e2e/install.spec.ts`, `site/test/e2e/new.spec.ts`, `site/test/e2e/request.spec.ts`; modify `site/test/e2e/helpers.ts` (add helpers only) |
| Must not touch | app source (report failures instead), `.github/workflows/site.yml`, the existing e2e specs |
| Consumes | the built `dist/`, `src/generated/catalog.json` (`helpers.ts:8`) |
| Produces | — |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` (e2e: NOT VERIFIABLE by the implementer; run in §7) |

**Steps**
1. `install.spec.ts`. Expectations come from `catalog.json`, with no hard-coded counts.
   - For each plugin with dependencies: tick it. The checked set equals the plugin plus the transitive `inCatalog: true` closure, each marked "added for …". The CLI text equals `cliText` for both scopes.
   - Reload keeps the selection (AC-41a).
   - With a stored set, opening `#/install?p=<other>` shows `<other>` and leaves `localStorage` unchanged until a tick (AC-41a, AC-41c).
   - A tick writes `#/install?p=` (AC-41b).
   - `?p=<real>,ghost` shows one notice naming ghost (EC-6).
   - With clipboard permissions, the CLI and card copy buttons write the shown text (`navigator.clipboard.readText`, AC-36a).
   - The plugin-page "Add to install set" button raises the header count.
2. `new.spec.ts`:
   - `#/new` day headings equal the distinct `utcDay` of `catalog.changes` in order, and the row count equals `changes.length` (AC-42).
   - A chip click filters to that plugin (AC-43).
   - Every `spec-creator` row is text with no link (AC-69).
   - spec-driven's page shows its `recentChanges`, with version rows written `<from> → <to>` (AC-44).
3. `request.spec.ts`: the header, footer and empty-state request hrefs equal `requestUrl(repoUrl, query)` for the empty query and for a typed nonsense query (AC-45, UT-5).

**Acceptance criteria**
- [ ] e2e green on Chromium against `vite preview` — SPEC-01 AC-36a, AC-38a, AC-39a, AC-39b, AC-41a, AC-41b, AC-41c, EC-6
- [ ] e2e green — SPEC-01 AC-42, AC-43, AC-44, AC-69
- [ ] e2e green — SPEC-01 AC-45, UT-5

## 5. Waves (execution order)
| Wave | Units | Runs | Why this order |
|---|---|---|---|
| 0 | U0 | sequential (orchestrator) | install types first |
| 1 | U1 | sequential | pure library and store for U2 |
| 2 | U2 | sequential | install page, header count, plugin-page button |
| 3 | U3 | sequential | what's new; rewires `App`, freeing `Placeholders.tsx` |
| 4 | U4 | sequential (orchestrator) | delete after nothing imports it |
| 5 | U5 | sequential | issue form and tests on existing code |
| 6 | U6 | sequential | e2e needs every page |

Serialized files:
- `site/src/i18n/en.ts`: U2, then U3.
- `site/src/App.tsx`: U2, then U3.
- `site/src/styles/pages.css`: U2, then U3.
- `site/src/pages/PluginPage.tsx`: U2 (button), then U3 (`ChangeRow` import).
- `site/test/e2e/helpers.ts`: U6 only.
- No migrations, vendored folders, agent docs or `INSIGHTS.md` edits.

## 6. Test plan
| Module | Tests | Owner (unit) | Needs a running stack? |
|---|---|---|---|
| root | `test/install/resolve`, `link`, `store` (unit) | U1 | no |
| root | `test/app/install-page` (jsdom, App + fixture catalog), extended `plugin-page`; `test/i18n.test.ts` unchanged | U2 | no |
| root | `test/app/new-page` (jsdom) | U3 | no |
| root | `test/issue-form.test.mjs` (yaml), `test/app/command-box` (fake timers), `test/app/request-url` | U5 | no |
| root | `test/e2e/install`, `new`, `request` | U6 | yes: generated catalog, `vite build`, `vite preview` on port 4173, Chromium with clipboard permissions. The implementer reports NOT VERIFIABLE; §7 runs them. |

## 7. Verification (orchestrator, after the last wave)
1. `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check`
2. `npm --prefix site run generate`, then `npm --prefix site run build`, then `node site/scripts/check-fixtures.mjs site/src/generated/catalog.json`.
3. Free port 4173 (stop any process listening on it). Then run `npm --prefix site run e2e -- --repeat-each=3`, which covers the M2, M3 and M4 specs. All runs must be green before reporting.
4. Manual items stay for M5 sign-off (M-3: paste the CLI lines and the settings snippet into a scratch project; open one prefilled request link). The owner creates the `plugin-request` label before merge (spec `:785-786`).
5. Pre-PR:
   - Work on `feature/catalog-site-m4` only, never commit to `main`.
   - Commits and the PR body carry no Co-Authored-By or "Generated with" lines.
   - The owner sees the diff before a PR is opened.
   - No plugin is touched, so no plugin version is bumped.

## 8. Risks
- **Untrusted `?p=` and storage** (oversized, unknown or hostile names) could flood the notice or reach the output text. Mitigation:
  - Bounds before parsing (Decision 4).
  - Exact catalog-name matching.
  - CLI and JSON built only from catalog fields (Decision 5).
  - Text nodes only, with the UT-3 lint ban unchanged.
  - Tests with 1 000 bogus names and with `<img>` names.
- **`useSyncExternalStore` loop**: a `get()` that returns a new array on each call causes an infinite render. Mitigation: the §3.2 reference rule plus a store test that `get()` is stable.
- **Focus jumps on edits**: a hash write through `location.hash` would fire `hashchange` and move focus (`App.tsx:42-46`). Mitigation: `replaceState` only (Decision 2).
- **`ChangeRow` move breaks the plugin page**. Mitigation: the existing `plugin-page.test.tsx` and M3 `plugin.spec.ts` must pass unchanged.
- **AC-63 scan failures** from ternaries inside `t()` (`INSIGHTS.md:8`). Mitigation: the rule is cited in U2 and U3.
- **Clipboard e2e flakiness** on permissions. Mitigation: grant `clipboard-read`/`clipboard-write` on the context, plus `--repeat-each=3`.
- **Spec–design drift** (C-1..C-6). The owner confirmed every resolution; the spec follow-ups below go to the spec owner.

## 9. Out of scope
- "Add to install set" on cards and artifact pages (Q1 a).
- Persisting the scope, or a `scope` hash param (C-2).
- Bounds on the stored selection beyond UT-6 (the owner bounded `?p=` only).
- Size budgets, axe matrix, keyboard-only NFR-7d e2e, deploy and docs (M5).
- Router, `types.ts`, generator, search, `Card`, `CommandBox` and Markdown changes.
- `site/prototype/**` (reference only).

### Spec follow-ups (owner: user / spec author)
- SF-10: the header "Install set (n)" (Pages table `:443`) has no AC or milestone row. Add one: n = the selected plugins plus their in-catalog dependencies (Decision 6).
- SF-11: "Add to install set" on the plugin page (`:437`, SF-5) is built in M4 with no AC. Add an AC for its three states, or note it under AC-38a.
- SF-12: EC-6 (`:639`). State the notice bound (at most 5 names, each cut to 40 chars, then "and N more"). State the `?p=` input bound (the first 2 000 characters, at most 200 entries; the rest ignored and counted into "and N more"), mirroring EC-2a. State that the notice applies to stored and URL selections.
- SF-13: AC-46 (`:582`). State the form content of §3.3: field types, the `kind` options, the `plugin-request` label and the no-secrets intro.
- SF-14: Pages table `:440` hard-codes `@humen-dev`; AC-39a uses `<marketplace>`. Align on `<marketplace>`.
- SF-15: the Routes table (`:141-142`) lacks `#/new?plugin=<name>`, which M3 links to (`PluginPage.tsx:192`) and AC-43 uses. Add it, with unknown values ignored.
- SF-16: AC-69 (`:580`). State the "(old name)" suffix shown after a plain-text plugin name, or drop it from the design.
- SF-17: Pages table `:440`. State that the scope switch is not persisted and defaults to user (C-2).
- SF-18: `.github/workflows/site.yml` path filters do not include `.github/ISSUE_TEMPLATE/**`, so a PR that changes only `plugin-request.yml` never runs `site/test/issue-form.test.mjs`. AC-53a fixes the five paths, so M4 does not add it; the spec should decide whether AC-53a gains this path.
