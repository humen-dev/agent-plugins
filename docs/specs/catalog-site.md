# Spec: Marketplace catalog site

Spec ID: SPEC-01
Status: draft
Created: 2026-11-23
Approved: none
Modules: root
System names: the generator (Node script that builds the catalog from the repo) · the site (static browser app on GitHub Pages) · the pipeline (the "Site" GitHub Actions workflow that tests, builds and deploys) · the repository (docs, manifests and config files this work changes)
Supersedes: none
Superseded by: none

## Problem and user

The `humen-dev` marketplace (`.claude-plugin/marketplace.json`) lists 8 plugins
with 12 skills, 6 agents and 2 hooks. The only way to find what exists today is
to read `README.md:52` (a plugin table) or browse `plugins/*/` on GitHub. Nobody
can ask "is there a skill for safe migrations?" and get an answer. Nobody can see
what a plugin executes before installing it, short of reading `hooks/hooks.json`
and the scripts. Nobody can get the install commands for a set of plugins in
one step.

Users:

- **Plugin user**: a developer who wants a skill or agent for a task, wants to
  know what it runs on their machine, and wants to install it.
- **Team lead**: wants one snippet that enables a set of plugins for a whole
  project.
- **Contributor or maintainer**: wants a new or changed plugin to appear on the
  site with no manual step, and wants a broken plugin to fail CI instead of
  breaking the site.

## Goals / Non-goals

**Goals**

| ID | Goal | Success measure |
|---|---|---|
| G-1 | Find any plugin or artifact by a free-text task description | every golden query in AC-14 returns its expected item in the top 3 |
| G-2 | Know what a plugin runs before installing it | every hook, MCP server, script and agent tool list in the repo appears on its plugin page, copied from files (AC-29a..AC-33) |
| G-3 | Install one plugin or a set of plugins in one copy | copy buttons produce commands and a settings snippet that `claude` accepts (AC-36a..AC-41c, manual check M-3) |
| G-4 | Zero manual steps to publish | a merged PR that adds a plugin is live on the site with no other action (AC-52) |
| G-5 | Only real data in production | the production catalog has exactly the plugins in `marketplace.json`, and no fixture data (AC-6a, AC-7a, AC-7b) |

**Non-goals**

- Accounts, ratings, comments, analytics, server-side search or any backend.
- Installing plugins from the browser. The site only shows commands to copy.
- Showing plugins from other marketplaces.
- Stats page, plugin scaffolding, and SKILL.md validation in the browser
  (deferred, P2).
- Deep links to headings inside a page.
- Localisation into other languages. All UI strings sit in one file so it is
  possible later (AC-63).
- A custom domain.
- SEO-oriented per-route static HTML. Hash routes are accepted.
- Automated tests on browsers other than Chromium.

## User stories

- **US-1** (search, P0): As a plugin user, I want to type a task in plain words
  and see matching plugins, skills, agents, commands, hooks and MCP servers, so
  that I find the right tool without knowing its name.
- **US-2** (filters, P0): As a plugin user, I want to narrow results by kind and
  category, so that I see only skills, or only backend items.
- **US-3** (plugin page, P0): As a plugin user, I want one page per plugin with
  what it adds, version, author, license, notices, last update and recent
  changes, so that I can judge it.
- **US-4** (artifact page, P0): As a plugin user, I want to read a skill's or
  agent's full instructions and settings, so that I know what it will make
  Claude do.
- **US-5** (what it runs, P0): As a plugin user, I want to see every hook
  command, MCP server, script and agent tool permission a plugin ships, so that
  I know what runs on my machine before I install.
- **US-6** (install, P0): As a plugin user, I want a copy-ready install command
  on every card and page, so that installing takes one paste.
- **US-7** (install set, P1): As a team lead, I want to pick several plugins
  and copy either CLI commands or a project `.claude/settings.json` snippet,
  with dependencies included, so that my team gets the same set.
- **US-8** (what's new, P1): As a plugin user, I want a feed of added plugins,
  version bumps and changes from git history, so that I notice updates.
- **US-9** (request, P1): As a plugin user who found nothing, I want a
  prefilled GitHub issue link, so that I can ask for the missing skill in one
  click.
- **US-10** (auto publish, P0): As a maintainer, I want every push to `main`
  that touches plugins or manifests to rebuild and redeploy the site, so that
  the catalog is never stale.
- **US-11** (theme, P0): As any user, I want a dark theme by default and a
  light theme toggle that is remembered, so that the site is comfortable to read.

## Architecture

```mermaid
flowchart LR
  subgraph repo[Repository at commit SHA]
    M[.claude-plugin/marketplace.json]
    P[plugins/*/ plugin.json, SKILL.md, agents, commands, hooks.json, .mcp.json, README, notices, scripts]
    V[scripts/validate-marketplace.mjs]
    G[(git history)]
  end
  subgraph actions[GitHub Actions: the pipeline, workflow "Site"]
    T["Site: tests"]
    B["Site: build: generator → catalog.json → vite build → budgets"]
    D["Site: deploy (main only)"]
    T --> D
    B --> D
  end
  M --> B
  P --> B
  V --> B
  G --> B
  D --> PAGES[humen-dev.github.io/agent-plugins/]
  PAGES --> BR[Browser: the site loads index.html, JS, catalog.json]
```

- **The generator** runs only at build time, in the pipeline (and locally for
  development). Its first step runs `scripts/validate-marketplace.mjs`, and it
  fails only on that validator's errors. It then reads the checkout and git
  history and writes one `catalog.json`. Every other problem it finds becomes
  a warning in `diagnostics`. It is the only component that reads the
  repository.
- **The site** is a Vite + React + TypeScript single-page app with hash
  routing. It fetches `catalog.json` from its own origin. It builds the search
  index in memory (MiniSearch) and renders every page from that one file. It
  never calls the GitHub API or reads repository files.
- **The pipeline** is one new workflow, "Site", with three jobs that show as
  separate checks: "Site: tests", "Site: build" and "Site: deploy" (see
  CI/CD). On a pull request only tests and build run. On a push to `main`,
  deploy also runs.
- **Code location**: everything new sits under `site/` (app, generator, tests,
  fixtures, its own `package.json` and lockfile), plus the new workflow and an
  issue form. Two existing files change: `marketplace.json` gets a `renames`
  entry (AC-73), and the docs change (AC-57a..AC-58b).
- **Routes** (hash):

  | Route | Page |
  |---|---|
  | `#/` with optional `?q=&kind=&cat=` | search (home) |
  | `#/plugins/<plugin>` | plugin page |
  | `#/plugins/<plugin>/<kind>/<name>` | artifact page |
  | `#/install` with optional `?p=a,b` | install-set builder |
  | `#/new` | what's new |
  | anything else | not-found state |

## Catalog data model

The generator emits this shape. The site imports the same type definitions.

```ts
type Kind = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
type ArtifactKind = Exclude<Kind, 'plugin'>;

/** Raw Markdown plus its repo path. The site renders it safely (UT-1..UT-3). */
interface Markdown { path: string; source: string; }

interface Person { name: string; url: string | null; } // e-mail is never copied

interface Catalog {
  schemaVersion: 1;
  marketplace: {
    name: string;              // "humen-dev"
    description: string;
    version: string | null;    // metadata.version
    owner: string;             // owner.name
    repo: string;              // "humen-dev/agent-plugins", from GITHUB_REPOSITORY, or a flag locally
    repoUrl: string;           // https://github.com/<repo>
    addCommand: string;        // "claude plugin marketplace add <repo>"
  };
  build: { commit: string; commitDate: string }; // HEAD sha and its committer date (ISO 8601)
  categories: string[];        // distinct marketplace categories, sorted
  kinds: Kind[];               // kinds with at least one item, in Kind order
  plugins: Plugin[];           // sorted by name
  artifacts: Artifact[];       // sorted by id
  changes: Change[];           // newest first, at most 100
  diagnostics: Diagnostic[];   // warnings only, sorted by path then message
}

/** A source problem that is not a validator error. It never fails the build (AC-65a..AC-65d). */
interface Diagnostic { level: 'warning'; path: string; message: string; }

interface Plugin {
  id: string;                  // = name
  name: string;
  description: string;         // marketplace entry; else plugin.json
  category: string | null;     // marketplace entry
  tags: string[];              // marketplace tags ∪ plugin.json keywords; lower-case, unique, sorted
  version: string | null;      // plugin.json
  author: Person | null;
  license: string | null;
  homepage: string | null;     // only http(s), else null
  repository: string | null;   // only http(s), else null
  dependencies: { name: string; version: string | null; inCatalog: boolean }[];
  installCommand: string;      // "claude plugin install <name>@<marketplace.name>"
  path: string;                // "plugins/<name>"
  sourceUrl: string;           // <repoUrl>/tree/<build.commit>/<path>
  summary: string;             // plain text, ≤ 300 chars (rule X-9)
  readme: Markdown | null;
  thirdPartyNotices: Markdown | null;
  updated: string | null;      // committer date of the last non-merge commit touching path
  artifactIds: string[];       // sorted
  runs: RunProfile;
  recentChanges: Change[];     // ≤ 10, newest first; includes changes whose renamedTo is this plugin
}

interface ArtifactBase {
  id: string;                  // `${kind}:${plugin}/${name}`
  kind: ArtifactKind;
  name: string;
  plugin: string;
  description: string;         // "" when the source has none (never invented)
  path: string;                // repo-relative file that defines it
  sourceUrl: string;           // <repoUrl>/blob/<build.commit>/<path>
  invokeAs: string | null;     // rule X-6
  headings: string[];          // H1–H3 text of body and files, in order
  body: Markdown | null;       // file content without frontmatter
  files: { path: string; title: string; body: Markdown }[]; // supporting .md, sorted by path
  frontmatter: Record<string, string | number | boolean | string[]>; // every key, verbatim
}

interface Skill extends ArtifactBase {
  kind: 'skill';
  argumentHint: string | null;
  userInvokedOnly: boolean;    // disable-model-invocation: true
  allowedTools: string[] | null;
  model: string | null;
}
interface Agent extends ArtifactBase {
  kind: 'agent';
  model: string | null;
  tools: string[] | null;      // null = not declared (inherits the session's tools)
  disallowedTools: string[];
  preloadedSkills: string[];   // frontmatter `skills`, as written ("plugin:skill")
  maxTurns: number | null;
}
interface Command extends ArtifactBase {
  kind: 'command';
  argumentHint: string | null;
  allowedTools: string[] | null;
  model: string | null;
}
interface Hook extends ArtifactBase {
  kind: 'hook';
  event: string;               // e.g. "PreToolUse"
  matcher: string | null;
  type: string;                // "command" | "prompt" | … verbatim
  command: string | null;      // verbatim, ${CLAUDE_PLUGIN_ROOT} kept as written
  timeout: number | null;      // seconds
  scripts: string[];           // repo paths of plugin files the command references
  definedIn: string;           // "plugins/x/hooks/hooks.json" or "plugins/x/.claude-plugin/plugin.json"
}
interface McpServer extends ArtifactBase {
  kind: 'mcp';
  transport: string;           // "stdio" when command is set and no type is given; else type verbatim
  command: string | null;
  args: string[];
  url: string | null;
  envVars: string[];           // names of env keys only, never values
  definedIn: string;
}
type Artifact = Skill | Agent | Command | Hook | McpServer;

interface RunProfile {
  runsCode: boolean;           // hooks.length + mcpServers.length + scripts.length > 0
  hooks: string[];             // artifact ids
  mcpServers: string[];        // artifact ids
  scripts: { path: string; sourceUrl: string; referencedBy: string[] }[]; // referencedBy = hook ids
  agentTools: { agent: string; model: string | null; tools: string[] | null; disallowedTools: string[] }[];
  whatItRuns: { heading: string; text: Markdown }[]; // README "## What it runs" → each "### heading"
}

interface Change {
  commit: string;              // full sha
  date: string;                // committer date ISO 8601
  subject: string;             // first line of the commit message, verbatim
  plugin: string;              // the plugin folder name at that commit (an old name before a rename)
  renamedTo: string | null;    // current name when `renames` maps `plugin` to a plugin in the catalog
  type: 'added' | 'version' | 'change';
  version: { from: string | null; to: string } | null; // set for 'added' (from = null) and 'version'
  url: string;                 // <repoUrl>/commit/<sha>
}
```

## Extraction rules

The generator applies these rules. Each rule is covered by a fixture test
(AC-1..AC-12, AC-65a..AC-73).

| ID | Source | Rule |
|---|---|---|
| X-1 | `.claude-plugin/marketplace.json` | One `Plugin` per `plugins[]` entry, in no other case. `name`, `description`, `category` and `tags` come from the entry. `source` must be a relative path inside the repo. |
| X-2 | `<source>/.claude-plugin/plugin.json` | `version`, `author{name,url}`, `license`, `homepage`, `repository`, `keywords`, `dependencies` (string or `{name,version}`). `description` is used only when the entry has none. |
| X-3 | `skills/<dir>/SKILL.md` | One `Skill`. `name` comes from frontmatter, else `<dir>`. `description` comes from frontmatter (folded YAML is joined into one line). Every other `.md` under `skills/<dir>/` becomes `files[]`, with `title` taken from its first H1, else the file name. |
| X-4 | `agents/*.md` | One `Agent`. `tools` and `disallowedTools` accept a YAML list or a comma-separated string, trimmed. A missing `tools` key gives `null`. `skills` gives `preloadedSkills`. |
| X-5 | `commands/**/*.md` | One `Command`. `name` is the path under `commands/` without `.md`, with `/` replaced by `:` (Q-1). `description` comes from frontmatter, else the first non-empty body line. |
| X-6 | invokeAs | skill: `/<plugin>:<name>`. command: `/<plugin>:<name>`. agent: `<plugin>:<name>`. hook and mcp: `null`. |
| X-7 | `hooks/hooks.json` and `plugin.json` `hooks` (object, or path to a JSON file) | One `Hook` per inner hook object. `name` is the basename without extension of the first plugin file referenced in `command`. Else it is `<event>-<n>`, where `n` is the 1-based position. Duplicates get `-2`, `-3`, and so on. `scripts` lists files under the plugin folder whose relative path occurs in `command` (`${CLAUDE_PLUGIN_ROOT}/` is stripped for matching). `description` is the first paragraph under the README `### <name>` heading in `## What it runs`, else the `hooks.json` top-level `description`, else `""`. |
| X-8 | `.mcp.json` and `plugin.json` `mcpServers` | One `McpServer` per key. `envVars` holds the `env` keys only. `description` is the first paragraph under the README `### <key>`, else `""`. |
| X-9 | `README.md` | `readme` is the full file. `summary` is the first paragraph after the H1 that is not a table, list, code block or HTML. Markdown is stripped to plain text and cut at a word boundary to ≤ 300 chars with `…`. With no such paragraph, `summary` is the plugin `description`. |
| X-10 | `README.md` `## What it runs` | Each `### heading` and its text become `whatItRuns[]`, verbatim. A missing section gives `[]`. |
| X-11 | `THIRD_PARTY_NOTICES.md` | `thirdPartyNotices`, verbatim. |
| X-12 | scripts | Every file in the plugin folder with extension `.mjs .js .cjs .ts .sh .bash .py .ps1`, except `*.test.*` and anything under `evals/`. |
| X-13 | git history | `updated`, `recentChanges` and `changes` come from `git log --no-merges` on HEAD. (1) A commit **touches** plugin P when it changes a path under `plugins/P/`. A commit that touches several plugins gives one candidate per plugin. (2) The commit **adds** P when it is the first commit in which P is an exact `plugins[].name` value of `marketplace.json`. A substring in a description does not count. (3) The commit is a **version** change for P when the `version` in `plugins/P/.claude-plugin/plugin.json` differs from the parent's value (missing counts as `null`). (4) Each candidate becomes one `Change`, typed by precedence **added > version > change**. Type `added` sets `version` to `{from: null, to: <version at that commit>}`, or `null` when there is none. Type `version` sets `{from, to}`. Type `change` sets `version: null`. (5) `plugin` is the folder name P at that commit. `renamedTo` is `renames[P]` from `marketplace.json` at HEAD when that value is a plugin in the catalog, else `null`. |
| X-14 | Ignored | `evals/`, `templates/`, `node_modules/`, dot-files other than the ones named above, binary files. The generator itself reads nothing outside `.claude-plugin/` and `plugins/` except git metadata. The validator subprocess (X-17 step 1) is exempt: it reads what `scripts/validate-marketplace.mjs` reads, including `scripts/`. |
| X-15 | Ordering | Arrays are sorted as the model comments state. Object keys are emitted in model order. JSON is UTF-8 with LF and 2-space indent. |
| X-16 | Frontmatter parsing | Frontmatter is parsed as Claude Code reads it: lenient, not strict YAML. First, YAML is tried (core schema, no custom tags, alias limit 100). If YAML fails with a **syntax error**, each top-level `key: value` line is read by splitting at the first `: `, with no diagnostic. That makes an unquoted `: ` in a value valid. If YAML **rejects** the frontmatter for a custom tag or the alias limit, the same line reader is used, and one warning is added (UT-10b). Folded and literal blocks (`>`, `\|`) and `- item` lists are read by both parsers. A key that neither parser can read gets one warning (X-17), and only that key is dropped. |
| X-17 | Diagnostics | Order: (1) run `scripts/validate-marketplace.mjs`. Its errors fail the generator (AC-8a, AC-8b). Its warnings are copied into `diagnostics`. (2) Every other source problem becomes one warning in `diagnostics` and skips only the affected item or field. Examples: agent or command frontmatter that cannot be read, a missing description, a hook entry of unknown shape, a file over 1 MB or not UTF-8, a symlink, a path outside the plugin folder, a README without the expected heading, rejected YAML (X-16). Each diagnostic is also printed as a GitHub `::warning file=<path>::<message>` line. |

## Search

**Index**: one document per plugin and per artifact.

| Field | Plugin document | Artifact document | Boost |
|---|---|---|---|
| name | name | name | 5 |
| tags (own) | the plugin's tags | — | 3 |
| tags (inherited) | — | the parent plugin's tags | 1 |
| description | description + summary | description | 2 |
| headings | README headings | `headings` | 1.5 |
| body | README text | body + `files` text (+ hook `command`, MCP `command`/`url`) | 1 |

These boosts are the starting values. M2 checks every golden query (AC-14)
against the index built from the real catalog. If one fails, the boosts or the
synonym table are tuned in M2. The spec keeps the starting values, and
changing the golden list needs the owner's approval.

**Query pipeline**, in order. Steps 1–5 apply the same way to query text,
indexed text, and the synonym table's keys and values.

1. **Normalise**: lower-case, Unicode NFKD, combining marks stripped.
2. **Tokenise**: split on every character that is not a letter, digit, `-`
   or `_`. A token with `-` or `_` is kept whole and also split into its parts.
   For example, `zero-downtime` gives `zero-downtime`, `zero` and `downtime`.
3. **Stop words**: drop these tokens: `a about an and any are as at be been but
   by can could do does for from get help how i if in into is it its me
   my need of on or our please some something that the these this those to tool
   use using want was we what which who will with would you your`.
4. **Kind words**: `plugin`, `plugins`, `skill`, `skills`, `agent`, `agents`,
   `subagent`, `subagents`, `command`, `commands`, `hook`, `hooks`, `mcp`,
   `server` and `servers` are removed from the query terms and recorded as
   kind hints. In indexed text they stay ordinary words.
5. **Stem**: for tokens of 5+ chars, strip one suffix in this order:
   `ies`→`y`, `ing`, `ed`, `es`, `s`.
6. **Synonyms**: one curated table. When a query token equals a key after steps
   1–5, every token of each value is added at weight 0.5. A multi-word value
   expands to its tokens. Initial table: migration ↔ schema change, alter
   table · review ↔ audit, reviewer, code review · spec ↔ specification,
   requirement, sdd · plan ↔ planning · test ↔ testing · async ↔ background
   task, celery, queue · api ↔ rest, drf, endpoint · onboarding ↔ codebase
   overview, explain codebase · research ↔ investigate, find · security ↔
   vulnerability, auth, authorization · performance ↔ slow, optimize · diagram
   ↔ mermaid · guard ↔ hook. The table is symmetric: each side expands to the
   other.
7. **Match**: prefix match for terms of 3+ chars. Fuzzy (edit distance ≤ 1) for
   terms of 5+ chars. Terms combine with OR.

**Ranking**: MiniSearch BM25 score × 2 when the item's kind is among the kind
hints. Ties break by kind order (plugin, skill, agent, command, hook, mcp),
then name ascending, then id.

**Collapse**: when a plugin and an artifact of that plugin with the same name
both match, one card is shown, with kind label `<kind> · plugin`. It is ranked
at the higher of the two scores (AC-18a). The exception is when the kind filter
selects only `plugin` (AC-18b).

**Results UX**:

- With no query, the home page lists every plugin card, sorted by name.
- Results update 120 ms after the last keystroke.
- The query and filters live in the hash (`#/?q=…&kind=skill,agent&cat=backend`),
  so a URL reproduces the view.
- Filter chips: kind (multi-select) and category (multi-select). Each chip
  shows its count for the current query. Only kinds present in the catalog are
  shown.
- A polite live region announces "N results".
- `/` focuses the search box. `Esc` clears it.
- Empty result: the page says nothing matched, shows up to 5 most frequent
  tags as clickable chips, and shows a "request it" link prefilled with the
  query. When filters are active, it also shows "clear filters".

**Card**:

- Kind badge.
- Name. It links to the artifact or plugin page.
- Plugin name. It links to the plugin page and is omitted on plugin cards.
- Category.
- Description, cut to 160 chars with `…`.
- Matched terms wrapped in `<mark>` in the name and description. When the best
  match is only in the body, a snippet of ≤ 160 chars around the first hit
  replaces the description, with the file name it came from.
- A "Runs code" badge when the plugin's `runsCode` is true.
- A copy button for `installCommand`.
- For skills, commands and agents, the `invokeAs` string.

## Security profile ("what it runs")

Shown on every plugin page as its own section. Values are copied from
`RunProfile` and from the artifacts, never inferred:

- **Hooks**: a table with event, matcher, type, command (monospace, verbatim),
  timeout and the README description. It links to `definedIn` and to each
  script's source.
- **MCP servers**: a table with name, transport, command + args or URL, and env
  var names.
- **Scripts**: path, a source link, and the hooks that run it. A script no hook
  references is listed as "not referenced by a hook".
- **Agents**: model, tools (or "not declared: inherits the session's tools"),
  and disallowed tools.
- **Skills and commands**: `allowed-tools` when declared.
- **README "What it runs"**: rendered verbatim, under the label "Author's
  description".
- **With nothing to show**: when a plugin has no hooks, no MCP servers and no
  scripts, the section says so in one sentence.
- **Never stated**: claims such as "no network access" or "safe". The site
  shows only data.

## Pages and features

| Pri | Feature | Content |
|---|---|---|
| P0 | Search (home) | the Search section above |
| P0 | Plugin page | header (name, version, category, author with link, license, updated date, "Runs code" badge); install box (`addCommand` + `installCommand`, each copyable); "Add to install set"; summary; artifact table (kind, name, invokeAs, description, link); dependencies (catalog links, or plain text when not in the catalog); What it runs; README (rendered); third-party notices (collapsed by default); recent changes; links to source, homepage and repository |
| P0 | Artifact page | breadcrumb (plugin › kind › name); kind badge; description; invokeAs; facts table from typed fields; "All frontmatter" table; install command of its plugin; body rendered; supporting files, each as a collapsible section; source link. Hook and MCP pages show their typed fields in place of a body. Preloaded skills link to their artifact pages. |
| P0 | What it runs | on the plugin page, as the Security profile section above |
| P1 | Install-set builder | selection (checkbox per plugin, persisted in `localStorage` and in `?p=`); dependencies auto-added and marked "added for X"; scope switch: user or project; output A: CLI lines (`addCommand`, then one `claude plugin install <p>@humen-dev` per plugin, each line with `--scope project` when scope is project); output B: `.claude/settings.json` snippet (AC-40); a copy button for each output |
| P1 | What's new | `changes` grouped by day, newest first. Each row has a type badge (added, version from→to, change), plugin (a link, or plain text for a name not in the catalog), subject, and a commit link. A plugin filter is available. |
| P1 | Request a skill | links in the header, the footer and the empty result. They open the repo's issue form `plugin-request` with the title and the "what" field prefilled. |
| P0 | Global UI | header (site name, search link, Install set (n), What's new, Request, GitHub link, theme toggle); footer (marketplace name, marketplace version as text, "built from <short sha> on <date>" linking to the commit, repo link) |

## Global UI

- **Theme**: dark by default on first visit. A header toggle switches between
  dark and light, and the choice is stored in `localStorage` key
  `catalog.theme`.
- **Pre-paint theme**: the CSP in NFR-12 forbids inline scripts. So the stored
  theme is applied before first paint by a small external
  `site/public/theme-init.js`, loaded synchronously (no `async`/`defer`) in
  `<head>` before the stylesheet. It sets `data-theme` on `<html>` and falls
  back to dark when storage is missing or invalid.
- **Colours**: every colour comes from theme tokens (CSS custom properties).
  Both themes meet the contrast rules in NFR-6a.
- **Width**: the layout works from 320 px to 1920 px wide. Below 768 px,
  filters collapse behind a toggle button and tables reflow into stacked rows.
- **Text**: every string the app renders, including labels, messages,
  `aria-label`, `title`, `placeholder`, `alt` and pluralised counts, comes from
  `site/src/i18n/en.ts`. There are two listed exceptions in `index.html`, which
  cannot import that file: the document `<title>` and the `<noscript>` message.
  Catalog content is shown as written.
- **Copy buttons**: they use the Clipboard API and show "Copied" for 2 s. When
  copying fails, the text is selected for manual copy.
- **States**: loading (skeleton cards), catalog error (message and Retry),
  not-found (route unknown, plugin or artifact missing), empty result, and a
  `<noscript>` message.

## Acceptance criteria (EARS)

Priority: Must / Should / Could. Verify by: unit (Vitest), component (Vitest +
Testing Library), e2e (Playwright on Chromium against the built site), CI
(pipeline run), inspection, or manual.

### Generator

| ID | Pattern | Requirement | Story | Priority | Verify by |
|---|---|---|---|---|---|
| AC-1 | Ubiquitous | The generator shall emit a `catalog.json` that passes a JSON-schema check derived from the Catalog types. | US-10 | Must | unit — schema validation of the fixture output and of the real-repo output |
| AC-2 | Ubiquitous | The generator shall create exactly one Plugin per `plugins[]` entry of `marketplace.json`, with the fields that rules X-1, X-2 and X-9..X-11 define. | US-3 | Must | unit — fixture repo with every field present, and one with every optional field absent |
| AC-3 | Ubiquitous | The generator shall create one artifact per source item that rules X-3..X-8 define. | US-1 | Must | unit — fixture plugin with each kind, in both the inline-in-plugin.json and the separate-file form |
| AC-4 | Ubiquitous | The generator shall set each artifact's `invokeAs` to the value rule X-6 defines for its kind. | US-6 | Must | unit — table test per kind |
| AC-5 | Ubiquitous | The generator shall derive `updated`, `recentChanges` and `changes` from git history by rule X-13. | US-8 | Must | unit — fixture git repo built in the test from scripted commits with known dates |
| AC-6a | Event-driven | WHEN the generator runs on the real checkout, the generator shall emit a plugin set equal to the `plugins[].name` values of `.claude-plugin/marketplace.json`. | US-10 | Must | unit — invariant test on the real checkout |
| AC-6b | Event-driven | WHEN the generator runs on the real checkout, the generator shall emit, per plugin and kind, as many artifacts as rules X-3..X-8 count in its source: SKILL.md files, agent files, command files, inner hook objects and MCP server keys. | US-10 | Must | unit — invariant test; spec-driven gives 7 skills, 4 agents, 2 hooks |
| AC-7a | Ubiquitous | The pipeline shall deploy only a site built from the catalog that the generator produced from the checkout of the deployed commit. | US-10 | Must | inspection — "Site: build" generates, then builds, then uploads in one job |
| AC-7b | Unwanted behaviour | IF the built site output contains the string `fixture-`, THEN the pipeline shall fail "Site: build". | US-10 | Must | CI — a step greps `site/dist/`; a PR that imports a fixture fails |
| AC-8a | Unwanted behaviour | IF `scripts/validate-marketplace.mjs`, run as the generator's first step, reports one or more errors, THEN the generator shall exit non-zero with the validator's output on stderr. | US-10 | Must | unit — fixture with a validator error (missing `plugin.json`); a fixture with only validator warnings exits 0 |
| AC-8b | Unwanted behaviour | IF the validator reports one or more errors, THEN the generator shall leave no `catalog.json` at the output path. | US-10 | Must | unit — output path absent after the failing run |
| AC-9 | Unwanted behaviour | IF the checkout is a shallow clone, THEN the generator shall exit non-zero with the stderr message `full git history required (shallow clone)`. | US-8 | Must | unit — shallow fixture clone. This is an environment check, not a source problem, so X-17 does not apply. |
| AC-10 | Ubiquitous | The generator shall emit `description: ""` for every artifact whose source has no description. | US-5 | Must | unit — fixture without descriptions |
| AC-11 | Ubiquitous | The generator shall copy only the key names of each MCP server's `env` into `envVars`. | US-5 | Must | unit — fixture with env values; no value string occurs in the output |
| AC-12 | Ubiquitous | The generator shall emit no `email` field for any author. | US-3 | Must | unit — fixture with `author.email` |
| AC-65a | Unwanted behaviour | IF a source problem is not a validator error (rule X-17), THEN the generator shall add one Diagnostic naming the problem's path to `diagnostics`. | US-10 | Must | unit — one fixture per X-17 example |
| AC-65b | Unwanted behaviour | IF a source problem is not a validator error, THEN the generator shall print it as one `::warning file=<path>::<message>` line. | US-10 | Must | unit — captured stdout |
| AC-65c | Unwanted behaviour | IF a source problem is not a validator error, THEN the generator shall omit from the catalog only the item or field that the problem affects. | US-10 | Must | unit — sibling items of the fixture are present |
| AC-65d | Unwanted behaviour | IF the only problems are not validator errors, THEN the generator shall exit 0. | US-10 | Must | unit — exit code |
| AC-66 | Event-driven | WHEN a frontmatter value contains an unquoted `: `, the generator shall read the value as the text after the first `: ` of that line, with no diagnostic. | US-1 | Must | unit — `description: Use when: X` gives `Use when: X` and no warning |
| AC-71 | Event-driven | WHEN one commit qualifies as more than one change type for one plugin, the generator shall emit one Change of the highest type in the order added > version > change. | US-8 | Must | unit — fixture commit that adds a plugin with a plugin.json; real case 34c247a gives `added` for spec-driven |
| AC-72 | Event-driven | WHEN the generator emits a Change of type `added` for a commit whose `plugin.json` has a version, the generator shall set its `version` to `{from: null, to: <that version>}`. | US-8 | Must | unit |
| AC-68 | Optional feature | WHERE the HEAD `marketplace.json` `renames` maps an old name to a plugin in the catalog, the generator shall set `renamedTo` to that plugin on every Change whose `plugin` is the old name. | US-8 | Must | unit — fixture with renames; the same fixture without renames gives `renamedTo: null` |
| AC-73 | Optional feature | WHERE `scripts/validate-marketplace.mjs` and `claude plugin validate . --strict` both pass with a top-level `renames` object, the repository shall map `spec-creator` to `spec-driven` in `.claude-plugin/marketplace.json` `renames`. | US-8 | Should | CI — both validators pass on the M1 PR; otherwise the known data gap in Assumptions applies |

### Search and filters

| ID | Pattern | Requirement | Story | Priority | Verify by |
|---|---|---|---|---|---|
| AC-13 | Event-driven | WHEN the user stops typing in the search box for 120 ms, the site shall show the result cards for the current query, ranked as the Search section defines. | US-1 | Must | e2e — type, wait, assert card order on the real catalog |
| AC-14 | Ubiquitous | The site shall rank the expected item within the top 3 results for each golden query: "I need a skill for safe migrations" → skill `django-safe-migration`; "review django code" → agent `django-reviewer`; "write a spec with EARS" → skill `spec-driven/specify` or skill `spec-driven/ears-requirements`; "celery retries" → skill `django-celery-expert`; "onboard to a new repo" → skill `codebase-onboarding`; "hook that guards bash" → hook `spec-driven/bash-guard`; "mermaid diagram" → skill `spec-driven/mermaid-diagram`; "drf viewset override" → skill `cdrf-expert`. | US-1 | Must | unit — search module over the real catalog; first run and tuning in M2 |
| AC-15 | Ubiquitous | The site shall order the items of a fixture catalog, in which each query term occurs in exactly one field per item, by the field boosts in the Search index table. | US-1 | Must | unit — fixture with one item per field |
| AC-16a | Event-driven | WHEN a query token is in the stop-word list, the site shall leave that token out of matching. | US-1 | Must | unit — "the" alone matches nothing; "need celery" ranks like "celery" |
| AC-16b | Event-driven | WHEN a query contains a kind word, the site shall multiply the score of every item of that kind by 2. | US-1 | Must | unit — "migration skill" ranks the skill above the plugin |
| AC-16c | Ubiquitous | The site shall match a query token to an indexed token that has the same stem under step 5. | US-1 | Must | unit — "migrations" matches "migration" |
| AC-16d | Event-driven | WHEN a query token equals a synonym-table key after steps 1–5, the site shall also match every token of that key's values at weight 0.5. | US-1 | Must | unit — "audit" matches an item that has only "review"; "planning" matches "plan" |
| AC-16e | Event-driven | WHEN a query token has 3 or more chars, the site shall match indexed tokens that start with it. | US-1 | Must | unit — "migr" matches "migration" |
| AC-16f | Event-driven | WHEN a query token has 5 or more chars, the site shall match indexed tokens within edit distance 1. | US-1 | Must | unit — "celary" matches "celery" |
| AC-17 | Ubiquitous | The site shall order equal scores by kind order, then name, then id. | US-1 | Must | unit — tie fixture |
| AC-18a | Event-driven | WHEN a plugin and an artifact of that plugin with the same name both match, the site shall show one card with kind label `<kind> · plugin` at the higher of the two scores. | US-1 | Should | unit + e2e — "safe migrations" shows one card for django-safe-migration |
| AC-18b | State-driven | WHILE the kind filter selects only `plugin`, the site shall show plugin cards without merging them with artifacts. | US-2 | Should | e2e |
| AC-19a | Ubiquitous | The site shall render each result card with kind badge, name link, plugin link (artifact cards only), category, description of ≤ 160 chars and an install copy button. | US-1 | Must | component test |
| AC-19b | Ubiquitous | The site shall wrap each matched query term in a card's name and description in a `<mark>` element. | US-1 | Must | component test |
| AC-19c | Ubiquitous | The site shall show `invokeAs` on the card of every artifact whose `invokeAs` is not null. | US-6 | Must | component test — skill shows `/spec-driven:specify`, hook shows none |
| AC-20 | State-driven | WHILE the best match of a result is only in its body, the site shall show on its card a ≤ 160-char snippet around the first hit, labelled with the source file name. | US-1 | Should | component test |
| AC-21a | Event-driven | WHEN the user toggles a kind or category chip, the site shall show only the items that match at least one active value in each filter group that has an active value. | US-2 | Must | e2e — kind=skill and cat=backend gives only backend skills |
| AC-21b | Event-driven | WHEN the query or the filters change, the site shall set every chip's count to the number of current results that have that chip's value. | US-2 | Must | e2e |
| AC-22 | Ubiquitous | The site shall show kind chips only for the kinds in `catalog.kinds`. | US-2 | Must | component test — a catalog without commands shows no Command chip |
| AC-23a | Event-driven | WHEN the query or the filters change, the site shall write them to the hash as `q`, `kind` and `cat`. | US-1 | Must | e2e — hash after typing |
| AC-23b | Event-driven | WHEN a page loads with `q`, `kind` or `cat` in the hash, the site shall show the results for those values. | US-1 | Must | e2e — reload restores the same cards |
| AC-24 | Event-driven | WHEN a query returns no item, with or without filters, the site shall show the empty state with up to 5 tag chips and the prefilled request link. | US-9 | Must | e2e — nonsense query, with and without filters |
| AC-64a | Optional feature | WHERE one or more filters are active, the site shall show a "clear filters" button in the empty state. | US-2 | Must | e2e — button present with filters, absent without |
| AC-64b | Event-driven | WHEN the user clicks "clear filters", the site shall remove every filter while keeping the query. | US-2 | Must | e2e |
| AC-25a | Event-driven | WHEN the user presses `/` while focus is outside a text field, the site shall move focus to the search box. | US-1 | Should | e2e |
| AC-25b | Event-driven | WHEN the user presses `Esc` in the search box, the site shall clear the query. | US-1 | Should | e2e |
| AC-26 | State-driven | WHILE the query is empty, the site shall list every plugin card sorted by name. | US-1 | Must | e2e |

### Plugin page, artifact page, what it runs

| ID | Pattern | Requirement | Story | Priority | Verify by |
|---|---|---|---|---|---|
| AC-27a | Event-driven | WHEN `#/plugins/<name>` opens, the site shall show each Plugin-page element of the Pages table whose data is present. | US-3 | Must | e2e on real plugins, one element at a time: django-reviewer (notices, homepage, dependencies); spec-driven (What it runs, hooks). Component test on fixture plugin `fixture-full` for all elements together. |
| AC-27b | Event-driven | WHEN `#/plugins/<name>` opens, the site shall omit each Plugin-page element whose data is null or empty. | US-3 | Must | e2e — codebase-onboarding shows no notices section |
| AC-28 | Ubiquitous | The site shall list on each plugin page every artifact of that plugin, each as a link to its artifact page. | US-3 | Must | e2e — link count equals `artifactIds.length` |
| AC-29a | Ubiquitous | The site shall show in each plugin's What-it-runs section a row per hook with event, matcher, type, verbatim command, timeout and description. | US-5 | Must | e2e — spec-driven shows 2 hook rows with the hooks.json commands |
| AC-29b | Ubiquitous | The site shall show in each plugin's What-it-runs section a row per MCP server with transport, command + args or URL, and env var names. | US-5 | Must | component test — fixture MCP server |
| AC-29c | Ubiquitous | The site shall show in each plugin's What-it-runs section a row per script with its source link and the hooks that reference it. | US-5 | Must | e2e — spec-driven scripts list `write-guard.mjs` → write-guard |
| AC-29d | Ubiquitous | The site shall show in each plugin's What-it-runs section a row per agent with model, tools and disallowed tools. | US-5 | Must | e2e — spec-driven shows 4 agent rows |
| AC-30 | State-driven | WHILE a plugin has no hooks, MCP servers or scripts, the site shall show in its What-it-runs section the one sentence that says the plugin runs no code. | US-5 | Must | e2e — research-tools |
| AC-31 | Ubiquitous | The site shall show the tools of an agent whose `tools` is null as "not declared: inherits the session's tools". | US-5 | Must | component test |
| AC-32a | Ubiquitous | The site shall render the README "What it runs" text under the label "Author's description". | US-5 | Must | component test |
| AC-32b | Ubiquitous | The site shall take every non-catalog text of the What-it-runs section from `en.ts` keys under `runs.`, none of which contains the words "safe", "secure", "trusted" or "no network". | US-5 | Must | unit — scan of the `runs.` keys |
| AC-33 | Ubiquitous | The site shall show a "Runs code" badge on a plugin's cards and page header exactly when that plugin's `runs.runsCode` is true. | US-5 | Must | unit + e2e — spec-driven has it, research-tools does not |
| AC-34a | Event-driven | WHEN `#/plugins/<p>/<kind>/<name>` opens, the site shall show the Artifact-page elements of the Pages table for that artifact. | US-4 | Must | e2e — one artifact per kind present |
| AC-34b | Event-driven | WHEN an artifact page opens, the site shall list every frontmatter key of the artifact in the "All frontmatter" table. | US-4 | Must | e2e — key count equals `Object.keys(frontmatter)` |
| AC-35 | Ubiquitous | The site shall link each source reference to `<repoUrl>/blob/<build.commit>/<path>` for a file and `<repoUrl>/tree/<build.commit>/<path>` for a folder. | US-4 | Must | unit — URL builder; e2e — link href |

### Install and install set

| ID | Pattern | Requirement | Story | Priority | Verify by |
|---|---|---|---|---|---|
| AC-36a | Event-driven | WHEN the user clicks a copy button, the site shall write the exact shown text to the clipboard. | US-6 | Must | e2e with clipboard permission — read back and compare |
| AC-36b | Event-driven | WHEN a clipboard write succeeds, the site shall show "Copied" on that button for 2 s. | US-6 | Must | component test with fake timers |
| AC-37a | Unwanted behaviour | IF the clipboard write fails, THEN the site shall select the text of that command box. | US-6 | Should | component test — rejected clipboard mock |
| AC-37b | Unwanted behaviour | IF the clipboard write fails, THEN the site shall show the hint "press Ctrl/Cmd+C". | US-6 | Should | component test |
| AC-38a | Event-driven | WHEN the user adds a plugin to the install set, the site shall also add each of its dependencies that is in the catalog, marked "added for <plugin>". | US-7 | Must | e2e — adding django-reviewer gives 4 plugins |
| AC-38b | Unwanted behaviour | IF an added plugin has a dependency that is not in the catalog, THEN the site shall show a warning naming that dependency. | US-7 | Must | component test — fixture dependency |
| AC-39a | Ubiquitous | The site shall generate the install-set CLI output as `addCommand` followed by one `claude plugin install <p>@<marketplace>` line per selected plugin, sorted by name. | US-7 | Must | unit — snapshot of the generated text |
| AC-39b | State-driven | WHILE the scope switch is set to project, the site shall append ` --scope project` to every line of the CLI output. | US-7 | Must | unit — both scopes |
| AC-40 | Ubiquitous | The site shall generate the settings output as JSON of the form `{"extraKnownMarketplaces":{"<marketplace>":{"source":{"source":"github","repo":"<repo>"}}},"enabledPlugins":{"<p>@<marketplace>":true,…}}`, with keys sorted. | US-7 | Must | unit — JSON.parse and deep-equal |
| AC-41a | Event-driven | WHEN the install selection changes, the site shall write it to `localStorage` key `catalog.installSet`. | US-7 | Should | e2e — reload keeps the selection |
| AC-41b | Event-driven | WHEN the install selection changes, the site shall write it to `#/install?p=` as comma-separated names. | US-7 | Should | e2e |
| AC-41c | Event-driven | WHEN `#/install` loads with a `p` parameter, the site shall use the selection from `p` instead of the stored one. | US-7 | Should | e2e — open a shared URL with a different stored set |

### What's new, request a skill

| ID | Pattern | Requirement | Story | Priority | Verify by |
|---|---|---|---|---|---|
| AC-42 | Event-driven | WHEN `#/new` opens, the site shall list `catalog.changes` grouped by day, newest first, each row with a type badge, plugin, subject as plain text and a commit link. | US-8 | Must | e2e |
| AC-43 | Event-driven | WHEN the user selects a plugin in the `#/new` filter, the site shall list only the changes whose `plugin` or `renamedTo` is that plugin. | US-8 | Could | e2e |
| AC-44 | Ubiquitous | The site shall show each plugin's `recentChanges` on its page, with each version change written as "<from> → <to>". | US-8 | Must | e2e — spec-driven |
| AC-69 | Ubiquitous | The site shall render as plain text, without a link, the plugin name of every Change whose `plugin` is not in the catalog. | US-8 | Must | component test — Change with `plugin: "spec-creator"` |
| AC-70 | Ubiquitous | The site shall include in a plugin's recent changes every Change whose `renamedTo` is that plugin. | US-8 | Must | unit — fixture with renames |
| AC-45 | Ubiquitous | The site shall point every request link to `<repoUrl>/issues/new?template=plugin-request.yml`, with `title` and the `what` field set to the first 200 chars of the current query, or empty when there is no query. | US-9 | Must | unit — URL builder; e2e — href |
| AC-46 | Ubiquitous | The repository shall contain the issue form `.github/ISSUE_TEMPLATE/plugin-request.yml` with fields `what` (required), `use-case` and `kind`. | US-9 | Must | inspection |

### Pages, routing, states

| ID | Pattern | Requirement | Story | Priority | Verify by |
|---|---|---|---|---|---|
| AC-47 | Event-driven | WHEN a route of the Routes table is opened by direct load, reload or browser back/forward, the site shall render the page that the table assigns to it. | US-1 | Must | e2e — each route, each navigation type, page heading asserted |
| AC-48 | Event-driven | WHEN a route names an unknown page, plugin or artifact, the site shall show the not-found state with a link to search. | US-3 | Must | e2e |
| AC-49 | State-driven | WHILE `catalog.json` is loading, the site shall show skeleton cards. | US-1 | Should | e2e — throttled network |
| AC-50a | Unwanted behaviour | IF `catalog.json` fails to load or to parse, THEN the site shall show an error message with a Retry button. | US-1 | Must | e2e — route intercepted with 500, and with invalid JSON |
| AC-50b | Event-driven | WHEN the user clicks Retry, the site shall request `catalog.json` again. | US-1 | Must | e2e — second request observed |
| AC-51 | Ubiquitous | The site shall show a footer with the marketplace name, the marketplace version as text, and "built from <7-char sha> on <date>" linking to the commit. | US-10 | Must | e2e |

### Pipeline and docs

| ID | Pattern | Requirement | Story | Priority | Verify by |
|---|---|---|---|---|---|
| AC-67 | Ubiquitous | The pipeline shall consist of one workflow named "Site" (`.github/workflows/site.yml`) with the jobs "Site: tests", "Site: build" and "Site: deploy", each reported as its own check. | US-10 | Must | inspection + CI — the PR checks list shows "Site: tests" and "Site: build" |
| AC-52 | Event-driven | WHEN a commit is pushed to `main` that touches `plugins/**`, `.claude-plugin/**`, `site/**`, `scripts/validate-marketplace.mjs` or `.github/workflows/site.yml`, the pipeline shall deploy the site built from that commit to GitHub Pages. | US-10 | Must | CI — merge a change; the live footer shows that sha |
| AC-53a | Event-driven | WHEN a pull request touches those paths, the pipeline shall run "Site: tests" and "Site: build". | US-10 | Must | CI — PR run |
| AC-53b | Event-driven | WHEN a pull request touches those paths, the pipeline shall skip "Site: deploy". | US-10 | Must | CI — PR run shows deploy skipped |
| AC-53c | Event-driven | WHEN a pull request touches those paths, the pipeline shall upload no Pages artifact. | US-10 | Must | CI — PR run lists no `github-pages` artifact |
| AC-54 | Unwanted behaviour | IF "Site: tests" or "Site: build" fails, THEN the pipeline shall skip "Site: deploy". | US-10 | Must | CI — failing PR on main-like branch; inspection: deploy `needs: [tests, build]` |
| AC-55a | Event-driven | WHEN a user starts the workflow manually (`workflow_dispatch`), the pipeline shall run "Site: tests" and "Site: build". | US-10 | Should | inspection + one manual run |
| AC-55b | Event-driven | WHEN a run is for a ref other than `refs/heads/main`, the pipeline shall skip "Site: deploy". | US-10 | Should | inspection — job `if` |
| AC-56 | State-driven | WHILE a run for `main` is in progress, the pipeline shall hold every later run for `main` in the workflow-level concurrency group `pages` (`cancel-in-progress: false`) until the running one finishes. | US-10 | Must | inspection + EC-17 manual check |
| AC-57a | Ubiquitous | The repository shall keep no statement in `README.md` and `docs/SECURITY.md` that the repository is private. | US-6 | Must | inspection — grep `private` |
| AC-57b | Ubiquitous | The repository shall keep no `gh auth setup-git` step in the README install instructions. | US-6 | Must | inspection — grep `setup-git` |
| AC-57c | Ubiquitous | The repository shall link `https://humen-dev.github.io/agent-plugins/` from the README. | US-6 | Must | inspection |
| AC-58a | Ubiquitous | The repository shall state in `CONTRIBUTING.md` that the site rebuilds on every merge to `main` that touches the site paths. | US-10 | Should | inspection |
| AC-58b | Ubiquitous | The repository shall list in `CONTRIBUTING.md` the commands that run the generator and the site locally. | US-10 | Should | inspection — commands run on a fresh clone |

### Theme and text

| ID | Pattern | Requirement | Story | Priority | Verify by |
|---|---|---|---|---|---|
| AC-59 | Event-driven | WHEN the site loads with no stored theme, the site shall use the dark theme. | US-11 | Must | e2e — fresh context, both `prefers-color-scheme` values |
| AC-60a | Event-driven | WHEN the user clicks the theme toggle, the site shall switch every themed surface to the other theme. | US-11 | Must | e2e — `data-theme` and a sampled background colour change |
| AC-60b | Event-driven | WHEN the user clicks the theme toggle, the site shall store the new theme in `localStorage` key `catalog.theme`. | US-11 | Must | e2e |
| AC-60c | Event-driven | WHEN the site loads with a stored theme, the site shall paint its first frame in that theme. | US-11 | Must | e2e — `data-theme` set before `DOMContentLoaded`; screenshot of the first frame |
| AC-61 | Ubiquitous | The site shall expose the theme toggle as a button with an accessible name and `aria-pressed="true"` while the light theme is active. | US-11 | Must | e2e + axe |
| AC-62a | State-driven | WHILE the viewport is 320 to 1920 px wide, the site shall keep the document's scroll width at or below the viewport width. | US-1 | Must | e2e — viewports 320, 375, 768, 1280, 1920 on every route |
| AC-62b | State-driven | WHILE the viewport is narrower than 768 px, the site shall show the filters behind a toggle button. | US-2 | Must | e2e — 375 px and 768 px |
| AC-63 | Ubiquitous | The site shall take every string it renders, except the document `<title>` and the `<noscript>` message in `index.html`, from `site/src/i18n/en.ts`. | US-11 | Must | unit — a test parses every `site/src/**/*.tsx` with the TypeScript compiler API. It fails on any JSX text node containing a letter, and on any string literal containing a letter in an `aria-label`, `title`, `placeholder` or `alt` attribute (`react/jsx-no-literals` does not cover attributes). It also checks that every key used exists in `en.ts`. |

## Edge cases

| ID | Case | Expected behaviour | Verify by |
|---|---|---|---|
| EC-1a | Query is only stop words and kind words ("I need a skill") | IF no search term remains after the pipeline and the query has a kind hint, THEN the site shall list every item of the hinted kinds, sorted by name. | unit |
| EC-1b | Query is only stop words ("I need a") | IF no search term and no kind hint remain, THEN the site shall list every plugin card, sorted by name. | unit |
| EC-2a | Query longer than 200 chars | IF the query is longer than 200 chars, THEN the site shall search with its first 200 chars. | unit |
| EC-2b | Query with regex or HTML characters | The site shall treat every character of the query as literal text. | unit — `<script>`, `.*`, `((` give no error and no markup |
| EC-3a | Long name or description on a card | IF a card's name or description exceeds its box, THEN the site shall cut it with an ellipsis. | e2e at 320 px |
| EC-3b | Long hook command | IF a hook command exceeds its box, THEN the site shall scroll it horizontally inside its code box. | e2e at 320 px; AC-62a holds |
| EC-4 | Plugin with zero artifacts | IF a plugin has no artifacts, THEN the site shall show "This plugin adds no skills, agents, commands, hooks or MCP servers" on its page. | unit fixture + component |
| EC-5 | Dependency not in catalog | IF a dependency is not in the catalog, THEN the site shall show it as plain text marked "not in this marketplace". | component |
| EC-6 | Stored or URL selection names a removed plugin | IF the install selection names a plugin not in the catalog, THEN the site shall drop that name with a one-line notice. | e2e |
| EC-7 | `localStorage` unavailable (privacy mode) | IF `localStorage` throws, THEN the site shall keep the theme and the selection in memory for the session without showing an error. | component — throwing storage mock |
| EC-8 | Two hooks reference the same script | WHEN two hooks reference the same script, the generator shall list both hook ids in that script's `referencedBy`. | unit |
| EC-9 | Commit touching several plugins | WHEN a commit touches several plugins, the generator shall emit one Change per touched plugin. | unit |
| EC-10 | Commits from before a rename (display: AC-69; link to the new plugin: AC-68) | WHEN a commit touches only `plugins/<old>/` of a plugin no longer in `marketplace.json`, the generator shall emit its Change with `plugin: "<old>"`. | unit — fixture; real case: commits before 34c247a under `plugins/spec-creator/` |
| EC-11 | Catalog has no commands or MCP servers (today) | → AC-22: no chip, no empty sections. | component |
| EC-12 | Clipboard API missing (HTTP, old browser) | → AC-37a, AC-37b. | component |
| EC-13 | Markdown with Mermaid or other fenced code | IF a code block has language `mermaid`, THEN the site shall show it as a code block. | component |
| EC-14 | Relative link inside Markdown (`references/x.md`) | IF a Markdown link is relative, THEN the site shall link it to `<repoUrl>/blob/<build.commit>/<path resolved against the file's repo path>`. | unit |
| EC-15 | Image in Markdown | IF Markdown contains an image, THEN the site shall render a link, with the alt text, to the image URL in place of the image. | component — no image request in the network log |
| EC-16 | JavaScript disabled | IF JavaScript is disabled, THEN the site shall show the `<noscript>` message with links to the repository and the README. | inspection |
| EC-17 | Out-of-order runs on `main` | IF a second and a third push to `main` arrive while a run for `main` is in progress, THEN the pipeline shall deploy the newest commit last. | inspection of workflow concurrency; manual — three quick pushes, then the live footer shows the newest sha |

## Module interactions

```mermaid
sequenceDiagram
  actor Dev as Maintainer
  participant GH as GitHub (main)
  participant CI as the pipeline
  participant Gen as the generator
  participant Pages as GitHub Pages
  actor U as User
  participant S as the site
  Dev->>GH: merge PR adding plugins/foo
  GH->>CI: push event (paths match; concurrency group "pages")
  CI->>Gen: node generate (full history checkout)
  Gen->>Gen: scripts/validate-marketplace.mjs
  Gen-->>CI: catalog.json + diagnostics / exit 1 on validator error
  CI->>CI: Site: tests (lint, typecheck, unit, e2e) ‖ Site: build (vite build, budgets)
  CI->>Pages: Site: deploy (main only, needs both)
  U->>S: open humen-dev.github.io/agent-plugins/#/?q=…
  S->>Pages: GET catalog.json (same origin)
  Pages-->>S: 200 JSON / error → AC-50a
  S->>S: build index, search, render
  U->>GH: request link → issues/new (prefilled)
```

| From → To | Contract | Data | Source of truth | On failure |
|---|---|---|---|---|
| pipeline → generator | CLI `node site/scripts/generate.mjs --out <file>` (new) | checkout + git | repository at HEAD | non-zero exit stops the job (AC-8a, AC-54); warnings never stop it (AC-65d) |
| generator → validator | `node scripts/validate-marketplace.mjs` (existing), exit code + stdout/stderr | error/warning lines | the validator | exit ≠ 0 → generator fails (AC-8a) |
| site → Pages | `GET ./catalog.json` (new) | Catalog | the generator output of the deployed commit | error state + Retry (AC-50a, AC-50b) |
| site → GitHub | outbound links only (blob, commit, issues/new) | none sent except a prefilled query in the issue URL | — | none (plain links) |

## Data and state

- **Server state**: none.
- **Client state**: theme (`localStorage` key `catalog.theme`: `"dark" | "light"`)
  and install selection (`catalog.installSet`: JSON array of plugin names). Both
  are validated on read (UT-6). Clearing site data resets them.
- **Catalog**: rebuilt from scratch on each deployment, from full git history.
  There is no migration between versions. `schemaVersion` changes only with the
  site code in the same commit.

## Compatibility and rollout

- Plugins, the existing validators and the existing `validate.yml` are
  unchanged. `marketplace.json` gains only a `renames` entry (AC-73). Users who
  never open the site see no change.
- The site URL is `https://humen-dev.github.io/agent-plugins/`. Vite `base` is
  `/agent-plugins/`.
- **Rollout**: in M1–M4, `site.yml` has no "Site: deploy" job and uploads no
  Pages artifact. Pull requests and pushes to `main` run only "Site: tests" and
  "Site: build". M5 adds the deploy job, the upload of the Pages artifact on
  `main`, and the docs changes (AC-57a..AC-58b).

## Non-functional requirements

| ID | Category | Requirement | Verify by |
|---|---|---|---|
| NFR-1a | Performance | IF the site's initial JavaScript exceeds 120 KB gzip, THEN the pipeline shall fail "Site: build". | CI — size-check step |
| NFR-1b | Performance | IF `catalog.json` exceeds 300 KB gzip, THEN the pipeline shall fail "Site: build". | CI — size-check step; real content is about 158 KB gzip on 2026-11-23 |
| NFR-2 | Performance | The pipeline shall publish, on every "Site: build" run, a Lighthouse mobile report for the home page with the Performance score and LCP, without failing on the result. | CI — report present; the step has `continue-on-error: true`. Target, not gate: Performance ≥ 90, LCP ≤ 2.5 s. |
| NFR-4 | Performance | WHEN the generator runs on the real repository on `ubuntu-latest`, the generator shall finish within 30 s. | CI step timing |
| NFR-5 | A11y | The site shall show 0 serious and 0 critical axe-core (WCAG 2.2 AA) violations on the home, plugin, artifact, install and new routes, in both themes at 375 px and 1280 px (20 checks). | e2e + @axe-core/playwright |
| NFR-6a | A11y | The site shall render text with a contrast ratio of at least 4.5:1, and large text and UI boundaries with at least 3:1, in both themes. | axe colour-contrast rule + unit test over the theme tokens |
| NFR-6b | A11y | The site shall draw a focus indicator with at least 3:1 contrast against its background on every focused interactive element. | e2e — tab through each route; computed outline checked |
| NFR-7a | A11y | The site shall let a keyboard-only user search, open a plugin page, copy an install command and build an install set. | e2e — the whole flow driven by keyboard events only |
| NFR-7b | A11y | WHEN the number of results changes, the site shall announce the new count through a polite live region. | e2e — live region text |
| NFR-8 | A11y | WHILE `prefers-reduced-motion: reduce` is set, the site shall set every CSS transition and animation duration to 0. | e2e with emulated media — computed durations |
| NFR-9 | Compatibility | The site shall complete the smoke flow (search, plugin page, theme toggle, copy) on Chromium, and on the current Firefox and Safari desktop releases. | e2e on Chromium in CI; manual M-4 on Firefox and Safari desktop |
| NFR-10a | Determinism | WHEN the generator runs twice on the same commit, the generator shall write byte-identical `catalog.json` files. | unit — run twice, compare bytes |
| NFR-10b | Determinism | WHEN the generator runs on the same commit with different `LANG` and `TZ` values, the generator shall write byte-identical `catalog.json` files. | unit — run with `LANG=de_DE.UTF-8 TZ=Asia/Tokyo` and with `LANG=C TZ=UTC` |
| NFR-11 | Determinism | WHEN the site gets the same `catalog.json` and query, the site shall return the same ordered results. | unit |
| NFR-12 | Security | The site shall load every route under the CSP meta tag `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'` with 0 CSP violations in the console. | e2e — console listener on every route |
| NFR-13 | Security | The site shall send no request to any origin other than its own. | e2e — network log on every route |
| NFR-14 | Security | The site shall set `rel="noopener noreferrer"` on every link to another origin. | unit over rendered output |
| NFR-15a | Security | The pipeline shall grant only `contents: read` to "Site: tests" and "Site: build". | inspection |
| NFR-15b | Security | The pipeline shall grant only `pages: write` and `id-token: write` to "Site: deploy". | inspection |
| NFR-15c | Security | The pipeline shall run "Site: deploy" in the `github-pages` environment. | inspection |
| NFR-16a | Security | The pipeline shall install the site's npm dependencies with `npm ci` from the committed lockfile. | inspection |
| NFR-16b | Security | WHEN `npm audit --omit=dev --audit-level=high` reports a finding, the pipeline shall show it as a warning annotation without failing the run. | CI — the audit step has `continue-on-error: true` |
| NFR-17 | Reliability | IF a pipeline run fails, THEN the pipeline shall leave the deployed site at its previous commit. | → AC-54; CI — live footer sha unchanged after a failing run |
| NFR-18 | Maintainability | IF `tsc --noEmit` or ESLint reports an error, THEN the pipeline shall fail "Site: tests". | CI |

## Inputs and provenance

| Input | Source | Trust |
|---|---|---|
| marketplace.json, plugin.json, frontmatter | repo files, written by contributors via PR | untrusted for rendering |
| SKILL.md, agent, command bodies, READMEs, notices | repo files, including copied third-party content | untrusted |
| hooks.json, .mcp.json command strings | repo files | untrusted (displayed only) |
| git commit subjects | git history | untrusted |
| URL hash (`q`, `kind`, `cat`, `p`) | anyone who crafts a link | untrusted |
| `localStorage` values | the user's browser, possibly stale or edited | untrusted |
| catalog.json | the generator on the deployed commit | trusted for shape (schema-checked at build) |

## Untrusted inputs

| ID | Input | Threat | Requirement | Verify by |
|---|---|---|---|---|
| UT-1 | Markdown bodies | HTML/script injection | IF Markdown contains raw HTML, THEN the site shall show it as escaped text. | unit — fixture with `<script>`, `<img onerror>`, `<iframe>`; no element created |
| UT-2a | Markdown links | `javascript:`/`data:` URLs | IF a Markdown link has a scheme other than `http`, `https` or `mailto`, THEN the site shall render its text as plain text without a link. | unit (relative links: EC-14) |
| UT-2b | `homepage`, `repository`, `author.url` | `javascript:`/`data:` URLs | IF a manifest URL field has a scheme other than `http` or `https`, THEN the generator shall emit `null` for that field. | unit |
| UT-3 | All catalog strings (names, descriptions, subjects, commands, frontmatter values) | HTML injection | The site shall render every catalog string as a text node. | lint — ban `dangerouslySetInnerHTML`; unit with hostile strings |
| UT-4 | URL hash params `kind`, `cat`, `p` | unknown values | IF `kind`, `cat` or `p` hold values that are not in the catalog, THEN the site shall ignore those values. | unit (query length: EC-2a) |
| UT-5 | Request-link query | URL injection into GitHub | IF the query contains `&`, `=`, `#` or `?`, THEN the site shall percent-encode those characters in the issue URL. | unit — query `x&labels=bug` stays one `title` value |
| UT-6 | `localStorage` | malformed data | IF a stored value is not the expected type, THEN the site shall discard it in favour of the default. | unit |
| UT-7 | `source`, `hooks`, `mcpServers` paths, symlinks in plugin folders | path escape | IF a path resolves outside the plugin folder or a file is a symlink, THEN the generator shall skip it without reading it. | unit fixture — the target's content is absent from the output; warning by AC-65a; a `..` path is a validator error (AC-8a) |
| UT-8 | Large or binary files | oversized payload | IF a text source file exceeds 1 MB or is not valid UTF-8, THEN the generator shall skip it. | unit fixture; warning by AC-65a |
| UT-9a | Repo files | secret leakage | The generator shall read file contents only from the paths rules X-1..X-14 allow. | unit (validator subprocess exempt by X-14) — fixture `.env` and `secrets.txt` are absent from the output |
| UT-9b | Environment | secret leakage | The generator shall read no environment variable other than `GITHUB_REPOSITORY`. | unit — run with a sentinel env var; its value is absent from the output |
| UT-10a | YAML frontmatter | parser abuse (custom tags, alias bombs) | IF frontmatter uses a custom tag or exceeds the alias limit of 100, THEN the generator shall read that file with the line reader of X-16 within 1 s. | unit — billion-laughs fixture: finishes ≤ 1 s, output bounded |
| UT-10b | YAML frontmatter | parser abuse | IF YAML rejects frontmatter for a custom tag or the alias limit, THEN the generator shall add the warning `frontmatter: YAML rejected (<reason>); read line by line` for that file. | unit — same fixture: diagnostic present |

## Assumptions and dependencies

- **Verified 2026-11-23**: the repository is public (`visibility: public`) and
  `has_issues: true`. Pages is enabled with source "GitHub Actions"
  (`build_type: workflow`, `html_url` `https://humen-dev.github.io/agent-plugins/`).
  Dependabot alerts are enabled (`GET /repos/humen-dev/agent-plugins/vulnerability-alerts`
  returns 204). They report vulnerable dependencies. They do not block merges
  or deploys.
- **Label**: the owner creates the `plugin-request` label by hand before M4
  merges (Q-3).
- **Issue-form prefill**: GitHub issue forms accept field prefill by
  `?<field-id>=value`. If they don't, the "what" text goes in `title` only.
- **CLI flags**: `claude plugin install … --scope project`,
  `claude plugin marketplace add … --scope project`, and the
  `extraKnownMarketplaces` + `enabledPlugins` settings shape are accepted by
  the current Claude Code CLI. This is checked once at implementation (M-3).
- **Plugin folders**: every marketplace `source` is `./plugins/<name>`. This is
  true for all 8 entries today. X-13 maps history paths to plugins by folder
  name.
- **Known rename**: `spec-creator` was renamed to `spec-driven` in 34c247a
  (2026-11-10), with no `renames` entry. M1 adds `"renames": {"spec-creator":
  "spec-driven"}` if both validators accept it (AC-73). **Known data gap
  otherwise**: commits from before 34c247a show under the plain-text name
  "spec-creator" and do not appear in spec-driven's recent changes.
- **Visual design**: manual check M-2 needs the design from the design handoff
  (`docs/design/`, Phase 3). It cannot run before that exists.
- **Pipeline runtime**: Node 22 on `ubuntu-latest`, as in the existing
  `validate.yml`.
- **No other specs**: this spec does not depend on another spec.

## Testing

- **Generator unit tests** run on a fixture repository under
  `site/test/fixtures/` that the test turns into a temporary git repo with
  scripted commits. It has plugins named `fixture-*`:
  - every kind, in inline and separate-file forms;
  - `fixture-full`, with every plugin-page element;
  - missing fields;
  - hostile content (UT-1..UT-10b);
  - renames, multi-plugin commits and an added-plus-version commit;
  - a shallow clone.
- **Real-repo invariant tests** run the generator in-process on the checkout.
  They need no earlier generate step. They cover AC-6a, AC-6b, NFR-10a and
  NFR-10b. They never use a snapshot of real content, so adding a plugin needs
  no test update.
- **Search unit tests**: pipeline steps, ranking, ties and collapse on a
  fixture catalog. The golden queries (AC-14) run on a catalog generated
  in-process from the real checkout.
- **Component tests**: Vitest + Testing Library for cards, the What-it-runs
  section, install-set outputs, copy failure, storage failure and the
  `fixture-full` plugin page.
- **E2E**: Playwright on Chromium only, against `vite preview` of a production
  build with the real catalog. Viewports: 320, 375, 768, 1280 and 1920 px.
- **Accessibility**: axe runs on the home, plugin, artifact, install and new
  routes, in both themes, at 375 and 1280 px (NFR-5).
- **Translations test** (AC-63): fails on JSX text and on
  `aria-label`/`title`/`placeholder`/`alt` string literals that contain
  letters.
- **Manual checks before M5 sign-off**:
  - M-1: screen-reader pass (NVDA or VoiceOver) through the search flow.
  - M-2: visual check of both themes against the design in `docs/design/`.
  - M-3: paste the install-set CLI lines and the settings snippet into a
    scratch project, and confirm Claude Code installs and enables the plugins.
  - M-4: smoke flow (search, plugin page, theme toggle, copy) on current
    Firefox and Safari desktop.

## CI/CD

One workflow, `.github/workflows/site.yml`, named **Site**.

**Triggers**:

- `pull_request` and `push` to `main`, both filtered by paths: `plugins/**`,
  `.claude-plugin/**`, `site/**`, `scripts/validate-marketplace.mjs`,
  `.github/workflows/site.yml`.
- `workflow_dispatch`.

**Workflow-level concurrency**: runs for `refs/heads/main` share the group
`pages`, with `cancel-in-progress: false`. A later run for `main` waits until
the running one finishes, so deployments never overlap or run out of order
(AC-56, EC-17). Other refs use a group per run, so pull requests never wait.

Its three jobs show as separate checks.

**"Site: tests"** (`contents: read`):

1. Checkout with `fetch-depth: 0`.
2. Node 22, with npm cache.
3. `npm ci` in `site/`.
4. Lint (ESLint) and typecheck (`tsc --noEmit`).
5. Unit and component tests (Vitest). These include the generator fixtures,
   the translations test, and the real-repo and golden-query tests, which run
   the generator in-process on the checkout.
6. Generate the catalog and build the site for e2e.
7. Install Playwright Chromium, then run e2e and axe (NFR-5).
8. `npm audit --omit=dev --audit-level=high`, as a warning only
   (`continue-on-error`).

**"Site: build"** (`contents: read`):

1. Checkout with `fetch-depth: 0`, Node 22, `npm ci`.
2. Generate the catalog with `GITHUB_REPOSITORY` from the workflow env. The
   generator runs the validator first (AC-8a), and diagnostics appear as
   `::warning` annotations.
3. `vite build`.
4. Fixture check (AC-7b) and size budgets (NFR-1a, NFR-1b). Each fails the
   job.
5. Lighthouse CI report, non-blocking (NFR-2).
6. From M5, on `refs/heads/main` only: `actions/upload-pages-artifact` with
   `site/dist`.

**"Site: deploy"** (from M5):

- `needs: [tests, build]`.
- Runs only on `refs/heads/main` (push or dispatch).
- Runs in environment `github-pages`, with permissions `pages: write` and
  `id-token: write`.
- Uses `actions/deploy-pages`.

Action versions are pinned the way `validate.yml` pins them. The existing
`validate.yml` is unchanged. A PR that breaks a plugin fails both workflows.

## Milestones

Every AC, EC, NFR and UT row belongs to exactly one milestone.

| M | Scope | Done when |
|---|---|---|
| M1 | Data model, generator (validator first, lenient frontmatter, diagnostics, history and renames), fixtures, `renames` entry, "Site" workflow with "Site: tests" and "Site: build" | AC-1..AC-5, AC-6a, AC-6b, AC-8a, AC-8b, AC-9..AC-12, AC-53a, AC-55a, AC-65a..AC-65d, AC-66, AC-67, AC-68, AC-71, AC-72, AC-73, EC-8, EC-9, EC-10, UT-2b, UT-7, UT-8, UT-9a, UT-9b, UT-10a, UT-10b, NFR-4, NFR-10a, NFR-10b, NFR-15a, NFR-16a, NFR-16b, NFR-18 |
| M2 | App shell, theme + `theme-init.js`, `en.ts` + translations test, CSP, search page, cards, filters, states, golden-query tuning | AC-7b, AC-13..AC-15, AC-16a..AC-16f, AC-17, AC-18a, AC-18b, AC-19a..AC-19c, AC-20, AC-21a, AC-21b, AC-22, AC-23a, AC-23b, AC-24, AC-25a, AC-25b, AC-26, AC-47..AC-49, AC-50a, AC-50b, AC-51, AC-59, AC-60a..AC-60c, AC-61, AC-62a, AC-62b, AC-63, AC-64a, AC-64b, EC-1a, EC-1b, EC-2a, EC-2b, EC-3a, EC-11, UT-3, UT-4, NFR-11, NFR-12, NFR-13, NFR-14 |
| M3 | Plugin page, artifact page, What it runs, Markdown rendering | AC-27a, AC-27b, AC-28, AC-29a..AC-29d, AC-30, AC-31, AC-32a, AC-32b, AC-33, AC-34a, AC-34b, AC-35, EC-3b, EC-4, EC-5, EC-13..EC-16, UT-1, UT-2a |
| M4 | Install-set builder, what's new, renamed-plugin display, request link and issue form | AC-36a, AC-36b, AC-37a, AC-37b, AC-38a, AC-38b, AC-39a, AC-39b, AC-40, AC-41a..AC-41c, AC-42..AC-46, AC-69, AC-70, EC-6, EC-7, EC-12, UT-5, UT-6 |
| M5 | "Site: deploy", Pages artifact upload on main, concurrency, size budgets, axe matrix, Lighthouse report, docs updates, launch | AC-7a, AC-52, AC-53b, AC-53c, AC-54, AC-55b, AC-56, AC-57a..AC-57c, AC-58a, AC-58b, EC-17, NFR-1a, NFR-1b, NFR-2, NFR-5, NFR-6a, NFR-6b, NFR-7a, NFR-7b, NFR-8, NFR-9, NFR-15b, NFR-15c, NFR-17, M-1..M-4 |

## Design review

**Sources analysed**:

- the owner's brief and decisions (this conversation, 2026-11-23)
- `.claude-plugin/marketplace.json`
- `plugins/*/.claude-plugin/plugin.json`
- every SKILL.md and agent file
- `plugins/spec-driven/hooks/hooks.json`
- the plugin READMEs and `docs/PLUGIN-GUIDELINES.md:135-157` (README and What it runs rules)
- `docs/RELEASES.md:128-143` (renames)
- `docs/SECURITY.md`
- `.github/workflows/validate.yml`
- `scripts/validate-marketplace.mjs`
- `CODEOWNERS`
- git history (commit 34c247a, the rename)
- review round 1 (R-F-1..R-F-21, fresh read-only reviewer, 2026-11-23)

The visual design will come from `docs/design/` (Phase 3).

**Gaps found**:

| ID | Lens | Gap | Resolution |
|---|---|---|---|
| F-1 | Corner case | Single-skill plugins share name and description with their skill, giving duplicate cards | → AC-18a, AC-18b |
| F-2 | Gap | No commands or MCP servers exist yet; kind filter would show empty chips | → AC-22, EC-11 |
| F-3 | Corner case | Shallow clone gives wrong dates silently | → AC-9 |
| F-4 | Module interaction | Merge commits give useless "Merge pull request" subjects | → X-13 `--no-merges` |
| F-5 | Conflict | `.claude/sdd.json` had no `specsDir`; spec-driven's default is `specs/`, but this spec is in `docs/specs/` | → Q-2, answered: `"specsDir": "docs/specs/"` added |
| F-6 | Gap | Third-party (Vinta) content is shown publicly | MIT licence, credited in notices → AC-27a shows notices |
| F-7 | Corner case | Real rename spec-creator → spec-driven has no `renames` entry (R-F-5, R-F-6) | → X-13, AC-68..AC-73, EC-10, Assumptions |
| F-8 | Module interaction | Overlapping runs on `main` could deploy an older commit last (R-F-9) | → AC-56, EC-17 |

**UX improvements**:

| # | Proposal | Decision |
|---|---|---|
| UX-1 | "Runs code" badge on cards | accepted → AC-33 |
| UX-2 | Body-match snippet with source file | accepted → AC-20 |
| UX-3 | Shareable search and install-set URLs | accepted → AC-23a, AC-23b, AC-41b, AC-41c |
| UX-4 | Global "runs code" overview page | rejected: badge and kind filter cover it for 8 plugins |

## Traceability

| Source | Requirements |
|---|---|
| US-1 | AC-3, AC-13..AC-15, AC-16a..AC-16f, AC-17, AC-18a, AC-19a, AC-19b, AC-20, AC-23a, AC-23b, AC-25a, AC-25b, AC-26, AC-47, AC-49, AC-50a, AC-50b, AC-62a, AC-66, EC-1a, EC-1b, EC-2a, EC-2b, EC-3a, EC-13..EC-16, UT-1, UT-2a, UT-3, UT-4, NFR-1a, NFR-1b, NFR-2, NFR-9, NFR-11, NFR-12, NFR-13, NFR-14 |
| US-2 | AC-18b, AC-21a, AC-21b, AC-22, AC-62b, AC-64a, AC-64b, EC-11 |
| US-3 | AC-2, AC-12, AC-27a, AC-27b, AC-28, AC-48, EC-4, EC-5, UT-2b |
| US-4 | AC-34a, AC-34b, AC-35, EC-3b |
| US-5 | AC-10, AC-11, AC-29a..AC-29d, AC-30, AC-31, AC-32a, AC-32b, AC-33, EC-8 |
| US-6 | AC-4, AC-19c, AC-36a, AC-36b, AC-37a, AC-37b, AC-57a..AC-57c, EC-12 |
| US-7 | AC-38a, AC-38b, AC-39a, AC-39b, AC-40, AC-41a..AC-41c, EC-6, EC-7, UT-6 |
| US-8 | AC-5, AC-9, AC-42..AC-44, AC-68..AC-73, EC-9, EC-10 |
| US-9 | AC-24, AC-45, AC-46, UT-5 |
| US-10 | AC-1, AC-6a, AC-6b, AC-7a, AC-7b, AC-8a, AC-8b, AC-51, AC-52, AC-53a..AC-53c, AC-54, AC-55a, AC-55b, AC-56, AC-58a, AC-58b, AC-65a..AC-65d, AC-67, EC-17, UT-7, UT-8, UT-9a, UT-9b, UT-10a, UT-10b, NFR-4, NFR-10a, NFR-10b, NFR-15a..NFR-15c, NFR-16a, NFR-16b, NFR-17, NFR-18 |
| US-11 | AC-59, AC-60a..AC-60c, AC-61, AC-63, NFR-5, NFR-6a, NFR-6b, NFR-7a, NFR-7b, NFR-8 |
| F-1 | AC-18a, AC-18b |
| F-2 | AC-22, EC-11 |
| F-3 | AC-9 |
| F-4 | X-13 |
| F-5 | Q-2 (answered: `specsDir` added to `.claude/sdd.json`) |
| F-6 | AC-27a |
| F-7 | X-13, AC-68..AC-73, EC-10 |
| F-8 | AC-56, EC-17 |
| UX-1..UX-3 | AC-33, AC-20, AC-23a, AC-23b, AC-41b, AC-41c |
| Owner review 2026-11-23 (changes 1–7) | AC-8a, AC-8b, AC-24, AC-26, AC-52..AC-55b, AC-63, AC-64a, AC-64b, AC-65a..AC-65d, AC-66, AC-67, X-16, X-17, UT-7, UT-8, UT-10a, UT-10b, NFR-2, NFR-5, NFR-9, NFR-15a..NFR-15c, NFR-16a, NFR-16b |
| Review round 1 (R-F-1..R-F-21) | R-F-1 → AC-27a, AC-27b · R-F-2 → Problem · R-F-3 → Milestones · R-F-4 → this table · R-F-5 → X-13, AC-71, AC-72 · R-F-6 → AC-68..AC-70, AC-73, EC-10 · R-F-7 → Search index · R-F-8 → Query pipeline, AC-16a..AC-16f · R-F-9 → AC-56, EC-17 · R-F-10 → NFR-16b, Assumptions · R-F-11 → NFR-9 · R-F-12 → AC-63 · R-F-13 → X-16, UT-10a, UT-10b · R-F-14 → all EARS tables · R-F-15 → Assumptions · R-F-16 → Milestones, Testing · R-F-17 → AC-62a · R-F-18 → AC-6b · R-F-19 → X-14, UT-9a · R-F-20 → Compatibility and rollout · R-F-21 → Assumptions, M-2 |

## Open questions

- **Q-1**: How should commands in `commands/` subfolders be named?
  - Default if unanswered: `<sub>:<name>`, checked against the Claude Code docs
    when the first command is added. No commands exist today.
  - Owner: maintainer.

**Answered**

- **Q-2** (answered 2026-11-23): yes. `"specsDir": "docs/specs/"` was added to
  `.claude/sdd.json` together with this spec.
- **Q-3** (answered 2026-11-23): the owner creates the `plugin-request` label by
  hand (see Assumptions).
- **Q-4** (answered 2026-11-23): the footer shows the marketplace
  `metadata.version` as text only (AC-51).

## Revision history

| Date | Change | By |
|---|---|---|
| 2026-11-23 | created (draft) | Claude (main session) |
| 2026-11-23 | Owner review, changes 1–7: "Site" workflow with three jobs; validator-first generator with lenient frontmatter and diagnostics; external `theme-init.js`; `en.ts` with an AST test; CI scoped down (Chromium only, axe matrix, Lighthouse non-blocking, NFR-3 removed, audit as a warning); AC-24/AC-64 empty state; Q-2..Q-4 answered. | Claude (main session) |
| 2026-11-23 | Review round 1, all 21 findings, with the owner's decisions. Split every multi-response row into suffixed IDs (a, b, c…) with one `shall` each, using the declared system names, including the new "the repository". Replaced blacklisted words. Fixed the skill count (12). Per-element plugin-page checks plus `fixture-full`. X-13 precedence, exact-name "added" and rename handling (`Change.renamedTo`, AC-68..AC-73, EC-10). Inherited tags at boost 1, golden queries tuned in M2. Inline stop words, synonyms normalised like the query, `n+1` dropped, multi-word synonyms expand to tokens. Workflow-level concurrency (AC-56, EC-17). Dependabot listed as verified, not a gate. NFR-9 narrowed. AC-63 exceptions. UT-10a/UT-10b warning aligned with X-16. Assumptions verified. AC-7 split across M2/M5. In-process real-catalog tests. 1920 px viewport. AC-6b counts hook objects. Validator exempt in X-14. Rollout defined. M-2 depends on the design. | Claude (main session) |

## Self-check

- [ ] every AC / EC / NFR / UT rule: one EARS pattern, one `shall`, a declared system name as subject, observable response, no blacklisted word (rewritten in review round 1; tick after a clean fresh review)
- [x] every requirement has Priority (ACs) and a concrete Verify by
- [x] every user story has ≥ 1 AC; every AC names its story
- [x] every finding F-n and UX proposal is resolved
- [x] every AC, EC, NFR and UT row is in exactly one milestone and at least one traceability row
- [x] production shows only real plugins (AC-6a, AC-7a, AC-7b); sample data only in test fixtures
- [ ] implementation names appear (Vite, React, MiniSearch, file paths): intentional, the owner asked for architecture and technology in this spec
