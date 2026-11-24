# spec-driven

The **spec-driven development workflow** for any repository and any tech
stack: specify, then plan, implement and verify against the spec.

| Step | Component | Status |
|---|---|---|
| specify | `spec-creator` agent · `/spec-driven:specify` | available |
| plan | `planner` agent · `/spec-driven:plan` | available |
| implement | `implementer` agent · `/spec-driven:implement` | available |
| verify | `plan-verifier` agent · `/spec-driven:verify` | available |

The full flow:

```text
/spec-driven:specify → you approve the spec → /spec-driven:plan → you approve the plan → /spec-driven:implement → /spec-driven:verify
```

`/spec-driven:implement` now ends with the plan verifier, which checks every
plan item and spec criterion against the code once, after the last wave. Reviewers
are planned for a later release; until then the review of the branch is yours.

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
SPEC-07 UT-2
```

`plan` invokes the agent, asks you its Requirements review questions one
decision per question (the agent's default marked "(Recommended)" with its
reason), re-invokes it with your answers and the execution mode, and shows its
*Plan ready* summary unchanged. It also passes the agent the list of skills
available in your session, so units can name the skills their implementer
must read. Invoke the agent directly only if you accept that it then sees
project skills (`.claude/skills/`) only; its summary then says so.

**Plan-gap rows.** `gap <plan path>` takes one row per line, exactly in the
form `SPEC-NN AC-k`, `SPEC-NN EC-k`, `SPEC-NN NFR-k` or `SPEC-NN UT-k` — the
format of the *Plan gaps* block of the verifier report, so its uncovered rows
can be pasted unchanged. The agent adds new units in a new wave and leaves existing
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
   `/spec-driven:implement <plan path>`.

- **Tools:** `Read`, `Grep`, `Glob`, `Write`, `WebSearch`, `WebFetch`.
  `Edit`, `Bash`, `PowerShell`, `NotebookEdit`, `Agent` and `Skill` are
  disallowed; it revises a plan by rewriting the whole file.
- **Preloaded skill:** `spec-driven:ears-requirements` only.
- **Model:** `opus`. A wrong contract or a missed criterion in the plan is
  repeated by every implementer; `plan` never overrides the model.

## implement

`/spec-driven:implement` builds an **approved** plan wave by wave. It refuses a
plan whose *Status* is not `approved`.

| Component | Type | Invoke as |
|---|---|---|
| `implementer` | agent | `spec-driven:implementer` |
| `implement` | skill (command, manual only) | `/spec-driven:implement <arguments>` |
| `bash-guard` | `PreToolUse` hook | — |

### Usage

```text
/spec-driven:implement docs/plans/orders-export.md
/spec-driven:implement orders-export keep the export button disabled while loading
/spec-driven:implement resume orders-export
```

Text after the plan is passed to every implementer as notes, subordinate to
the plan; a note that changes scope or a contract stops the run.

### How it works

1. **Intake.** Reads `.claude/sdd.json` and the plan's unit blocks, requires a
   clean working tree, and on `main` / `master` creates `feature/<slug>`. If
   no `checkCommand` is configured it asks once: add one, or run without
   checks (every check is then `NOT RUN` and the summary starts with
   `UNVERIFIED:`).
2. **Skills.** Each name in a unit's *Skills* field is resolved to the
   absolute path of an installed `SKILL.md`: project and personal skills by
   folder, plugin skills by the `installPath` of the enabled install in
   `~/.claude/plugins/installed_plugins.json`. The frontmatter `name` must
   match; otherwise the skill counts as missing and the run stops and asks.
3. **Wave 0** and every unit with Kind `orchestrator` are done by the main
   session (contracts, migrations, dependencies, moves and deletes).
4. **Waves 1…N.** One `spec-driven:implementer` per unit — in parallel in
   `multi-agent` plans, one after another in `single-agent` plans. Each
   invocation's description starts with `[U<n>]` and the unit title; an
   optional `Model: haiku|sonnet|opus` row in the unit block sets its model.
   Then the full `checkCommand` runs once per touched module; failures go back
   to the owning unit in fix mode (at most 2 rounds per wave).
5. **Ownership check.** Before each wave commit, `git status --porcelain` is
   compared with the wave's owned files; any other changed file stops the run
   and is shown to you.
6. **Insights.** Implementers report *Insights (candidates)*; after the wave
   check passes, new, non-duplicate ones are appended to
   `<module>/INSIGHTS.md` and committed with the wave.
7. **One commit per wave**, only after its full check is green (or `NOT RUN`
   by your choice): `feat(<slug>): wave <k> — U<a>, U<b>`, plus
   ` (check rounds: <r>)` when fix rounds ran. No attribution trailers. It never
   pushes and never opens a pull request.
8. **Verify.** After the last wave, one `spec-driven:plan-verifier` run checks
   the code against the plan and its specs (see [verify](#verify)); never per
   wave. Failed rows go to the owning units' implementers in `mode: fix`, for
   **one** fix round: a failed `U<n>-MNT-*` row stops the run and asks you, and
   a spec row that no unit cites is not fixed but listed as a plan gap. The fix
   round's full check and ownership check run again, then one commit
   `fix(<slug>): verify round — U<a>, U<b>[, orchestrator]` (no attribution
   trailer), then a re-verify. Gaps are listed one per line, ready to paste
   into `/spec-driven:plan gap <plan path>`.
9. **Summary**: commits, check results, the verifier verdict, deviations from
   plan, `INSIGHTS.md` appends, and *How to verify manually* (copied from the
   plan's test plan).

`resume <slug>` reads the plan and `git log` and continues at the first wave
without a `feat(<slug>): wave <k>` commit. A dirty tree is shown to you first.

### The implementer

- Implements exactly **one** unit, of any Kind except `orchestrator`, and
  edits only the files in its *Owns* row. Several may run in parallel in the
  same checkout.
- **Stack-agnostic:** preloads no skills; it reads in full every `SKILL.md`
  path passed for the unit's *Skills* field and follows it. A missing path →
  `BLOCKED`. It also reads the module's `INSIGHTS.md` (if present) before
  coding, and never edits it.
- **Verifies only its own changes** with `checkCommand` (`{module}` and
  `{files}` filled in); without one, verification is `NOT RUN` — it never
  invents a command. At most 3 fix rounds. Architecture and security review
  are not its job.
- Never touches git state, dependencies, lockfiles, or migration and schema
  files outside its *Owns* row.
- Returns a fixed **Implementer result**: Changed · Deviations from plan ·
  Skills applied (`<skill> → <rule applied, where>`) · Verification ·
  Insights (candidates) · Out of scope. `mode: fix` with `findings` adds a
  Findings table.
- **Tools:** `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash` (guarded).
  `Agent`, `Skill`, `NotebookEdit`, `WebSearch`, `WebFetch` and `PowerShell`
  are disallowed. **Model:** `sonnet`, unless the unit sets *Model*.

## verify

The `plan-verifier` agent checks the code against an **approved** plan and the
`SPEC-NN` specs it names. It is read-only and is not a code review.

| Component | Type | Invoke as |
|---|---|---|
| `plan-verifier` | agent | `spec-driven:plan-verifier` |
| `verify` | skill (command, manual only) | `/spec-driven:verify <arguments>` |
| `bash-guard` | `PreToolUse` hook | — |

### Usage

```text
/spec-driven:verify docs/plans/orders-export.md
/spec-driven:verify orders-export
/spec-driven:verify orders-export 1c1b92a   # explicit base commit
```

### How it works

1. **Items first.** The item list is fixed before any code is read: one row
   per contract subsection, unit *Owns* path, *Must not touch* entry, unit
   acceptance criterion and *Checks* command, per test-plan row and
   verification item, and per `AC` / `EC` / `NFR` / `UT` row of every spec in
   the plan's *Requirements source*.
2. **Evidence.** Each row is `MET`, `PARTIAL`, `NOT MET` or
   `NOT VERIFIABLE (<reason>)`, with `file:line` or a command and its result.
   The change set is `git diff --name-status <base>` plus untracked files; `base`
   defaults to the parent of the oldest `feat(<slug>): wave` commit (the start
   of the implementation), else the merge base with `main` (else `master`);
   `/spec-driven:verify` also takes a base commit as a second argument. A check that is
   denied, not configured or needs a running stack is `NOT VERIFIABLE`; each
   distinct command runs once.
3. **Verdict**, a pure function of the rows: any `NOT MET` or `PARTIAL` →
   `FAIL`; else any `NOT VERIFIABLE` → `INCOMPLETE`; else `PASS`. A spec row
   that no unit acceptance criterion cites is `NOT MET` and also listed under
   *Plan gaps*, in the `SPEC-NN UT-2` form that `/spec-driven:plan gap` takes.
4. **Re-verify** (run by `implement` after its one fix round) re-checks the
   rows that failed and the rows whose evidence cites a file of the fix commit;
   every other row is copied from the previous report. A changed item list
   triggers a full verify.

Advice (style, naming, performance) appears only under *Out-of-plan
observations* and never changes the verdict.

- **Tools:** `Read`, `Grep`, `Glob`, `Bash` (guarded). `Write`, `Edit`,
  `NotebookEdit`, `PowerShell`, `Agent`, `Skill`, `WebSearch` and `WebFetch`
  are disallowed.
- **Preloaded skill:** `spec-driven:ears-requirements`, only to read spec rows.
- **Model:** `sonnet`. **maxTurns:** `100`.

## Project configuration (optional)

`.claude/sdd.json` at the project root. Every key is optional; keys this
plugin does not read are ignored.

| Key | Default | Meaning |
|---|---|---|
| `specsDir` | `specs/` | root spec folder (cross-module specs, global id scan) |
| `specTemplate` | none → the bundled `templates/spec.md` structure | project spec template; the agent never edits it |
| `plansDir` | `docs/plans/` | where plans are written; the planner writes only `*.md` directly in it |
| `checkCommand` | none | typecheck + related tests for one unit: each unit's *Checks* row, the implementer's check, the full check per module after each wave and the verifier's check rows (see below). Include an architecture check here if you want one |
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

### bash-guard

Runs `node "${CLAUDE_PLUGIN_ROOT}/scripts/bash-guard.mjs"` before every
`Bash` call. It acts only for `spec-driven:implementer` and
`spec-driven:plan-verifier`; the main session and every other agent pass
through untouched (`spec-creator` and `planner` have no `Bash` at all — it is
in their `disallowedTools`). For both it is an allow-list: read-only git (`status`, `diff`, `log`, `show`, `merge-base`,
`rev-parse`, `ls-files`, `blame`, `grep`) and the project's `checkCommand`
with `{module}` / `{files}` filled in. There is no built-in test runner. It
rejects redirection, `$` and backtick substitution, background `&`, `tee`,
env assignments, `cd`, `..` paths, git state changes, installs, `rm` and `mv`,
with a reason that says what is allowed instead. It fails closed on an
unreadable payload or a malformed `.claude/sdd.json`.

Tests: `node --test plugins/spec-driven/scripts/bash-guard.test.mjs`.

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

See the [root README](../../README.md#install) for full install instructions.

## Requirements and dependencies

- No plugin dependencies.
- Node.js on `PATH` for the `write-guard` and `bash-guard` hooks.

## Based on

- [`docs/research/2026-11-19-plan-verifier.md`](../../docs/research/2026-11-19-plan-verifier.md)
- `plugins/sdd-engineering/agents/plan-verifier.md` in the course repository
  `dev-digest-ai-marketplace`: a design reference only; no text is copied.

## Credits

Ported from humen-dev's earlier spec-driven development plugins (first-party
content, no third-party licence applies), with stack-specific names removed. EARS: Mavin et al., RE'09 — see
`skills/ears-requirements/references.md`.
