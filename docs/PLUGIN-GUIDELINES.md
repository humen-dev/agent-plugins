# Plugin guidelines

Rules for every plugin in this marketplace. Reference:
[Plugins reference](https://code.claude.com/docs/en/plugins/manifest-reference),
[Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference).
Workflow and checks: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Layout

```text
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json          # ONLY the manifest lives here
├── skills/<skill>/SKILL.md  # one folder per skill, optional references/
├── agents/<agent>.md
├── commands/<command>.md
├── hooks/hooks.json         # top-level "hooks" key
├── scripts/                 # helpers called by hooks
├── .mcp.json
├── README.md                # required
└── THIRD_PARTY_NOTICES.md   # required for copied content
```

Components (`skills/`, `agents/`, `commands/`, `hooks/`, …) sit at the
**plugin root**, never inside `.claude-plugin/`. Plugins with hooks, MCP
servers or scripts follow [SECURITY.md](SECURITY.md); `spec-creator` is the
first one with a hook and Node scripts.

## Naming

- kebab-case: letters, digits, `-`; start with a letter or digit.
- Names describe the capability, not a project (e.g. `django-safe-migration`).
- Forbidden prefixes: `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`.
- The `name` in `plugin.json` **must equal** the `name` of its entry in
  `.claude-plugin/marketplace.json`. The linter enforces this.
- Components are namespaced by plugin: skill `django-expert` in plugin
  `django-expert` is `django-expert:django-expert`.
- A plugin name is permanent once published. To rename, see
  [RELEASES.md](RELEASES.md#rename-or-remove-a-plugin).

## Manifest (`plugin.json`)

Minimum:

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "One sentence: what it adds and when to use it.",
  "author": { "name": "humen-dev" },
  "repository": "https://github.com/humen-dev/agent-plugins",
  "keywords": ["example"]
}
```

- `version` is **required** and lives in `plugin.json` only. Bump it in every
  PR that touches the plugin — see [RELEASES.md](RELEASES.md).
- Copied plugins keep the original `author`, `homepage`, `repository` and
  `license`.
- Declare plugins this one needs in `dependencies` with a SemVer range:

  ```json
  "dependencies": [{ "name": "django-expert", "version": "^1.0.0" }]
  ```

- Do not list `skills`/`commands`/`agents` paths unless you need a non-default
  location: `commands` and `agents` **replace** the default folder scan.
- Component paths start with `./`, use forward slashes, and never contain `..`.

## Marketplace entry

Append to `plugins[]` in `.claude-plugin/marketplace.json`:

```json
{
  "name": "example-plugin",
  "source": "./plugins/example-plugin",
  "description": "Same sentence as plugin.json.",
  "category": "backend"
}
```

No `version` here.

## Self-contained plugins

Installed plugins are **copied** to `~/.claude/plugins/cache/…`. Anything
outside the plugin folder is not copied.

- Never reference `../` or files elsewhere in this repo or in another project.
- Reference plugin files via `${CLAUDE_PLUGIN_ROOT}` (quoted).
- Persistent state goes to `${CLAUDE_PLUGIN_DATA}`; `${CLAUDE_PLUGIN_ROOT}`
  changes on every update.
- No Git LFS: clones receive pointer files, not content.
- To share a file between plugins, use a symlink inside this marketplace (it is
  dereferenced on install). On Windows symlinks need Developer Mode.
- Need another plugin's skill? Declare it in `dependencies`; do not copy it.

## Skills

- Each `SKILL.md` has YAML frontmatter with `name` and a `description` that
  states **when** to use it (that is what triggers it).
- Skills live at `skills/<name>/SKILL.md` — a `SKILL.md` at the plugin root
  turns the whole plugin into a single skill.
- Do not hard-code paths of any specific project; describe paths relative to
  the user's project or read them from the caller's prompt.

## Agents

- Declare `tools` (allow-list) and, where useful, `disallowedTools` in the
  frontmatter. Grant only what the agent needs.
- **Reviewers are read-only**: no `Write`, `Edit`, `NotebookEdit`; Bash only
  for read-only commands, stated in the agent body. They return findings and
  suggested changes; the caller applies fixes.
- Plugin agents **ignore** `hooks`, `mcpServers`, `permissionMode` and
  `initialPrompt` frontmatter — do not rely on them.
- Preload a skill from another plugin with its namespaced name and declare
  that plugin in `dependencies`:

  ```yaml
  skills:
    - django-expert:django-expert
  ```

## Hooks

- `hooks/hooks.json` must have a top-level `"hooks"` object.
- Call scripts through an interpreter so the execute bit does not matter:
  `bash "${CLAUDE_PLUGIN_ROOT}/scripts/check.sh"` or
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs"`.
- Prefer Node scripts: they behave the same on Windows, macOS and Linux.
- Shell scripts must use LF line endings (`.gitattributes` enforces it).
- Follow [SECURITY.md](SECURITY.md).

## Plugin README

Every plugin has a `README.md` with: what it adds (list of skills / agents /
commands / hooks), install command (`/plugin install <name>@humen-dev`),
dependencies, requirements (tools, env vars), and credits for copied content.

If the plugin has hooks, MCP servers or env vars, describe them in a section
named exactly `## What it runs`, with one `### <name>` sub-heading per item:
the hook's script basename, the MCP server key from `.mcp.json`, or the env var
name. The first paragraph says what runs and any advice config cannot express:

```markdown
## What it runs

### check-migrations

Runs `python manage.py makemigrations --check` after edits to `models.py`.

### DATABASE_URL

Use a read-only role: the server can run any query the role allows.
```

## Evals

Plugin evals (`claude plugin eval`) are planned, not required yet.

## Before opening a PR

Run the checks in [CONTRIBUTING.md](../CONTRIBUTING.md#checks), install the
plugin from `./`, and try each component in a real Claude Code session.
