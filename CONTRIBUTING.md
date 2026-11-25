# Contributing

Plugins for the `humen-dev` marketplace live in `plugins/<name>/` and are listed
in `.claude-plugin/marketplace.json`. Read
[docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) before adding or
changing one.

## Add a plugin

1. Create `plugins/<plugin-name>/` following
   [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md):
   `.claude-plugin/plugin.json` with `"version": "1.0.0"`, components at the
   plugin root, and a `README.md`.
2. Append an entry to `plugins[]` in `.claude-plugin/marketplace.json` with the
   **same** `name` and `"source": "./plugins/<plugin-name>"`. Do not put
   `version` in the entry.
3. Add a row to the plugin table in the root [README.md](README.md).
4. Run the [checks](#checks) and try the plugin locally.
5. Open a PR; the template has the full checklist.

## Change a plugin

- Edit files under its folder. With the local marketplace installed, run
  `/reload-plugins` to pick up changes without reinstalling.
- **Bump `version` in the plugin's `plugin.json` in the same PR** — any change
  under `plugins/<name>/` needs it, including docs and wording. CI rejects the
  PR otherwise. See [docs/RELEASES.md](docs/RELEASES.md).
- Changes to hooks, scripts or `.mcp.json` follow
  [docs/SECURITY.md](docs/SECURITY.md) and need a code-owner review.

## Checks

Run from the repository root before opening a PR (CI runs the same):

```bash
node scripts/validate-marketplace.mjs
node scripts/check-version-bump.mjs origin/main
node --test $(find plugins -name '*.test.mjs')
claude plugin validate . --strict
```

- [`scripts/validate-marketplace.mjs`](scripts/validate-marketplace.mjs) —
  catalog shape, names and sources.
- [`scripts/check-version-bump.mjs`](scripts/check-version-bump.mjs) — every
  plugin changed against the base branch has a higher `version`.
- `node --test` — every `*.test.mjs` under `plugins/` (hook and script
  tests).

## Try it locally

```bash
claude plugin marketplace add ./
claude plugin install <plugin-name>@humen-dev
```

Then, inside Claude Code, `/reload-plugins` after each edit and exercise every
component you touched in a real session.

## Catalog rules

- `marketplace.json` is effectively **append-only** for users: never reuse or
  silently change a published plugin name.
- Rename or remove a plugin only through `renames`
  ([docs/RELEASES.md](docs/RELEASES.md#rename-or-remove-a-plugin)).
- Keep `version` in `plugin.json` only, never in the marketplace entry.
- No files from outside a plugin's folder, no Git LFS.

## Third-party content

- Copy third-party skills and agents unchanged where possible, and keep their
  license and attribution in a `THIRD_PARTY_NOTICES.md` **inside the plugin
  folder** (installed plugins only get files from their own folder).
- Keep `author`, `homepage`, `repository` and `license` in `plugin.json`
  pointing at the original source.
- Adaptations (read-only agents, cross-plugin `skills:` preloads, fixes) are
  normal changes and get a version bump.

## Catalog site

The site at <https://humen-dev.github.io/agent-plugins/> rebuilds and deploys
(workflow "Site") on every merge to `main` that touches `plugins/**`,
`.claude-plugin/**`, `site/**`, `scripts/validate-marketplace.mjs` or
`.github/workflows/site.yml`.

Local commands, from the repository root:

```bash
cd site
npm ci
node scripts/generate.mjs --out src/generated/catalog.json --repo humen-dev/agent-plugins  # same as: npm run generate
npm run dev        # dev server
npm run build      # production build into site/dist
npm run preview    # serve the build at http://localhost:4173/agent-plugins/
npm run check      # lint, typecheck, unit tests
npx playwright install chromium
npm run e2e        # browser tests
```

## Commits and PRs

- Short imperative subject, scoped by plugin when relevant:
  `django-reviewer: make the agent read-only`.
- One topic per PR. Fill in the
  [PR template](.github/pull_request_template.md).
- [`CODEOWNERS`](CODEOWNERS) requires an owner review for the catalog, hooks,
  MCP config, CI and scripts.
