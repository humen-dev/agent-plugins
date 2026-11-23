# Design brief: marketplace catalog site

Input for the visual design of the catalog site specified in
[SPEC-01](../specs/catalog-site.md) (approved 2026-11-23). The design tool cannot
read this repository, so this brief and
[`catalog-sample.json`](./catalog-sample.json) contain everything the design
needs. Where they disagree, the spec wins.

## 1. What the site is

A public catalog of the `humen-dev` Claude Code plugin marketplace, at
`https://humen-dev.github.io/agent-plugins/`. People use it to:

- find a plugin, skill, agent or hook by describing a task in plain words;
- see what a plugin adds and what it **runs** on their machine before
  installing it;
- copy install commands for one plugin, or for a set of plugins.

There are no accounts, ratings, comments or analytics. The site only shows
commands to copy; it never installs anything.

## 2. Data to use

Use only the real data in `catalog-sample.json`, generated from the repository
at commit `4a1ea6b` on 2026-11-23. Do not invent plugins, versions, counts,
ratings, download numbers or reviews.

| What | Real value |
|---|---|
| Plugins | 8: cdrf-expert, codebase-onboarding, django-celery-expert, django-expert, django-reviewer, django-safe-migration, research-tools, spec-driven |
| Artifacts | 12 skills, 6 agents, 2 hooks, 0 commands, 0 MCP servers |
| Categories | backend (5 plugins), productivity (1), workflow (2) |
| Most frequent tags | backend, django, python (5 each), read-only, agent (3 each) |
| Plugins that run code | spec-driven (hooks · scripts · agent with shell access), django-reviewer (agent with shell access) |
| Third-party notices | 5 plugins (the Vinta Software ones) |
| History | 33 change entries (added, version, change) |

The richest plugin is **spec-driven**: 7 skills, 4 agents, 2 hooks, 4 scripts
and a "What it runs" README section. Most others hold a single skill or agent.

Real text is long. For example, spec-driven's description is about 1,100
characters, and skill descriptions run 218 to 719 characters. The
`/spec-driven:plan` argument hint is a single line of 107 characters.
Design for these lengths, not for short placeholder text.

## 3. Constraints

- **Static site** on GitHub Pages. There is no server: everything comes from
  one catalog bundled with the site.
- **Hash routes**: URLs look like `…/agent-plugins/#/plugins/spec-driven`.
  Search state is in the URL (`#/?q=…&kind=skill&cat=backend`), so any view can
  be shared as a link.
- **React** implementation (Vite + TypeScript). Design in components, using
  the inventory in §6.
- **Strict Content-Security-Policy**: no inline scripts, no third-party fonts,
  images, icons, analytics or embeds from other origins. Fonts and icons must
  be self-hosted (bundled) or system fonts, and must stay small. The budget is
  ≤ 120 KB gzip of JavaScript in total, so plan for an icon set of a few dozen
  SVGs, not an icon font.
- **No images from content**: Markdown images are shown as a link (or plain alt
  text), never loaded.
- **Translations**: every UI string will live in one translations file. Keep
  text out of images and icons. Leave room for labels about 30% longer than
  English.
- **Theme**: dark first, with a light toggle (§5).
- **Widths**: 320–1920 px, with no horizontal page scroll at any width. Mobile
  layout is 320–767 px; desktop is 768 px and up. Show both for every screen.

## 4. Accessibility targets (from the spec)

- **Standard**: WCAG 2.2 AA, with 0 serious or critical axe violations on
  every route, in both themes, at 375 and 1280 px.
- **Contrast**: text ≥ 4.5:1. Large text and UI boundaries (inputs, chips,
  cards, focus rings) ≥ 3:1. This applies in both themes.
- **Focus**: every interactive element has a visible focus indicator with
  ≥ 3:1 contrast against its background. Design the focus state of every
  component.
- **Keyboard**: everything works by keyboard. `/` focuses the search box and
  `Esc` clears it. Show a small keyboard hint near the search box.
- **Screen readers**: the result count is announced ("12 results"). Every
  icon-only button needs a visible tooltip or label text in the design.
- **Reduced motion**: with `prefers-reduced-motion`, animations and
  transitions are off. Do not depend on motion to convey state.
- **Colour**: never the only signal. Kind badges and change types also carry
  a text label or an icon.

## 5. Theme

- **Dark is the default** on a first visit, whatever the OS setting. The
  header toggle switches to light, and the choice is remembered.
- The toggle is a button with an accessible name and a pressed state. Design
  both themes for every screen, not just one.
- Colours come from tokens (CSS custom properties). Deliver tokens, not
  hard-coded colours:

  | Token group | Needed |
  |---|---|
  | Surfaces | page background, raised surface (cards), sunken surface (code boxes), overlay (mobile filter panel) |
  | Text | primary, secondary, muted, on-accent, link, link-visited |
  | Lines | border, divider, focus ring |
  | Accent | primary action, hover, pressed |
  | Kind colours | plugin, skill, agent, hook (command and mcp reserved: none exist yet) |
  | Status | warning (Runs code, missing dependency), success ("Copied"), error (catalog error), info (neutral notices) |
  | Change types | added, version, change |
  | Highlight | `<mark>` background for matched search terms |
  | Code | monospace text and background, for commands and paths |

## 6. Components

| Component | Used on | Notes |
|---|---|---|
| Header | all | site name, Search link, "Install set (n)" with count, What's new, Request a skill (external link), GitHub link, theme toggle. On mobile it collapses to a menu. |
| Footer | all | marketplace name `humen-dev`, marketplace version `1.0.0` as text, "built from 4a1ea6b on 2026-11-23" (short sha links to the commit), repo link, Request a skill link |
| Search box | home | large, with placeholder, clear button, `/` hint, and a polite result count below |
| Filter chips | home | two groups: Kind (Plugin, Skill, Agent, Hook) and Category (backend, productivity, workflow). Multi-select, each with a count. States: default, hover, selected, focus, disabled at count 0. |
| Filter toggle | home, < 768 px | opens the filter chips in a panel; shows the number of active filters |
| Result card | home | §7.2 |
| Kind badge | cards, pages | text + colour + optional icon; a combined form `skill · plugin` for merged cards |
| Runs-code badge | cards, plugin header, What it runs | warning style, names its reasons: hooks · scripts · agent with shell access |
| Command box | cards, plugin page, artifact page, install set | monospace, one line, scrolls horizontally inside the box, copy button. States: idle, "Copied" (2 s), copy failed (text selected + hint "press Ctrl/Cmd+C"). |
| Tag chip | plugin page, empty state | clickable, starts a search |
| Breadcrumb | artifact page | plugin › kind › name |
| Facts table | plugin and artifact pages | label/value rows; on mobile stacked rows |
| Data table | What it runs, artifact list, frontmatter | on mobile reflows to stacked cards, never side-scrolls the page |
| Collapsible section | notices, supporting files | header with chevron, collapsed by default for notices |
| Markdown block | README, notices, skill and agent bodies | headings, lists, tables, inline code, fenced code (Mermaid shown as code), links. External links get an "opens on GitHub" icon. |
| Change row | plugin page, what's new | type badge, plugin (link, or plain text for an old name), subject, short sha link, date |
| Day group header | what's new | UTC date `YYYY-MM-DD` |
| Checkbox list | install set | one row per plugin, with an "added for <plugin>" label on auto-added rows |
| Segmented control | install set | scope: User / Project |
| Warning notice | install set, plugin page | a dependency not in this marketplace; a removed plugin dropped from a shared selection |
| Skeleton card | home | loading |
| Empty / error / not-found panels | home, any route | §7.10 |

## 7. Screens and states

Design every screen at a mobile width (375 px, checked at 320) and at desktop
(1280 px, checked at 1920), in both themes.

### 7.1 Search home `#/`

| State | Content |
|---|---|
| Empty query, no filter | every plugin card (8), sorted by name; filter chips with total counts (Plugin 8, Skill 12, Agent 6, Hook 2; backend, productivity, workflow) |
| Typing | results update 120 ms after the last keystroke; the count line updates; no spinner for typing |
| Results | ranked cards. Real example query: "I need a skill for safe migrations" → top card skill `django-safe-migration` (merged with its plugin, label `skill · plugin`). Matched words ("safe", "migrations") are highlighted in name and description. |
| Filters with facet counts | e.g. Kind = Skill selected: only skills listed; the Agent and Hook chips still show their counts for the current query (each group's counts ignore that group's own selection). Selected chips are clearly marked. |
| Query is only filler words | "I need a skill" behaves as an empty query with the Skill chip selected: every skill, sorted by name |
| Empty query, filters active | every item that passes the filters, sorted by name (e.g. `#/?kind=hook` shows the 2 hooks) |
| Empty result | message "nothing matched"; up to 5 tag chips (backend, django, python, read-only, agent); a "Request it" link; with filters active also a "Clear filters" button. Example query: "kubernetes helm chart". |
| Loading | skeleton cards in the result list; header, search box and chips already visible |
| Error | the catalog failed to load: an error panel with a message and a Retry button (reloads the page) |
| Mobile | search box full width; filters behind the filter toggle; cards in one column |

### 7.2 Result card

Elements in this order. Design one card per kind, plus a merged card.

1. Kind badge (plugin · skill · agent · hook; merged: `skill · plugin`).
2. Name, linking to its page.
3. Plugin name, linking to the plugin page (artifact cards only).
4. Category.
5. Description, cut to 160 characters with "…". Matched terms are highlighted.
   When the match is only in the body, a snippet of up to 160 characters
   replaces the description, with its source file name, e.g. "in
   references/postgres-locks.md".
6. "Runs code" badge with its reasons, when the plugin runs code (e.g.
   spec-driven: hooks · scripts · agent with shell access).
7. `invokeAs` for skills and agents, e.g. `/spec-driven:specify` or
   `django-reviewer:django-reviewer`.
8. Command box: `claude plugin install <plugin>@humen-dev` with copy button.

Real examples: plugin card `spec-driven` (long description, Runs code with 3
reasons); skill card `spec-driven/plan` (user-invoked only, long argument
hint); agent card `django-reviewer` (Runs code: agent with shell access); hook
card `spec-driven/bash-guard` (no invokeAs).

### 7.3 Plugin page `#/plugins/<name>`

Design two real plugins: **spec-driven** (hooks, scripts, 13 artifacts, What it
runs, no notices, no dependencies) and **django-reviewer** (notices, homepage,
3 dependencies, agent with shell access, no hooks). Also design
**codebase-onboarding** to show the omitted sections. Elements whose data is
missing are left out; they are not shown empty.

1. **Header**: name, version, category, author with link (Vinta Software has a
   URL; humen-dev has none), license, last updated date, Runs-code badge with
   reasons.
2. **Install box**: `claude plugin marketplace add humen-dev/agent-plugins` and
   `claude plugin install <name>@humen-dev`, each copyable; an "Add to install
   set" button.
3. **Summary**: one paragraph from the README.
4. **Artifacts table**: kind, name, invokeAs, description, link. For
   spec-driven: 7 skills, 4 agents, 2 hooks.
5. **Dependencies**: links to other plugins; one not in this marketplace is
   plain text marked "not in this marketplace". django-reviewer: django-expert,
   django-celery-expert, cdrf-expert (`^1.0.0`).
6. **What it runs** (§7.4).
7. **README**, rendered Markdown.
8. **Third-party notices**, collapsed by default (5 Vinta plugins).
9. **Recent changes**: up to 10 change rows. Version changes read
   "1.2.0 → 1.3.0". Changes from before a rename show the old name
   (`spec-creator`) as plain text.
10. **Links**: source on GitHub, homepage, repository.

### 7.4 What it runs (section of the plugin page)

The most trust-critical part of the site. It shows only data copied from the
plugin's files and never claims "safe" or "no network".

- **Reasons line**: the Runs-code badge and its reasons.
- **Hooks table**: event, matcher, type, command (monospace, verbatim),
  timeout, and description. spec-driven has two:

  | Hook | Event | Matcher | Command | Timeout |
  |---|---|---|---|---|
  | write-guard | PreToolUse | `Write\|Edit` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-guard.mjs"` | 10 s |
  | bash-guard | PreToolUse | `Bash` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/bash-guard.mjs"` | 10 s |

- **Scripts**: path, source link, and the hooks whose command names it.
  spec-driven: `scripts/write-guard.mjs` ← write-guard, `scripts/bash-guard.mjs`
  ← bash-guard, and `scripts/lib/guard-io.mjs` and `scripts/lib/sdd-config.mjs`,
  both labelled "not named in a hook command".
- **Agents**: model, tools, disallowed tools. An agent without a tools list
  shows "not declared: inherits the session's tools" (no real case yet; design
  it anyway).
- **MCP servers** table: none exist yet. Design the table, but it is hidden when
  empty.
- **Author's description**: the README's "What it runs" text, under that
  label.
- **Nothing measured**: for a plugin with no hooks, MCP servers or scripts, the
  sentence "This plugin ships no hooks, MCP servers or scripts." django-reviewer
  shows this sentence *and* a Runs-code badge (agent with shell access). Design
  that combination explicitly.

### 7.5 Artifact pages `#/plugins/<plugin>/<kind>/<name>`

One design per kind present: skill, agent and hook. Command and MCP pages
follow the skill and hook layouts.

Common elements: breadcrumb, kind badge, description, invokeAs, facts table,
"All frontmatter" table (every key, verbatim), the plugin's install command
box, rendered body, and a source link.

| Kind | Real example | Specific elements |
|---|---|---|
| Skill | `django-safe-migration` | 3 supporting files (examples, operation guide, postgres-locks), each a collapsible section |
| Skill (user-invoked) | `spec-driven/plan` | "User-invoked only" fact; long argument hint |
| Agent | `django-reviewer` | model `opus`; tools Read, Grep, Glob, Bash, Skill; disallowed tools; preloaded skills as links |
| Hook | `spec-driven/bash-guard` | typed fields instead of a body: event, matcher, type, command, timeout, scripts, defined in `hooks/hooks.json` |

### 7.6 Install-set builder `#/install`

- **Selection**: a checkbox per plugin (8 rows). Selecting django-reviewer also
  adds django-expert, django-celery-expert and cdrf-expert, each marked "added
  for django-reviewer".
- **Scope**: a segmented control, User / Project.
- **Output A, CLI**: the marketplace-add line followed by one
  `claude plugin install <p>@humen-dev` per plugin, sorted. With Project scope,
  each line ends in ` --scope project`. A copy button copies all lines.
- **Output B, settings**: a JSON snippet for `.claude/settings.json`:

  ```json
  {
    "enabledPlugins": {
      "cdrf-expert@humen-dev": true,
      "django-celery-expert@humen-dev": true,
      "django-expert@humen-dev": true,
      "django-reviewer@humen-dev": true
    },
    "extraKnownMarketplaces": {
      "humen-dev": { "source": { "source": "github", "repo": "humen-dev/agent-plugins" } }
    }
  }
  ```

- **States**: empty selection (prompt to pick plugins); a shared link with a
  selection (`#/install?p=…`); a notice when a shared selection names a removed
  plugin; a warning for a dependency that is not in this marketplace.

### 7.7 What's new `#/new`

- Change rows grouped by UTC day (`YYYY-MM-DD`), newest first.
- Each row: a type badge (added / version from → to / change), plugin (link, or
  plain text for an old name), commit subject as plain text, and a short sha
  linking to the commit.
- An optional plugin filter at the top.
- Real data: e.g. 2026-11-19, spec-driven `1.2.0 → 1.3.0` "feat(plan-verifier):
  wave 1 — U1, U2, U3, U4"; 2026-11-10 "added spec-driven"; older "added"
  entries for the five Vinta plugins.

### 7.8 Not-found

An unknown route, plugin or artifact: a short message and a link back to
search.

### 7.9 Global header and footer

See §6. Show the header with the install-set count at 0 and at 4. Show the
mobile menu open.

### 7.10 Empty, loading and error panels

- **Empty result**: §7.1.
- **Loading**: skeleton cards.
- **Error**: an icon, a message, and a Retry button.
- **Not-found**: §7.8.
- **No JavaScript**: a plain message with links to the repository and README.
  It cannot use the design system's components; plain text is enough.

## 8. Fixed UI wording

These labels come from the spec. Use them verbatim. Final strings go to the
translations file.

- "Runs code" · reasons: "hooks", "MCP servers", "scripts", "agent with shell
  access" (or "skill with shell access" / "command with shell access")
- "This plugin ships no hooks, MCP servers or scripts."
- "not declared: inherits the session's tools"
- "not named in a hook command"
- "Author's description"
- "not in this marketplace"
- "added for <plugin>"
- "Copied" · "press Ctrl/Cmd+C"
- "User-invoked only"
- "This plugin adds no skills, agents, commands, hooks or MCP servers"
- "Clear filters" · "Retry" · "Request it"

## 9. Deliverables

1. Both themes for every screen and state in §7, at 375 px and 1280 px.
2. The component set from §6, with all states: default, hover, focus, active,
   disabled, selected, loading where it applies.
3. Theme tokens (§5) for dark and light, with contrast ratios noted for the
   text and boundary pairs.
4. Type scale and spacing scale, with the font choice (system or self-hosted).
5. The icon list used, as SVG.
