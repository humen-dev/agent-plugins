# Research report: stack-agnostic test-writer agent (backfill and TDD modes)

| Field | Value |
|---|---|
| Question | How should a stack-agnostic `test-writer` subagent work in backfill and TDD modes, driven by a plan's test-plan rows, given the course agent and this repo's conventions? |
| Mode | HYBRID (local files plus official docs) |
| Status | ⚠️ Partially found |
| Confidence | High for the local findings, Medium for the design recommendations |
| Assumptions | "Course version" means `dev-digest/.claude/agents/test-writer.md`. I did not read `scripts/agent-check.mjs`. Both repos' paths are given in full below. |

## TL;DR
The course agent's skeleton generalises well. That covers modes, inputs, interview block, never-fake-green rules, stop conditions and the fixed report. Its path allow-lists, test commands, layer table and skills are all DevDigest-specific. In this plugin they must be replaced by config: `checkCommand` already exists, but a test-file glob key does not. Two constraints shape the design:
- Plugin agents ignore `hooks` frontmatter, so enforcement must go into plugin `hooks/hooks.json` and be keyed on `agent_type`.
- The course agent has no mechanism for proving that a TDD test fails first, beyond one report line. That needs to be added.

## Findings (codebase)

| # | What | Location | Notes |
|---|---|---|---|
| 1 | Course agent frontmatter: tools, disallowedTools, per-agent hooks, preloaded skills | `C:\Users\mgume\PycharmProjects\dev-digest\.claude\agents\test-writer.md:1-28` | The `hooks:` block (lines 18-27) is ignored for plugin agents. The `skills:` list (7-17) is stack-specific. |
| 2 | Inputs: `mode` (backfill default or tdd), then `plan`+`unit` or `paths`/`range`+behaviours, plus optional earlier answers | same file `:35-43` | Generalises. Only the plan path `docs/plans/<slug>.md` and "§6" are project-bound. |
| 3 | Interview mode: ≤4 questions, options plus default, one round, no questions answerable by reading code | same `:45-67` | Matches the repo's Clarification block. Blocker values are customised: "Unclear target / Unclear behaviour / Missing spec (tdd)". |
| 4 | Hard rules: tests-only paths, git read-only, no dependency changes, never fake green, assertions must be able to fail, behaviour not implementation, name the break each test catches | same `:69-106` | Rules 2-9 generalise. The rule 1 path list does not. |
| 5 | Precedence: package docs and existing tests beat skills beat generic advice. Copy the nearest existing test's setup. | same `:108-114`, `:116-121` | Generalises fully. This is how layer and idiom come from the project. |
| 6 | Layer table by code kind, with file names such as `*.it.test.ts` | same `:123-158` | Stack-specific content. The principle (one test kind per layer, copy the nearest sibling, DB-backed tests in the integration lane, e2e needs a running stack so say "not run") generalises. |
| 7 | TDD proof: run, confirm it "fails for the right reason" (failing assertion or missing symbol the plan names), fix syntax, import or fixture errors, and report the reason | same `:160-165` | Thin. There is no recorded command output, no distinction between compile and assertion failure, and no re-check against the plan row. |
| 8 | Backfill: new tests pass, the full suite is green, and a failing test caused by wrong code is kept and reported under BLOCKED | same `:167-169` | Generalises. |
| 9 | Hard-coded command table, and the `agent-check.mjs` wrapper | same `:171-186` | Stack-specific. In the plugin this becomes `checkCommand` with `{module}` and `{files}`. |
| 10 | Stop conditions, with BLOCKED listed first | same `:188-195` | Generalises. It includes "making the code testable needs a production-code change". |
| 11 | Fixed report: Tests written (File, Test name, Break it catches, Layer), Verification, Not covered / BLOCKED | same `:197-216` | Generalises. The Layer vocabulary is stack-specific and should be free-form. |
| 12 | Course write guard: hard-coded allow and deny globs per profile, deny checked first, then allow, else deny | `C:\Users\mgume\PycharmProjects\dev-digest\.claude\hooks\write-scope-guard.mjs:16-31`, `:99-104` | The mechanism is reusable. The `globToRegExp` function at `:61-84` supports `**`, `*`, `?`, `{a,b}` and `[0-9]`. The lists are DevDigest-only. |
| 13 | Course Bash guard: allow-list per segment, rejects `<>`, backtick, `$`, `&`, `tee`, env assignments, and has a `GIT_READ` set | `C:\Users\mgume\PycharmProjects\dev-digest\.claude\hooks\bash-scope-guard.mjs:17-18`, `:47-55`, `:110-139` | `isTestRun` hard-codes pnpm/npm/vitest and a flag allow-list that denies `-u`, `--update`, `--watch`. The idea of denying snapshot-update and watch flags is stack-specific. |
| 14 | Plugin write-guard: dispatches on `agent_type` via a `RULES` map. Only the creator and planner are listed, so other agents pass through. Config comes from `.claude/sdd.json`. Fails closed. | `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\write-guard.mjs:23-39`, `:41-76` | A test-writer rule is added as one new map entry. The existing helpers `projectRelative`, `isUnder` and `loadConfig` can be reused. |
| 15 | Plugin bash-guard acts only for `spec-driven:implementer`. It allows read-only git (including `blame` and `grep`) plus `checkCommand` templates with `{module}` and `{files}`. It rejects `cd`, `..`, redirection, `$` and env assignments. | `plugins\spec-driven\scripts\bash-guard.mjs:31-33`, `:41-82`, `:94-125` | It needs `IMPLEMENTER` generalised to a set including the test-writer. Without that it passes the test-writer through unguarded. |
| 16 | `agentType()` is null for the main session. Blocking is exit 2 with stderr. Guards are inert for other agents. | `plugins\spec-driven\scripts\lib\guard-io.mjs:14-16`, `:21-28`, `:51-53` | |
| 17 | `sdd.json` schema: only `specsDir`, `specTemplate`, `plansDir`, `checkCommand`, `modules`, `agentDocs`. `validate()` ignores unknown keys. | `plugins\spec-driven\scripts\lib\sdd-config.mjs:18-25`, `:45-68` | No key exists for test-file globs, a test-only check command, or test-layer conventions. Any new key must be added to `DEFAULTS` and `validate`. |
| 18 | `hooks.json` registers one `Write|Edit` and one `Bash` PreToolUse command, both keyed on `agent_type` inside the script | `plugins\spec-driven\hooks\hooks.json:4-25` | No new hook entries are needed if the scripts are extended. |
| 19 | Plan test plan: §6 is a table with columns Module, Tests (unit · integration · component · e2e flow), Owner (unit), Needs a running stack. It has no per-behaviour rows and no AC link. Each unit has *Owns*, *Checks* and acceptance criteria citing `SPEC-NN AC/EC/NFR`. | `plugins\spec-driven\templates\plan.md:93-96`, `:58-77` | "Test-plan rows" in the plugin are coarse. The behaviour-level source is each unit's acceptance criteria. The planner would need a richer §6, or the test-writer maps unit ACs to tests. |
| 20 | Implementer conventions to mirror: `checkCommand` `{module}`/`{files}` semantics, "never invent a command → NOT RUN", Never fake green, stop conditions with BLOCKED, fixed report with "exactly" wording, no skills preloaded (reads passed SKILL.md paths), reads module `INSIGHTS.md` | `plugins\spec-driven\agents\implementer.md:41-60`, `:137-139`, `:145-157`, `:224-251`, `:18-39` | The implementer already writes the unit's own tests and has a "missing test" case in fix mode (`:98-99`). The test-writer must not overlap ownership with it. |
| 21 | README says the implementer "never touches … files outside its Owns row". It lists the agent's tools and guard in per-component sections, and `## What it runs` has one `### <name>` per hook. | `plugins\spec-driven\README.md:229-250`, `:286-319` | A test-writer needs its own README row and any hook change documented here. |
| 22 | Guideline: plugin agents ignore `hooks`, `mcpServers`, `permissionMode`. Hooks must be in `hooks/hooks.json`, called via `node "${CLAUDE_PLUGIN_ROOT}/…"`, with no `../` or project paths. Reviewers are read-only. Bump the version in `plugin.json` per PR. | `docs\PLUGIN-GUIDELINES.md:108-133`, `:85-97`, `:56-58` | |

## What generalises vs. what is stack-specific

| Area | Generalises (keep) | Stack-specific (replace or source from config) |
|---|---|---|
| Modes and inputs | `mode` backfill/tdd; `plan`+`unit` or `paths`/`range`+behaviours; answers to earlier questions (`test-writer.md:35-43`) | Plan path `docs/plans/<slug>.md` and "§6" wording; use `plansDir` and the plugin template instead |
| Interview | Format, ≤4 questions, default per question, one round, don't ask what code answers (`:45-67`) | none |
| Hard rules | Rules 2-9 (`:79-106`) | Rule 1 path list; `pnpm install`, `.skip/.only/.todo/-u/--update`, `@ts-expect-error`, `any` (TS idioms) |
| Precedence | Docs and sibling tests beat skills (`:108-114`) | The `client/INSIGHTS.md` example |
| Layer choice | "Find the closest existing test, copy its setup and idiom"; one test kind per layer; DB or stack tests are a separate lane; fake ports, not vendor SDKs (`:123-158`) | Entire table, RTL query priority, `vi.mock`, `app.inject`, testcontainers, `*.it.test.ts`, flow JSON |
| Commands | Run the project's check; typecheck/lint is part of "done" (`:186`) | Command table (`:178-184`), `agent-check.mjs` |
| Write scope | Deny-first then allow, outside-repo deny, deny config and vendored files (`write-scope-guard.mjs:99-104`) | Concrete globs (`:18-30`) |
| Report | Whole template (`:201-216`) | Layer vocabulary |
| Skills | none | All seven preloaded skills (`:7-17`); the plugin implementer preloads none |

## Design findings per requested topic

**Inputs.** Keep the course inputs (`test-writer.md:35-43`). In the plugin the `plan`+`unit` pair is already the implementer's convention (`implementer.md:62-81`). Because §6 has no behaviour rows (`templates/plan.md:93-96`), the agent should derive rows from the unit's acceptance criteria and `SPEC-NN` citations (`plan.md:76-77`). This is an inference, see Unverified.

**Layer choice from the project's conventions.** Use the course precedence (`:108-121`):
- Read the agent docs and `INSIGHTS.md` (`agentDocs`).
- Find the nearest sibling test with Glob and Grep, then copy its location, naming, helpers and runner.
- Use the plan's §6 "Tests" column (unit · integration · component · e2e) and "Needs a running stack" as the stated layer.
- If a layer has no precedent in the repo, ask (interview) rather than inventing a stack.

**Proving TDD red for the right reason.** The course only says "confirm it fails … report the failure reason" (`:162-165`). The plugin needs a stricter protocol. Everything below is a recommendation:
1. Run `checkCommand` scoped to the new test files.
2. Capture the first failing line.
3. Classify the failure. A symbol, import or compile error that the plan names as "to be produced" is acceptable. A failing assertion on the specified behaviour is acceptable. A syntax error, a wrong path, a broken fixture or an error outside the unit is the agent's own bug, so fix it and re-run.
4. Re-run once after any fixture fix to confirm the reason is stable.
5. Record per test: command, exit status, the verbatim failure line (shortest decisive line), and "expected because <plan row or AC>".

A green test in TDD mode means the behaviour already exists or the test is vacuous. It must be reported and never accepted. In a typed language, a missing symbol may fail at the compile step rather than as a test failure. The agent should state which phase failed.

**Never faking green.** Keep rules 4-6 (`:85-97`) and make the forbidden markers language-neutral: any skip, only, todo, pending, disabled or expected-fail marker, snapshot or golden-file updates, loosened assertions, type or lint suppressions past a real failure, and no mocking the unit under test (assertions only on observable outcomes). The course lists mirror assertions and mock-only assertions (`:89-93`). "No mocking the unit under test" is not stated in the course file explicitly. It is closest to "Fake the port, not the vendor SDK" (`:137`).

**Restricting writes to test files in any stack.** Plugin agents' `hooks` frontmatter is ignored (`PLUGIN-GUIDELINES.md:115-116`; sub-agents doc). So put it in the existing plugin hooks, as the planner and creator already do (`write-guard.mjs:29-32`):
- Add a `spec-driven:test-writer` rule in `write-guard.mjs`.
- Allow only paths matching config-supplied test globs, which requires a new `sdd.json` key (not present, `sdd-config.mjs:18-25`).
- Deny-first for config and vendored files. Reuse the course's deny-then-allow order (`write-scope-guard.mjs:99-104`) and its glob matcher (`:61-84`).
- Fail closed when no test globs are configured. The alternative is a default heuristic such as `test`/`tests`/`__tests__` directories and `*test*`/`*spec*` names, which is language-leaky. A fallback is a design decision for the caller.

**Running the configured check command.** Reuse `checkCommand` with `{module}`/`{files}` (`README.md:276-284`; `implementer.md:52-60`). The plugin bash-guard must be extended from the single-agent check at `bash-guard.mjs:31`, `:94` to include the test-writer. It already permits `checkCommand` templates and read-only git. Behaviour with no `checkCommand` follows the implementer: `NOT RUN (checkCommand not configured)`, never invent a command. Open design point: `checkCommand` is documented as "typecheck + related tests" (`README.md:262`), so a TDD red run is one failure of the combined command. Whether a separate `testCommand` key is wanted is a decision for the caller.

**Fixed report.** Adopt the course template (`:201-216`), with these changes:
- Free-form Layer column.
- Add a TDD evidence block per test (command, status, failing line, why-expected).
- Keep BLOCKED first.
- Add the implementer-style "exactly" wording and the request-language rule (`implementer.md:226-227`).

**Interview behaviour.** Use the course block (`:54-67`) with the repo's header format. Triggers are unchanged: unclear target, no behaviours, `tdd` without a spec of expected behaviour. Additions for the plugin: no test-file globs configured, or no sibling test to copy a layer from.

## Official docs (web)

| # | Claim | Source |
|---|---|---|
| 1 | Plugin subagents ignore `hooks`, `mcpServers` and `permissionMode`. Plugin authors ship hooks in `hooks/hooks.json`, which apply whenever the plugin is enabled. | https://code.claude.com/docs/en/sub-agents |
| 2 | `tools` is an allowlist. `disallowedTools` is applied first. `skills` preloads full content. A subagent does not inherit the parent's skills. | same |
| 3 | PreToolUse payload includes `cwd`, `agent_id`, `agent_type`, `tool_input`. `agent_type` is present inside subagents. Plugin and settings hooks run inside subagents. | https://code.claude.com/docs/en/hooks |
| 4 | Deny = exit 2 with stderr, or JSON `permissionDecision: "deny"`. | same |

Both pages were fetched only up to character 100,000 of their text. The tail of each was not read.

## Not found
- **A test-file glob or test-command key in `sdd.json`** — searched `plugins\spec-driven\scripts\lib\sdd-config.mjs` and `README.md:252-284`. Result: no such key exists, so it must be added.
- **Confirmed `agent_type` string for plugin agents in payloads** — the hooks docs only imply the `<plugin>:<agent>` form (via a matcher example). The repo's guards already rely on `spec-driven:implementer` (`bash-guard.mjs:31`). I did not find a doc line confirming the format.
- **How `agent-check.mjs` works** — not read. It is only referenced, in `test-writer.md:171-176` and `bash-scope-guard.mjs:57-70`.
- **Per-behaviour test-plan rows in the plugin template** — `plan.md` §6 has module-level rows only.
- **Course `TESTING.md` and `INSIGHTS.md`** — referenced at `test-writer.md:101`, `:114`, but not read.
- **Unread pieces of the repo** — `plugins\spec-driven\skills\implement\SKILL.md`, `plugins\spec-driven\agents\planner.md`, `plugins\spec-driven\agents\spec-creator.md`, and both guards' test files. I did not check how `/spec-driven:implement` would dispatch a test-writer.

## Unverified / inferences
- The test-writer should derive test rows from each unit's acceptance criteria because §6 is coarse. *Inference*, confidence Medium, based on `plan.md:76-77`, `:93-96`.
- A compile-time "missing symbol" failure is the usual TDD red in typed languages, and a separate test-failure phase may not be reachable. *Inference*, confidence Medium, based on the course wording at `test-writer.md:163-164`.
- The test-writer and implementer ownership overlap (the implementer's *Owns* includes tests, `implementer.md:188-189`) will need a rule on which agent writes a unit's tests. *Inference*, confidence Medium.
- Fail-closed when no test globs are configured is consistent with the plugin's guards. *Inference*, confidence Medium, based on `guard-io.mjs:10-12`.

## Search log

| Tool | Query / pattern / path | Result |
|---|---|---|
| Read | dev-digest `agents/test-writer.md` | full file, 217 lines |
| Read | dev-digest `hooks/write-scope-guard.mjs`, `bash-scope-guard.mjs` | full |
| Read | spec-driven `README.md`, `templates/plan.md`, `agents/implementer.md` | full |
| Read | spec-driven `scripts/write-guard.mjs`, `bash-guard.mjs`, `lib/sdd-config.mjs`, `lib/guard-io.mjs`, `hooks/hooks.json` | full |
| Read | `docs/PLUGIN-GUIDELINES.md` | full |
| Glob | spec-driven `**/*`; dev-digest `.claude/hooks/**/*` | file lists |
| WebFetch | code.claude.com hooks and sub-agents docs | relevant sections, partial pages |

## Suggested next steps (recommendations only)
- Decide how the test-writer's write allow-list is configured. Options: a new `testGlobs` key, a fail-closed default, or a heuristic fallback.
- Decide whether to add a `testCommand` key, or to rely on `checkCommand` scoped by `{files}`.
- Decide ownership between the test-writer and implementer for unit tests.
- Decide whether to enrich plan §6 with per-behaviour rows linked to AC IDs.
- Extend `bash-guard.mjs` and `write-guard.mjs`, their tests and the README `## What it runs` section.
- Bump the `plugin.json` version.

## Sources
- `C:\Users\mgume\PycharmProjects\dev-digest\.claude\agents\test-writer.md:1-217`
- `C:\Users\mgume\PycharmProjects\dev-digest\.claude\hooks\write-scope-guard.mjs:1-106`
- `C:\Users\mgume\PycharmProjects\dev-digest\.claude\hooks\bash-scope-guard.mjs:1-141`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\README.md:1-361`
- `C:\Users\mgume\PycharmProjects\claude-market-place\docs\PLUGIN-GUIDELINES.md:1-165`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\templates\plan.md:1-112`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\agents\implementer.md:1-267`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\write-guard.mjs:1-76`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\bash-guard.mjs:1-127`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\lib\sdd-config.mjs:1-99`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\lib\guard-io.mjs:1-115`
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\hooks\hooks.json:1-27`
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/sub-agents

Skipped: the tail of both docs pages, `agent-check.mjs`, and the other agent files. Main risk: the plugin-agent `agent_type` format is inferred from a matcher example in the docs, not confirmed there.
