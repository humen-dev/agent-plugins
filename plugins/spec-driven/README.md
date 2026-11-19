# spec-driven

The **spec-driven development workflow** for any repository and any tech
stack: specify, then plan, implement and verify against the spec.

| Step | Component | Status |
|---|---|---|
| specify | `spec-creator` agent · `/spec-driven:specify` | available |
| plan | `planner` agent · `/spec-driven:plan` | available |
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
   reports. `specify` uses `research-tools:researcher` when that plugin is
   installed (optional, not a dependency), otherwise the built-in agents.
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

## plan

The `planner` agent turns agreed requirements (an approved `SPEC-NN` spec, a
design brief or a concrete request) into an implementation plan — **how** to
build it: contracts, work units, waves, tests and risks. It never writes code
or specs.

| Component | Type | Invoke as |
|---|---|---|
| `planner` | agent | `spec-driven:planner` |
| `plan` | skill (command, manual only) | `/spec-driven:plan <arguments>` |
| `templates/plan.md` | plan template | passed to the agent by `/spec-driven:plan` |

### Usage

```text
/spec-driven:plan SPEC-07
/spec-driven:plan specs/2026-10-04-orders-export.md
/spec-driven:plan add a retry limit to the import job
/spec-driven:plan gap docs/plans/orders-export.md
SPEC-07 AC-3
SPEC-07 EC-2
```

`plan` invokes the agent, asks you its Requirements review questions one
decision per question (the agent's default marked "(Recommended)" with its
reason), re-invokes it with your answers and the execution mode, and shows its
*Plan ready* summary unchanged. It also passes the agent the list of skills
available in your session, so units can name the skills their implementer
must read. Invoke the agent directly only if you accept that it then sees
project skills (`.claude/skills/`) only; its summary then says so.

**Plan-gap rows.** `gap <plan path>` takes one row per line, exactly in the
form `SPEC-NN AC-k`, `SPEC-NN EC-k` or `SPEC-NN NFR-k` — the format of the
coverage report of `/spec-driven:implement`, so its uncovered rows can be
pasted unchanged. The agent adds new units in a new wave and leaves existing
units and contracts as they are. Other lines are reported and ignored.

### How it works

1. **Requirements review first.** The agent reads `.claude/sdd.json`, the
   project's agent docs, the `INSIGHTS.md` of the root and of every module
   the plan touches (if present; entries are treated as high-confidence
   constraints and cited in the units they shape), the spec and the code.
   It returns findings, recommendations and at most 4 questions, one of them
   the execution mode (`multi-agent` waves or one `single-agent` pass). An
   approved spec with a known mode skips this round unless something blocks.
2. **Plan file.** It then writes `<plansDir>/<slug>.md` from
   `templates/plan.md`, `Status: draft`:
   - §1 context, requirements review, decisions, open questions;
   - §2 affected modules; §3 contracts, produced first in Wave 0;
   - §4 work units, each with Kind, Skills, Module, Wave, owned files,
     Checks, Steps and acceptance criteria that cite `SPEC-NN AC/EC/NFR`;
   - §5 waves (no two units of a wave own the same file); §6 test plan;
     §7 verification; §8 risks; §9 out of scope and spec follow-ups.
3. **Rules it keeps:** migrations append-only (one new migration per wave),
   serialized files in Wave 0 or one unit, file moves and deletes only in
   orchestrator steps, every spec criterion covered, plan size limits.
   File locations come from `CLAUDE.md` / `AGENTS.md` and the closest
   existing module; if both are silent, it asks.
4. **Skills** in a unit are only skills that are actually available. The
   agent reads each candidate's description first, so no step contradicts a
   skill the implementer will follow. It never invents a name; if none fits,
   it writes `none`.
5. **Next step:** you review the plan, set `Status: approved`, then run
   `/spec-driven:implement <plan path>` (coming in a later release).

- **Tools:** `Read`, `Grep`, `Glob`, `Write`, `WebSearch`, `WebFetch`.
  `Edit`, `Bash`, `PowerShell`, `NotebookEdit`, `Agent` and `Skill` are
  disallowed; it revises a plan by rewriting the whole file.
- **Preloaded skill:** `spec-driven:ears-requirements` only.
- **Model:** `opus`. A wrong contract or a missed criterion in the plan is
  repeated by every implementer; `plan` never overrides the model.

## Project configuration (optional)

`.claude/sdd.json` at the project root. Every key is optional; keys this
plugin does not read are ignored.

| Key | Default | Meaning |
|---|---|---|
| `specsDir` | `specs/` | root spec folder (cross-module specs, global id scan) |
| `specTemplate` | none → the bundled `templates/spec.md` structure | project spec template; the agent never edits it |
| `plansDir` | `docs/plans/` | where plans are written; the planner writes only `*.md` directly in it |
| `checkCommand` | none | typecheck + related tests for one unit, used in each unit's *Checks* row (see below) |
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

**`checkCommand`** runs from the project root. `{module}` is replaced by the
module's `path`, `{files}` by the unit's owned files (space-separated, relative
to the project root). There is **no default**: without it the planner writes
`checkCommand (not configured)` and asks you for one. Example only, for a
Python project — use your project's own command:

```json
{ "checkCommand": "uv run pytest {files}" }
```

## What it runs

### write-guard

Runs `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-guard.mjs"` before every
`Write` and `Edit` call. It holds a map from full agent name to a write rule;
the entries are
`spec-driven:spec-creator` and `spec-driven:planner`; the main session and
every other agent pass through untouched (exit 0, no output). For spec-creator
it allows only `*.md` files inside `specsDir` or a module's `specsDir`, never
the spec template or a `_TEMPLATE.md`. For the planner it allows only `*.md`
files directly in `plansDir` (no subfolders), never inside any spec folder.
Neither may write outside the project. It fails closed: an
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
