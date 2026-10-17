# Releases

How plugin versions reach users, and how to update, roll back, rename or remove
a plugin. Reference:
[Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace),
[Plugin loading](https://code.claude.com/docs/en/plugins/loading).

## How Claude Code picks a version

1. `version` in the plugin's `plugin.json`, else
2. `version` in its marketplace entry, else
3. the git commit SHA of the source.

A user gets an update only when that value changes. **If `version` is not
bumped, users never receive the new commits.**

## Versioning: SemVer

Every plugin sets `"version": "MAJOR.MINOR.PATCH"` in its own `plugin.json`,
never in the marketplace entry (`claude plugin validate` warns about both).

- **MAJOR** — removed or renamed skill, agent or command; changed behaviour
  (e.g. an agent losing write tools).
- **MINOR** — new component or option.
- **PATCH** — fixes and wording.

Rules:

- Any PR that changes files under `plugins/<name>/` bumps that plugin's
  `version` in the same PR. CI enforces it with
  [`scripts/check-version-bump.mjs`](../scripts/check-version-bump.mjs):

  ```bash
  node scripts/check-version-bump.mjs origin/main
  ```

- One bump per PR, even for several commits.
- Never decrease a version.
- Bump dependants' `dependencies` ranges when you make a MAJOR change to a
  plugin they depend on.

### Tags (optional)

Tags are **not** needed for installs or `dependencies` from this catalog.
Verified on 2026-10-17: with no tags in the repository, installing
`django-reviewer@humen-dev` from GitHub resolved its `django-expert ^1.0.0`
dependency from the version in `plugin.json`.

Tag a release only when something has to point at a fixed version, for example
a future stable channel whose entries pin `ref` + `sha`:

```bash
claude plugin tag plugins/<plugin-name> --dry-run
claude plugin tag plugins/<plugin-name> --push
```

Tags look like `<plugin-name>--v<version>`.

## How users receive updates

Verified end to end in our sibling marketplace (minor bump, tag, auto-update,
`/reload-plugins`). Reference:
[When auto-update runs](https://code.claude.com/docs/en/plugins/loading#when-auto-update-runs),
[Keep users up to date](https://code.claude.com/docs/en/plugins/host-marketplace#keep-users-up-to-date).

### Manual update (default)

Auto-update is **off** by default for third-party marketplaces, and
`marketplace.json` has no field to turn it on. Without it, users update with:

```text
/plugin marketplace update humen-dev
```

then `/reload-plugins` (or a new session).

### Enable auto-update

Each user (or org) enables it:

- `/plugin` → Marketplaces → `humen-dev` → Enable auto-update, or
- `"autoUpdate": true` on the marketplace's `extraKnownMarketplaces` entry in
  `~/.claude/settings.json`:

  ```json
  {
    "extraKnownMarketplaces": {
      "humen-dev": {
        "source": { "source": "github", "repo": "humen-dev/agent-plugins" },
        "autoUpdate": true
      }
    }
  }
  ```

  The same entry works in a consumer repo's `.claude/settings.json` (applies
  after the folder is trusted) or in managed settings for the whole org.

### Auto-update is silently blocked by

`DISABLE_AUTOUPDATER`, `DISABLE_UPDATES` or
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. If any is set, the plugin
auto-update pass is off and the `/plugin` toggle is hidden. Some launchers set
`DISABLE_AUTOUPDATER=1` themselves. Override with `FORCE_AUTOUPDATE_PLUGINS=1`,
e.g. in `settings.json`:

```json
{ "env": { "FORCE_AUTOUPDATE_PLUGINS": "1" } }
```

### Timing

- The check runs only in an interactive session, after the first message,
  after a random delay of up to 10 minutes.
- "Plugin updated … Run /reload-plugins to apply" is a transient footer toast,
  not a transcript line — easy to miss.
- The running session keeps the old version until `/reload-plugins`; new
  sessions load the new one.
- Old cached versions are removed 14 days after update.
- `claude plugin list --json` shows the active `version` of each plugin.

## Rollback

Revert the change on `main` **and bump the version forward** (e.g. 1.4.0 →
1.4.1). Never decrease a version — clients will not "update" to a lower one.
The revert PR goes through the normal checks.

## Rename or remove a plugin

The catalog is append-only from the user's point of view.

- **Rename:** add the new entry, remove the old one, and map it in the
  top-level `renames` object of `marketplace.json`:

  ```json
  "renames": { "old-name": "new-name" }
  ```

- **Remove:** delete the entry and map it to `null` in `renames`. Set
  `"forceRemoveDeletedPlugins": true` only if installed copies must be
  uninstalled.

Update any `dependencies` and `skills:` preloads that used the old name.

## Planned automation

Not built yet:

- [ ] `scripts/bump-version.mjs <plugin> patch|minor|major` — bumps `version`
  in `plugin.json` and runs the validators.
- [ ] Auto-tag workflow — on push to `main`, run `claude plugin tag --push`
  for every plugin whose `version` changed.
- [ ] Plugin evals (`claude plugin eval`) as a release gate.

## Release checklist

- [ ] `node scripts/validate-marketplace.mjs` passes.
- [ ] `node scripts/check-version-bump.mjs origin/main` passes.
- [ ] `claude plugin validate . --strict` passes.
- [ ] Installed locally from `./` and tried in a session.
- [ ] Plugin README and the root README plugin table are updated.
- [ ] Tag pushed after merge (only if a channel or pin needs it).
