# spec-creator

A **behaviour specification agent** for spec-driven development, in any
repository and any tech stack. It turns a feature request and its designs into
a testable spec — **what** the system must do and how to tell that it does,
never **how** it is built. Project specifics come only from the repository
(`CLAUDE.md` / `AGENTS.md`, existing specs, code) and an optional
`.claude/sdd.json`.

| Component | Type | Invoke as |
|---|---|---|
| `spec-creator` | agent | `spec-creator:spec-creator` |
| `specify` | skill (command) | `/spec-creator:specify <arguments>` |
| `ears-requirements` | skill (preloaded) | `spec-creator:ears-requirements` |
| `untrusted-input-threats` | skill (preloaded) | `spec-creator:untrusted-input-threats` |
| `mermaid-diagram` | skill (preloaded) | `spec-creator:mermaid-diagram` |
| `write-guard` | `PreToolUse` hook | — |
| `templates/spec.md` | spec template | used when the project has none |

No MCP servers.

## Usage

```text
/spec-creator:specify CSV export of the orders list
/spec-creator:specify approve SPEC-07
/spec-creator:specify supersede specs/2026-10-04-orders-export.md add XLSX format
```

`specify` invokes the agent, runs its research requests as parallel
subagents, asks you its questions and re-invokes it until the spec is
written. Other modes: `revise <spec path>`, `implemented SPEC-NN`. You can also
ask for the agent by name.

## How it works

1. **Spec review first.** The agent reads the project's agent docs, existing
   specs, the code the feature touches and every design source, then replies
   with findings, UX proposals, optional research requests and questions (with
   options and defaults). No file is written yet.
2. **Research requests** are returned to the main session, which runs them
   with whatever research mechanism it has and re-invokes the agent with the
   reports.
3. **Spec file.** After the answers it writes
   `<specs dir>/YYYY-MM-DD-<slug>.md` with a global `SPEC-NN` id, EARS
   acceptance criteria (priority + verification method), edge cases, a module
   interactions diagram, NFRs, untrusted-input rules, traceability and a
   self-check, `Status: draft`, and adds an index line to the folder's
   `README.md`.
4. **Status changes** (`approve SPEC-NN`, `implemented SPEC-NN`,
   `supersede <path>`) happen only on the user's explicit instruction. After
   approval the spec goes to the project's planning step.

- **Tools:** `Read`, `Grep`, `Glob`, `Write`, `Edit`, `WebSearch`, `WebFetch`.
  `Bash`, `PowerShell`, `NotebookEdit`, `Agent` and `Skill` are disallowed.
- **Model:** `inherit` (the caller's model).

## Project configuration (optional)

`.claude/sdd.json` at the project root. Every key is optional; keys this
plugin does not read are ignored.

| Key | Default | Meaning |
|---|---|---|
| `specsDir` | `specs/` | root spec folder (cross-module specs, global id scan) |
| `specTemplate` | none → the bundled `templates/spec.md` structure | project spec template; the agent never edits it |
| `modules` | `[{ "name": "root", "path": "." }]` | module names and paths; a module may set its own `specsDir` |
| `agentDocs` | `["AGENTS.md", "CLAUDE.md"]` | agent docs read if present |

```json
{
  "specsDir": "docs/specs/",
  "modules": [
    { "name": "api", "path": "services/api", "specsDir": "services/api/specs/" },
    { "name": "web", "path": "apps/web" }
  ]
}
```

## What it runs

### write-guard

Runs `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-guard.mjs"` before every
`Write` and `Edit` call. It acts only when `agent_type` is exactly
`spec-creator:spec-creator`; the main session and every other agent pass
through untouched (exit 0, no output). For spec-creator it allows only `*.md`
files inside `specsDir` or a module's `specsDir`, never the spec template or a
`_TEMPLATE.md`, and never a path outside the project. It fails closed: an
unreadable payload, a missing `file_path` or a malformed `.claude/sdd.json`
blocks the write with the reason on stderr. It reads only the hook payload and
`.claude/sdd.json`; no network, no writes.

Tests: `node --test plugins/spec-creator/scripts/write-guard.test.mjs`.

## Install

Inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install spec-creator@humen-dev
```

or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install spec-creator@humen-dev
```

The marketplace is private; see the [root README](../../README.md#install) for
git credential setup.

## Requirements and dependencies

- No plugin dependencies.
- Node.js on `PATH` for the `write-guard` hook.

## Credits

Ported from humen-dev's earlier spec-driven development plugins (first-party
content, no third-party licence applies), with stack-specific names removed. EARS: Mavin et al., RE'09 — see
`skills/ears-requirements/references.md`.
