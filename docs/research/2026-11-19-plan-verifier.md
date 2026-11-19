# Research report: stack-agnostic plan-verifier for spec-driven

| Field | Value |
|---|---|
| Question | How should a stack-agnostic plan-verifier verify code item by item against a plan and its SPEC-NN rows (AC/EC/NFR/UT), with evidence, without drifting into code review? |
| Mode | HYBRID (local files plus one docs page) |
| Status | ✅ Found |
| Confidence | High for the course file and repo conventions. Medium for hook details (one docs page, partly read). |
| Assumptions | The new agent is `spec-driven:plan-verifier`. The course file is the base design. Repo conventions override the course file where they conflict. |

## TL;DR
- Port the course agent almost 1:1. Its design is mostly stack-agnostic: the row ID scheme, four statuses, a verdict that is a pure function of the rows, compact and full tables, and re-verify mode.
- Stack-specific parts to replace: the `architectureCheck` key, the `sdd-engineering:` names, and the `implementation-planner` / `architecture-reviewer` routing.
- Spec-driven already has the pieces it needs:
  - the plan template's §3/§4/§6/§7 shape;
  - the spec template's AC / EC / NFR / UT tables;
  - `checkCommand` with `{module}` / `{files}`;
  - a `bash-guard` hook keyed on `agent_type`.
- Real work to add:
  - one new agent-type branch in `bash-guard.mjs`, which currently acts only for the implementer;
  - UT rows. `/spec-driven:implement` Phase 3 does not cover UT, because its grep only matches `(AC|EC|NFR)`.

## Findings (codebase)

| # | What | Location | Evidence / notes |
|---|---|---|---|
| 1 | Course agent frontmatter: tools `Read, Grep, Glob, Bash`; `disallowedTools` Write, Edit, NotebookEdit, PowerShell, Agent, Skill, WebSearch, WebFetch; preloads `ears-requirements` | `dev-digest-ai-marketplace\plugins\sdd-engineering\agents\plan-verifier.md:5-15` | Read-only. No coding skills, so the agent does not drift into generic review. |
| 2 | Item ID scheme | same file `:124-136` | `C-`, `U<n>-OWN/MNT/AC/CHK-k`, `T-k`, `V-k`, `R-<slug>-k`, `S<NN>-<AC\|EC\|NFR\|UT>-k`. Free-form plans get `R-` rows. |
| 3 | Statuses and verdict | same file `:156`, `:202-210` | MET / PARTIAL / NOT MET / NOT VERIFIABLE. Any NOT MET or PARTIAL gives FAIL. Otherwise any NOT VERIFIABLE gives INCOMPLETE. Otherwise PASS. A `C-*` or `MNT` NOT MET is always FAIL. |
| 4 | Evidence rule | same file `:44-48` | Every row has `path:line` or `command → result` from this run. Implementer reports are claims. Paraphrase gives NOT VERIFIABLE. |
| 5 | No-generic-advice rule | same file `:50-54`, `:226-228` | "Consider / best practice / style" is banned in Traceability and Missing·Extra·Misunderstood. It is allowed only under *Out-of-plan observations*, which never changes the verdict. |
| 6 | Row-count discipline | same file `:51-52`, `:139-143` | The item list is built before reading code. The header states the count. Row count must equal it. |
| 7 | Re-verify mode | same file `:212-217` | Re-check rows that were not MET in `previous`, plus items touched by the fix diff. Carry MET rows as `(carried from previous)`. The full table is still printed. |
| 8 | Report skeleton and compact mode | same file `:221-238` | Compact mode (unit scopes) prints only non-MET rows plus `MET (n): ids`. `scope=all` and re-verify print the full table. |
| 9 | Interview mode | same file `:93-112` | Triggers: no plan path, ambiguous plan, unknown scope, unresolvable range. Max 4 questions, one round. |
| 10 | Spec rows MET only when shown in code or a test | same file `:136`, `:165-171` | A criterion no unit cites is NOT MET and listed as `plan gap: S<NN>-…`. EARS evidence shape per pattern; half the shape gives PARTIAL. |
| 11 | Course Bash allowlist | same file `:182-200` | Read-only git, `checkCommand`, `architectureCheck`. No redirection, `$()`, `tee`, `-u`/`--update`. Checks needing Docker, a DB or a running stack are NOT VERIFIABLE. |
| 12 | Phase 3 coverage (implement) | `plugins\spec-driven\skills\implement\SKILL.md:238-273` | Criterion ids come from `Grep -n '^\| *(AC\|EC\|NFR)-[0-9]+ *\|'` (`:245`). Citation parsing is at `:251-257`. "Covered" means a citing unit is finished (`:258-262`). Gap format is `SPEC-NN AC-k` (`:264-270`). Line `:240` says "There is no plan verifier yet". |
| 13 | Phase 3 does not cover UT | `implement\SKILL.md:245-248` | The grep and gap form list only AC/EC/NFR. The spec template has a `UT-n` table (`templates\spec.md:119-121`). The verifier would be the first consumer of UT rows. |
| 14 | Plan template | `plugins\spec-driven\templates\plan.md:9-15` (header), `:42-51` (§3), `:58-77` (unit block), `:93-101` (§6, §7) | Unit fields: Kind, Skills, Model, Module, Wave, Depends on, Owns, Must not touch, Consumes, Produces, Checks. Units cite `SPEC-NN AC-n, EC-n` (`:77`). Header has *Requirements source*. |
| 15 | Spec template | `templates\spec.md:12`, `:43-49`, `:52-54`, `:105-107`, `:119-121` | `Spec ID: SPEC-NN`. Tables: AC (ID, Pattern, Requirement, Story, Priority, Verify by), EC, NFR, UT. Every table has a "Verify by" column. |
| 16 | Config keys | `scripts\lib\sdd-config.mjs:18-25` | Keys are `specsDir`, `specTemplate`, `plansDir`, `checkCommand`, `modules`, `agentDocs`. There is no `architectureCheck`. The README says to put architecture checks in `checkCommand` (`README.md:262`). |
| 17 | `checkCommand` placeholder convention | `README.md:276-281`, `implement\SKILL.md:33-38` | Run from the project root. `{module}` → module path. `{files}` → project-relative files; none means the module's full check. No default; never invent one. |
| 18 | bash-guard is implementer-only | `scripts\bash-guard.mjs:94`, `:31` | `agentType(payload) !== IMPLEMENTER` leads to `allow()`. A verifier's Bash would pass through unrestricted unless a branch is added. |
| 19 | Guard allowlist mechanics | `scripts\bash-guard.mjs:33-39`, `:85-91`, `:112-125` | Git read set: status, diff, log, show, merge-base, rev-parse, ls-files, blame, grep. Output flags rejected. Forbids `<>`, backtick, `$`, background `&`, `tee`, env assignments. Every segment must match, so `checkCommand` templates are allowed. Fails closed on a malformed config (`:97-98`). |
| 20 | Hook wiring | `hooks\hooks.json:15-23` | The `Bash` matcher already runs `bash-guard.mjs`. No new hook entry is needed. The new agent only needs a branch in the script and tests in `scripts\bash-guard.test.mjs`. |
| 21 | Agent-type payload field | `scripts\lib\guard-io.mjs:50-52` | Reads `payload.agent_type`. Names are namespaced, e.g. `spec-driven:implementer`. |
| 22 | Implementer conventions to mirror | `agents\implementer.md:1-7`, `:41-60` | Same frontmatter style. Reads `sdd.json`. "Never invent a command": no `checkCommand` means NOT RUN. Skills are read by absolute path passed in the brief. |
| 23 | Repo rules for reviewers | `docs\PLUGIN-GUIDELINES.md:110-123` | `tools` allow-list plus `disallowedTools`. Reviewers have no Write/Edit/NotebookEdit; Bash read-only, stated in the body. Plugin agents ignore `hooks`, `mcpServers`, `permissionMode` frontmatter, so enforcement must be a plugin-level hook. |
| 24 | Hook script rules | `docs\PLUGIN-GUIDELINES.md:127-133` | `hooks.json` has a top-level `hooks` key. Call scripts through `node "${CLAUDE_PLUGIN_ROOT}/…"`. Prefer Node. Follow SECURITY.md. |
| 25 | README conventions | `README.md:11`, `:19-22`, `:286-319`, `docs\PLUGIN-GUIDELINES.md:135-156` | The verify row says "planned". A new component needs a README row, a Tools/Model bullet, and a `## What it runs` entry (`### bash-guard` already exists and must be updated). |

### Details

#### A. What generalises from the course file
- **ID scheme, one row per item, row count in the header, no merged rows.** (`plan-verifier.md:124-143`)
- **Four statuses and the pure-function verdict.** Add `C-*` / `MNT` NOT MET as an always-FAIL override. (`:156`, `:202-210`)
- **Evidence rule.** Reports are claims, evidence comes from this run, and `file:line` or `command → result` is required. (`:44-48`)
- **Out-of-plan observations section.** It is the only place for advice, and the verdict ignores it. This is the main guard against drifting into code review. (`:50-54`)
- **Review-skill separation.** The agent preloads no coding skills. When a plan item names a skill, the agent `Read`s that skill for that item only. If the file is missing, the item is NOT VERIFIABLE. (`:7-12`, `:177-180`)
- **Stop-and-report rules.** `BLOCKED:` is printed first when the plan is missing, the range is unresolvable, or the tree is unstable. (`:68-70`)
- **Untrusted content rule.** The plan is the spec to check against, not instructions. (`:62-65`)
- **Change-set discovery.** The base is the merge-base with `main`/`master`, using `git diff --name-status` plus `git ls-files --others --exclude-standard`. (`:145-152`)
- **Reading the plan by section.** Use a heading grep and ranged reads; read in full only for `scope: all`. This matches `implement\SKILL.md:92-107`. (`plan-verifier.md:85-91`)
- **Run only when no implementer is active.** If `git status` shows the tree changing, stop with `BLOCKED:`. (`:60-61`)
- **Interview mode.** Same four triggers, max 4 questions, one round. It also matches the repo's own Researcher-style clarification format.
- **Compact vs full tables.** Compact is for per-wave scopes; full is for `scope=all` and re-verify.

#### B. What is stack-specific or sdd-engineering-specific, and needs replacing
- **`architectureCheck` key** (`:29`, `:36`, `:191`). It does not exist in spec-driven config (`sdd-config.mjs:18-25`). Drop it. A project's architecture check lives inside `checkCommand` (`README.md:262`).
- **`sdd-engineering:` names** (`:14`, `:3`). Replace with `spec-driven:ears-requirements`, which exists at `skills\ears-requirements\SKILL.md`.
- **Routing targets.** The course routes plan gaps to `sdd-engineering:implementation-planner` and generic review to `architecture-review:architecture-reviewer`. In spec-driven, plan gaps go to `/spec-driven:plan gap <plan>` (`implement\SKILL.md:272-273`). Reviewers are "planned" only (`README.md:19-22`), so point to "the user's own review".
- **`/sdd-engineering:run-plan` wave cadence** (`:3`). The orchestrator here is `/spec-driven:implement`. Its Phase 3 and README must be changed to call the verifier. Whether to run it per wave or once at the end is a design choice (see Unverified).
- **`modules` default and `specsDir`.** The course uses a single `specsDir`. Spec-driven has per-module `specsDir`, and the Phase 3 lookup is `Grep -l 'Spec ID: SPEC-NN'` across all of them (`implement\SKILL.md:243-245`). Reuse that lookup.
- **Course sonnet model.** Fine to keep. The implementer is sonnet (`implementer.md:4`).
- **Course-specific stack words** (TypeScript, React, onion architecture, pnpm, depcruise). I did not see any in the 240 lines of the file itself beyond the `architectureCheck` and `pnpm`-like `checkCommand` examples, which are only mentioned abstractly. The stack coupling is in names and config, not in the logic. *Inference, medium confidence.*

#### C. Traceability row format (recommended, from course `:221-229`)
`| ID | Source (plan §/line) | Requirement (≤20 words, quoted) | Verdict | Evidence (file:line or cmd → result) |`
- Header fields: Verdict, Plan shape (template/free-form), Items count with the status breakdown, and Range.
- Spec rows use `S<NN>-<AC|EC|NFR|UT>-<k>`, where `<k>` is the spec's own number, for example `S01-UT-2`.
- In re-verify mode, carried rows show `(carried from previous)` in the Evidence column.
- Evidence formats:
  - code: `path/file.ext:42` or a range `42-58`;
  - tests: `path:line` of the test that exercises the behaviour, plus the run result;
  - commands: `<exact command> → exit 0, 14 passed`, or the decisive error line;
  - diff facts: quote the `git diff --name-status` line (for MNT rows).
- Behaviour must be shown by code or a test, not just cited by a unit (`:136`).
- Use each spec row's own *Verify by* column (`spec.md:40-41`) as the expected test shape. This is the stack-agnostic hook: it names unit/integration/e2e/manual/inspection.
- `manual` / `inspection` / e2e-needing-a-running-stack rows: NOT VERIFIABLE, or MET by `inspection` only when the code is shown. This follows the course's rule for stacks it cannot run (`:196-199`).

#### D. Staying out of generic review
Mechanisms present in the course file, all portable:
1. Fixed item list built from the plan before any code is read (`:49-52`, `:122-143`).
2. A judging standard of the plan only: no coding skills preloaded, and a skill is read only when an item names it (`:7-12`, `:177-180`).
3. Banned advice vocabulary in the verdict sections (`:50-54`).
4. A separate optional *Out-of-plan observations* section that cannot change the verdict (`:209-210`, `:228`).
5. *Extra* lists changed files owned by no unit in scope, as facts only, with no advice (`:173-174`, `:238-239`).
6. A description line stating it is not a substitute for review (`:3`).

#### E. Tools and Bash restriction
- Tools: `Read, Grep, Glob, Bash`, plus `disallowedTools: Write, Edit, NotebookEdit, PowerShell, Agent, Skill, WebSearch, WebFetch` (course `:5-6`). This matches spec-driven's implementer disallow list shape (`implementer.md:6`).
- Bash is needed for two things only: read-only git (change set and diff) and `checkCommand`.
- The enforcement route available: extend `bash-guard.mjs`.
  - Line 94 currently returns early unless the agent is the implementer. Add `spec-driven:plan-verifier` with the same allowlist (git read plus `checkCommand`).
  - The course already says its allowlist is "hook-enforced" (`:3`, `:187-193`); in spec-driven that hook does not exist for the verifier yet.
  - Update the name and error text variable at `bash-guard.mjs:96`, the header comment (`:6-14`), and the test file.
  - The `hooks.json` Bash matcher (`hooks.json:15-23`) already covers it.
- Verifier-specific tightening to consider (*recommendation*): the implementer's `GIT_READ` set includes `blame` and `grep`. The verifier needs only `status, diff, log, show, merge-base, rev-parse, ls-files`. The course list is exactly those seven (`:187`).
- Why a hook and not frontmatter: plugin agents ignore `hooks` / `permissionMode` frontmatter (`PLUGIN-GUIDELINES.md:115-116`), so a plugin-level hook is the only way.
- Official docs: a subagent's tool calls fire the same `PreToolUse` hooks, and the payload carries `agent_id` and `agent_type`. A deny is exit code 2 with a stderr reason, or JSON `permissionDecision: "deny"`. Silence is not approval. Source: https://code.claude.com/docs/en/hooks. I read only the first 100k of 294k characters, so I did not check every detail.
- Running `checkCommand` can write caches or snapshots. The course forbids snapshot-update flags and coverage writes (`:195-196`), but the hook cannot see inside the user's command. Treat this as a known limit (see Unverified).

#### F. Re-verify mode
- Input: `previous`, a prior report as text or a file path.
- Re-check only rows that were not MET, plus items touched by the fix diff (`git diff <previous range end>..`).
- Carry MET rows unchanged with the `(carried from previous)` marker; the table and header count remain complete (`:212-217`).
- Gap in the course text: it does not say what to do when `previous` has a different item list than the current plan, or how to find "previous range end". The new agent should define this. Suggested: record the head commit in the report header, and treat a changed plan item list as a full re-verify. *Recommendation.*

#### G. Interview / clarification behaviour
- Course triggers: no plan path, ambiguous plan path, unknown scope unit, unresolvable range (`:93-105`).
- The repo's own agents are non-interactive subagents that cannot talk to the user, so the clarification block is returned to the caller (the course file does the same, "relay it and re-invoke", `:3`).
- Additional triggers worth adding for spec-driven *(recommendation)*: a `SPEC-NN` named in the plan header cannot be found, and the plan has no `### U<n>` blocks. `implement\SKILL.md:105-107` stops in the second case; the course instead falls back to a free-form shape (`:114-120`).
- Neither the spec-creator nor the planner's interview text was read by me; I did not open `agents\spec-creator.md` or `agents\planner.md`.

### Flow / relationships
1. The orchestrator (`/spec-driven:implement`) finishes a wave, or the final wave, and commits.
2. It invokes the verifier with `plan`, `scope`, optional `range`, `base`, `previous`.
3. The verifier reads `.claude/sdd.json` and builds the item list from the plan and its specs.
4. It determines the change set and verifies each item. Bash runs only git read and `checkCommand`, restricted by `bash-guard`.
5. It prints the report. NOT MET / PARTIAL means FAIL: a unit gap goes to an implementer in fix mode, a plan gap goes to `/spec-driven:plan gap`.

## Not found
- **Any existing plan-verifier in spec-driven** — searched: `Glob plugins/spec-driven/**/*`. Nothing relevant; only the README says "planned" (`README.md:11`).
- **`architectureCheck` in spec-driven config** — searched: `sdd-config.mjs:18-25`, README config table. Not a key; the course file's use of it does not carry over.
- **UT handling in `/spec-driven:implement` Phase 3** — searched: the whole of `implement\SKILL.md`. UT is not covered anywhere. The `Grep` at `:245` matches only AC/EC/NFR.
- **Course-version stack-specific text (TypeScript/React/onion/pnpm/depcruise)** — I did not see these words in the course agent file, so the stack coupling there is limited to the names and keys listed in B. If you expected them, check other files in `dev-digest-ai-marketplace`, e.g. a run-plan skill or the planner.
- **Sub-agents and skills official docs** — not fetched; only the hooks page. Whether `agent_type` appears in a plugin agent's name as `plugin:agent` form is shown only by the repo's own guard code (`bash-guard.mjs:31`), not by the docs text I read.

## Unverified / inferences
- The orchestrator should run the verifier after each wave as in the course, or once at the end — *inference*, confidence Low. The course says after every wave plus once with `scope: all` (`:3`); spec-driven's README only says "after each wave" (`README.md:19-20`). The user has to decide.
- `checkCommand` can mutate the tree (caches, snapshots) and the hook cannot see inside it — *inference*, confidence Medium, from `bash-guard.mjs:116-125` which matches only token shape.
- The new `bash-guard` branch should reuse the same code path (a shared allowlist for two agent types) rather than a copy — *inference*, confidence Medium, from `bash-guard.mjs:94-127` having no agent-specific logic beyond the name.
- The new agent's `ears-requirements` preload should be kept — *inference*, confidence Medium, because the course keeps it only to read S-rows (`:7-12`, `:165-171`) and spec-driven has the same skill (`README.md:36`).
- A `plugin.json` version bump and a README / `What it runs` update are needed — per `PLUGIN-GUIDELINES.md:56-57`, `:135-156` and the user's memory note on version bumps; I did not read `plugin.json`.

## Search log
| Tool | Query / pattern / path | Result |
|---|---|---|
| Read | course `plan-verifier.md` (full, 240 lines) | read |
| Read | `implement\SKILL.md` (full, 313 lines) | read |
| Read | `templates\plan.md`, `templates\spec.md` | read |
| Read | `README.md`, `docs\PLUGIN-GUIDELINES.md` | read |
| Glob | `plugins/spec-driven/**/*` | 27 files |
| Read | `scripts\bash-guard.mjs`, `hooks\hooks.json`, `scripts\lib\sdd-config.mjs` | read |
| Read | `agents\implementer.md` lines 1-90 | read |
| Grep | `agent_type\|exit\(\|permissionDecision` in `scripts\lib\guard-io.mjs` | 3 hits (lines 23, 28, 52) |
| WebFetch | https://code.claude.com/docs/en/hooks | agent_type field and deny mechanism confirmed; 194k chars unread |

## Suggested next steps (recommendations only)
- Decide where the verifier runs: per wave plus final, or final only. Then decide whether Phase 3 of `implement` is replaced by the verifier or kept as a cheap pre-check.
- Decide whether UT rows get coverage in Phase 3 and in the planner's gap format (`SPEC-NN UT-k`). The `plan gap` form would have to accept it.
- Extend `bash-guard.mjs` with a verifier branch (git read only plus `checkCommand`), add tests in `bash-guard.test.mjs`, and update README's `### bash-guard` section.
- Define re-verify details the course leaves open: header must carry the verified head commit and item list, and a changed item list forces a full run.

## Sources
- `C:\Users\mgume\PycharmProjects\dev-digest-ai-marketplace\plugins\sdd-engineering\agents\plan-verifier.md:1-240`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\skills\implement\SKILL.md:1-313` (esp. `:92-107`, `:238-273`)
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\templates\plan.md:1-113`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\templates\spec.md:1-157`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\README.md:1-361`
- `C:\Users\mgume\PycharmProjects\claude-market-place\docs\PLUGIN-GUIDELINES.md:1-165`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\bash-guard.mjs:1-127`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\lib\sdd-config.mjs:1-99`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\lib\guard-io.mjs:23-52`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\hooks\hooks.json:1-27`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\agents\implementer.md:1-90`
- https://code.claude.com/docs/en/hooks (Official docs; partial read)

Skipped: sub-agents and skills docs pages, `agents\spec-creator.md`, `agents\planner.md`, `plugin.json`, `bash-guard.test.mjs`. Risk: the hook-docs claim rests on the first 100k of 294k characters.
