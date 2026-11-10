# spec-driven

The **spec-driven development workflow** for any repository and any tech
stack: specify, then plan, implement and verify against the spec.

| Step | Component | Status |
|---|---|---|
| specify | `spec-creator` agent · `/spec-driven:specify` | available |
| plan | — | planned |
| implement | — | planned |
| verify | — | planned |

## specify

The `spec-creator` agent turns a feature request and its designs into
a testable spec — **what** the system must do and how to tell that it does,
never **how** it is built. Project specifics come only from the repository
(`CLAUDE.md` / `AGENTS.md`, existing specs, code) and an optional
`.claude/sdd.json`.

| Component | Type | Invoke as |
|---|---|---|
| `spec-creator` | agent | `spec-driven:spec-creator` |
| `specify` | skill (command) | `/spec-driven:specify <arguments>` |
| `ears-requirements` | skill (preloaded) | `spec-driven:ears-requirements` |
| `untrusted-input-threats` | skill (preloaded) | `spec-driven:untrusted-input-threats` |
| `mermaid-diagram` | skill (preloaded) | `spec-driven:mermaid-diagram` |
| `write-guard` | `PreToolUse` hook | — |
| `templates/spec.md` | spec template | used when the project has none |

No MCP servers.

## Usage

```text
/spec-driven:specify CSV export of the orders list
/spec-driven:specify review specs/2026-10-04-orders-export.md
/spec-driven:specify approve SPEC-07
/spec-driven:specify supersede specs/2026-10-04-orders-export.md add XLSX format
```

`specify` invokes the agent, runs its research requests as parallel
subagents, asks you its questions and re-invokes it until the spec is
written. Every written draft then gets a **fresh, read-only review** by a new
agent invocation (`review` mode); blocking and should-fix findings go into a
revise round, and `approve` is suggested only once you accept what is left.
`review <spec path>` runs that review on any spec by hand. Other modes: `revise <spec path>`, `implemented SPEC-NN`. You can also
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
4. **Review.** `review <spec path>` re-reads the spec and every file it cites
   in a fresh context and returns findings (`R-F-n`, blocking / should fix /
   minor, evidence, proposed fix) without writing anything.
5. **Status changes** (`approve SPEC-NN`, `implemented SPEC-NN`,
   `supersede <path>`) happen only on the user's explicit instruction. After
   approval the spec goes to the project's planning step.

- **Tools:** `Read`, `Grep`, `Glob`, `Write`, `Edit`, `WebSearch`, `WebFetch`.
  `Bash`, `PowerShell`, `NotebookEdit`, `Agent` and `Skill` are disallowed.
- **Model:** `opus` by default. The spec is the source every later step
  builds and tests against, so a missed gap or a weak requirement costs more
  downstream than the extra model cost here. `specify` never overrides it; to
  change it, edit `model:` in `agents/spec-creator.md`.

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
`Write` and `Edit` call. It holds a map from full agent name to a write rule;
today the only entry is
`spec-driven:spec-creator`; the main session and every other agent pass
through untouched (exit 0, no output). For spec-creator it allows only `*.md`
files inside `specsDir` or a module's `specsDir`, never the spec template or a
`_TEMPLATE.md`, and never a path outside the project. It fails closed: an
unreadable payload, a missing `file_path` or a malformed `.claude/sdd.json`
blocks the write with the reason on stderr. It reads only the hook payload and
`.claude/sdd.json`; no network, no writes.

Tests: `node --test plugins/spec-driven/scripts/write-guard.test.mjs`.

## Evals

`evals/time-data-readiness/` checks lens F (time and data readiness): a digest
scheduled at 06:00 over data imported at 09:00 must raise that the input is
not complete at the trigger time and must not default to 06:00 without a
reason. It runs the agent on your machine and costs tokens; run it from the
repository root with:

```bash
claude plugin eval plugins/spec-driven --case time-data-readiness
```

## Install

Inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install spec-driven@humen-dev
```

or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install spec-driven@humen-dev
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
