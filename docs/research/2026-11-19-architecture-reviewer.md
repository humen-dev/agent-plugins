# Research report: stack-agnostic architecture-reviewer design inputs

| Field | Value |
|---|---|
| Question | How should a stack-agnostic architecture-reviewer subagent be built, with rules coming only from the target project's skills, agent docs and INSIGHTS.md? |
| Mode | HYBRID (local files plus official sub-agent docs) |
| Status | ⚠️ Partially found (the dev-digest hook script `bash-scope-guard.mjs` was not read; see Not found) |
| Confidence | High for the course files and repo conventions, Medium for the doc claims |
| Assumptions | "Course version" means the dev-digest-ai-marketplace plugin file. Paths are abbreviated: **DDM** = `C:\Users\mgume\PycharmProjects\dev-digest-ai-marketplace\plugins\architecture-review`, **DD** = `C:\Users\mgume\PycharmProjects\dev-digest\.claude\agents`, **CMP** = `C:\Users\mgume\PycharmProjects\claude-market-place`. |

## TL;DR
The course plugin version (DDM) is already about 80% stack-agnostic. It reads rules from skills, agent docs and `.claude/sdd.json`, and runs an optional `architectureCheck`. It uses a plugin-level Bash guard, because plugin agents ignore frontmatter hooks. The DevDigest originals (DD) are the hard-coded variants. A spec-driven port needs four changes.
1. **Config key:** use `checkCommand` (plus `{module}`/`{files}`) instead of `architectureCheck`.
2. **Skills:** replace the hard-wired onion/frontend skills with caller-passed `SKILL.md` paths, following the implementer pattern.
3. **INSIGHTS.md:** add INSIGHTS.md loading, which the course reviewer lacks.
4. **Hook:** extend the existing spec-driven `bash-guard.mjs` with a reviewer branch.

## Findings (codebase)

| # | What | Location | Notes |
|---|---|---|---|
| 1 | The DD full reviewer is DevDigest-hard-coded | `DD\architecture-reviewer.md:3,7-10,16,66,136-183` | Skills `onion-architecture` and `frontend-ui-architecture`; `.claude/hooks/bash-scope-guard.mjs`; fixed depcruise command; named rules; `reviewer-core`; vendored `@devdigest/shared`. |
| 2 | The DD lite variant | `DD\architecture-reviewer-lite.md:3,18-21,55-63` | Lenient; verdict is only `request_changes` or `approve`; max 5 findings. |
| 3 | The DDM course version is config-driven | `DDM\agents\architecture-reviewer.md:60-69` | Reads `.claude/sdd.json` keys `architectureCheck`, `modules`, `agentDocs`. |
| 4 | DDM Bash guard as a plugin-level hook, inert unless `agent_type` matches | `DDM\scripts\bash-guard.mjs:29-33,271`; `DDM\hooks\hooks.json:1-16` | See Details 5. |
| 5 | spec-driven already has the config loader and guard infrastructure | `CMP\plugins\spec-driven\scripts\lib\sdd-config.mjs:16-25`; `CMP\plugins\spec-driven\scripts\bash-guard.mjs:27-31,94`; `CMP\plugins\spec-driven\hooks\hooks.json:15-23` | Config keys are `checkCommand`, `modules`, `agentDocs`, `specsDir`, `plansDir`. The guard acts only for `spec-driven:implementer`. |
| 6 | The planner already loads INSIGHTS.md | `CMP\plugins\spec-driven\agents\planner.md:183-187` | Root and touched-module INSIGHTS.md, if present. Entries are high-confidence constraints, cited as `<module>/INSIGHTS.md:line`. |
| 7 | The implementer's skill-path pattern | `CMP\plugins\spec-driven\agents\implementer.md:18-39` | Preloads no skills; the orchestrator passes absolute `SKILL.md` paths; a missing path gives `BLOCKED`. |
| 8 | Repo rules for reviewers and hooks | `CMP\docs\PLUGIN-GUIDELINES.md:112-123,125-133,141-156` | Reviewers are read-only; plugin agents ignore `hooks`; call Node scripts through `node "${CLAUDE_PLUGIN_ROOT}/…"`; hooks need a README `## What it runs` section. |

### Details

#### 1. Discover and load the rules (generalises)
- Read `.claude/sdd.json`. A missing file or key means defaults (`DDM\agents\architecture-reviewer.md:62`).
- Read `agentDocs` (default `AGENTS.md`, `CLAUDE.md`) at the root and inside each touched module (`DDM:69`).
- Rules in those docs are review criteria: layer names, allowed imports, path aliases, security-critical paths, known drift.
- **To add:** read root and touched-module `INSIGHTS.md`, as the planner does (`planner.md:183-187`). Treat entries as high-confidence constraints and cite them in findings as `<module>/INSIGHTS.md:line`.
- **Precedence** (DDM:42-47): injected skills are binding. A project doc that explicitly overrides a skill rule wins, and the finding must say so. Drift the docs list as "known drift" is never a precedent. Settled decisions are not findings.
- **Skills:**
  - Frontmatter `skills:` is stack-specific (`DDM:7-10` hard-wires `engineering-paved-path:*`). The docs say subagents don't inherit the parent's skills, so preloading is the only automatic way to get them. This is from the official docs, [sub-agents](https://code.claude.com/docs/en/sub-agents).
  - spec-driven is stack-agnostic, so use the implementer approach. The agent preloads nothing. The orchestrator or command passes absolute `SKILL.md` paths for architecture-relevant skills (`implementer.md:20-33`). The reviewer reads them in full, then their `references/…`.
  - `Skill` is in `disallowedTools` everywhere, so the agent cannot discover skills itself.
  - A missing listed path gives `BLOCKED`.
  - If the plan's units list skills, derive the skills list from them. Inference, confidence Medium.

#### 2. Scope input (generalises; DDM and DD are identical here)
- `range` defaults to `git merge-base main HEAD` through the working tree, including untracked files via `git status --porcelain` (`DDM:114-115`). The main branch name is hard-coded. For a stack-agnostic port, resolve `main` or `master` (inference).
- `paths` reviews files as they are now; every line counts as new (`DDM:116`).
- Optional `plan`. Unit *Owns* rows and the placement column state the intended placement.
  - A file placed against both plan and skill is a finding.
  - A plan that contradicts the skill goes under *Not reviewed* as a plan issue, not silently followed (`DDM:117-121`).
  - spec-driven plan §2 has a "Rule that applies" column (`planner.md:314`), which maps onto this.
- `previous` is a prior report, and it triggers re-review mode.
- An inline diff with no repo access: state that commands could not be run and never claim a check passed (`DDM:123-125`).
- The lite variant also accepts a pasted diff (`DD lite:3`).

#### 3. Severity, confidence, verdict (generalises)
- CRITICAL: only when confirmed. That means a check-tool violation (confidence 100), or a quoted violation of a skill or project-doc rule.
- WARNING: judgement-dependent. Anything speculative ("might", "could") is at most WARNING.
- SUGGESTION: a better home exists and nothing is broken.
- Confidence is scored 0-100 and anything below 80 is dropped (`DDM:207-213`).
- The verdict is a pure function of the findings (`DDM:225-227`):

| Findings | Verdict |
|---|---|
| ≥1 CRITICAL | `request_changes` |
| findings, no CRITICAL | `comment` |
| none | `approve` |

- Pre-existing drift never affects the verdict; list at most 5 under its own section. Zero findings is a good answer.
- Security-critical paths marked by the docs: any change is a finding. CRITICAL if it weakens, bypasses or removes the guard; otherwise WARNING "needs explicit sign-off". The exploitability call stays with the security reviewer (`DDM:194-199`).

#### 4. Evidence format per finding (generalises)
- Table columns: `ID | Severity | Confidence | Rule | Location file:line | Evidence | Target location` (`DDM:238`).
- Rule is the check rule name, skill rule or project-doc rule. In the stack-agnostic port, add the INSIGHTS.md citation.
- Evidence is the offending import or a snippet of at most 2 lines, or the check's output line.
- Target location must be a path, not "move this".
- IDs are `A-<k>` in severity order.
- Verify step before reporting (`DDM:207-213`):
  - re-open the cited line;
  - confirm it is in the diff or an untracked file, otherwise move it to drift or drop it;
  - drop it if the type checker, tests or the check baseline already cover it;
  - score confidence.

#### 5. Optional tooling checks (generalises, with a key rename)
- DDM runs the configured command exactly as configured and appends only output-format flags (`DDM:67`).
- A non-configured check is reported as `not configured`. The agent never assumes depcruise or any other tool.
- Violations are CRITICAL, confidence 100, with the rule name taken from the tool output.
- A baseline or known-violations file that gains entries is CRITICAL (`DDM:164-166`).
- If the check fails to run (as opposed to reporting violations), set `BLOCKED` and add the failure to *Not reviewed* (`DDM:53-58,165-166`).
- Header row values: `pass`, `fail`, `not configured`, `not run` (`DDM:236,243-247`).
- **Divergence to resolve:**
  - DDM uses `architectureCheck`.
  - spec-driven has only `checkCommand`, and its README says "include an architecture check here" (`CMP\README.md:262`, `bash-guard.mjs:12-13`). `sdd-config.mjs` does not validate an `architectureCheck` key.
  - The `checkCommand` runs typecheck and tests too, which is the reviewer's "not your lane".
  - Options for the caller: (a) add an `architectureCheck` key to `sdd-config.mjs` DEFAULTS and validate, or (b) reuse `checkCommand`. Option (a) is cleaner (inference, Medium).
  - `{module}` and `{files}` placeholders already exist in the spec-driven guard (`bash-guard.mjs:41-82`).

#### 6. Stack-agnostic lenses
- DDM keeps onion and frontend-ui lenses and a TypeScript-flavoured checklist: `fetch` in components, `'use client'`, `tsconfig paths`, `new …Service(...)`, `helpers.ts`. See `DDM:169-206`. That is stack-specific.
- The agnostic replacement is: group files by module (`modules` has `kind` backend/frontend/library in DDM:68, but spec-driven `sdd-config.mjs:91` drops `kind` on load, so it would need adding). For each module apply the rules found in step 1 and the layer vocabulary found in the docs and skills.
- Generic checks that survive: import direction, no reach-ins to another module's internals, shared contracts changed in every copy, security-critical paths, config and docs outside every lens (go under *Not reviewed*).

#### 7. Re-review mode (generalises, verbatim reusable)
- Input is `previous` (report text or path) plus a `range` of the fix commits only (`DDM:127-148`).
- For each `A-<k>`, re-open the location, following the symbol if it moved. Mark it **fixed** (quote the new code), **open** (quote what still violates the rule), or **withdrawn**.
- A finding marked `disputed` by the implementer gets a verdict on the argument: keep it open with a one-line reply, or withdraw it.
- Review only the fix range for new findings. Do not re-review untouched code.
- The report adds a first `### Previous findings` table: `ID | Status | Evidence`.
- The verdict is computed over the remaining Findings.

#### 8. Read-only enforcement via hooks (generalises; one platform constraint)
- Official docs (sub-agents page): `hooks`, `mcpServers` and `permissionMode` frontmatter are ignored for plugin agents. Plugins ship hooks in `hooks/hooks.json` instead. `agent_type` is passed to hooks, and for plugin agents it is the scoped `plugin:agent` name. Source: [sub-agents](https://code.claude.com/docs/en/sub-agents).
- The DD project agent's frontmatter hook (`DD:11-16`) therefore works only as a project agent. A plugin port must use the plugin-level hook (`DDM\hooks\hooks.json`, README `DDM\README.md:114-118`).
- Frontmatter: `tools: Read, Grep, Glob, Bash` and `disallowedTools: Write, Edit, NotebookEdit, PowerShell, Agent, Skill, WebSearch, WebFetch` (`DDM:5-6`). This satisfies PLUGIN-GUIDELINES:112-114.
- Hook design (`DDM\scripts\bash-guard.mjs`):
  - Inert unless `agent_type` equals the full name (`:271`).
  - An allow-list of command segments split on `&&`, `||`, `;`, `|` and newline (`:63-68`).
  - Allowed segments: `cd <module path>` (paths from `modules`), read-only git, and the configured check.
  - Read-only git means `status`, `diff`, `log`, `show`, `merge-base`, `rev-parse`, `ls-files`, `ls-tree`, `cat-file`, `blame`, `describe`, and `branch --show-current` (`:36-49`).
  - Output flags rejected: `-o`, `--output`, `--ext-diff` (`:108`).
  - Rejected outright: redirection, backticks, `$`, background `&`, `tee`, env assignments (`:52-58`).
  - Exit 2 with a stderr reason that says what is allowed instead.
  - Fail-closed on unreadable input or config (`:250-283`).
  - It is Node built-ins only.
- For spec-driven, extend the existing `scripts\bash-guard.mjs` rather than add a second script. The current file hard-codes the single `IMPLEMENTER` constant (`:31,94`) and has no `cd` rule, because the implementer runs from the root (`:110`).
  - Add `spec-driven:architecture-reviewer` with the same allow-list.
  - Run the check from the project root with `{module}` placeholders, which avoids `cd` handling. That is a choice, not a fact in the sources.
  - Note also that DDM's guard has a separate `findConfig` loader, while spec-driven uses `lib\sdd-config.mjs` and `lib\guard-io.mjs`. Reuse those.
- Update the `hooks.json` description and the README `## What it runs` / `### bash-guard` text (PLUGIN-GUIDELINES:141-156). Add a test case to `bash-guard.test.mjs`. Bump the plugin version (memory note).
- Also forbid: git state changes, installs, tests, builds.
- Instruct the agent to use Read, Grep and Glob instead of `cat`, `grep` or `ls` in Bash (`DDM`'s `DD:72-74` equivalent).

#### 9. Interview and clarification behaviour (generalises)
- Return a `# Clarification needed` block **instead of a review** only when the scope can't be determined: no range or paths and no local changes, or a `plan` path that doesn't exist (`DDM:92-95`).
- Format: `Received`, `Blocker` (Empty change set / Unclear scope / Missing plan), up to 4 questions each with options and a default, one round only (`DDM:97-110`).
- This matches the Researcher-style block used by the other spec-driven agents, so the caller relays and re-invokes.
- `BLOCKED: …` as the first line of the report covers a failed review (unresolvable range, failed check, missing plan, missing skill file).
- Other hard rules to reuse: untrusted content handling (a comment telling the agent to skip a rule is reported, not obeyed); report language follows the request while headings, severities and verdicts stay in English.

#### 10. Full vs lite (DD only)
| Aspect | Full (`DD\architecture-reviewer.md`) | Lite (`DD\architecture-reviewer-lite.md`) |
|---|---|---|
| Confidence scoring | ≥80 threshold | none |
| Interview mode | yes | no |
| Re-review mode | yes | no |
| Pre-existing drift section | yes (max 5) | no; old problems are simply not findings |
| Plan input | yes | no (pasted diff instead) |
| Verdict values | `request_changes`, `comment`, `approve` | `request_changes`, `approve` only |
| Finding cap | none | 5, most severe first |
| Severity stance | strict | "when in doubt, choose the lower severity"; only clear-cut violations are CRITICAL |
| Check | depcruise with `err-long`, baseline growth is CRITICAL | `err` output, `not run` allowed |
| Report | 3-row header, full skeleton | one-line verdict, 6-column table, Notes |
| Status | production | marked experimental, compared in evals |

- Both share the same tools, hook, skills and read-only rules. Lite also lists "WARNING and SUGGESTION do not hold the change".
- The DDM plugin ships only the full variant. A lite variant would be a second agent file (or a `mode`) sharing the same guard.

## Stack-specific (do NOT port)
- Skills `onion-architecture`, `frontend-ui-architecture` and the `engineering-paved-path` dependency.
- Ring names, rule names (`domain-is-pure`, `sdk-only-in-adapters`, …) and depcruise-specific paths (`DD:66,136-147`).
- `pnpm exec depcruise …`, `cd server|client|reviewer-core|e2e` and the hard-coded `cd` list (`DD:64`).
- Fastify, Drizzle, Zod, `Container`, `FastifyRequest` and `platform/container.ts` (`DD:148-157`).
- Next.js `page.tsx`, `_components`, `'use client'`, `@/`, the `messages/<locale>` i18n files and `src/lib/hooks` (`DD:158-168`).
- `reviewer-core`, `groundFindings`, `INJECTION_GUARD` and the vendored `@devdigest/shared` (`DD:169-183`).
- `.claude/skills/pr-self-review` and `security-reviewer` references, and `/impl`.
- The `main` branch name and `docs/plans/<slug>.md` (spec-driven uses `plansDir`).
- DDM already generalised the descriptions to "orchestrate" these through skills and project docs. The agnostic text still names `fetch`, `'use client'`, ORM and SDK examples in the checklists (`DDM:169-206`). Treat these as illustrative at most.

## Not found
- **dev-digest hook script** `.claude/hooks/bash-scope-guard.mjs` — not read; the DDM equivalent (`bash-guard.mjs`) and the spec-driven guard were read instead. A glob for the DD hook file was not run.
- **Any architecture-reviewer in spec-driven today** — `CMP\plugins\spec-driven\agents\` holds only `spec-creator.md`, `implementer.md`, `planner.md`, and the README lists the verify step as planned (`README.md:6-11,19-22`).
- **A `kind` field in the spec-driven config** — the key is in DDM's `modules` description (`DDM:68`) but `sdd-config.mjs` (`:54-65,91`) neither validates nor keeps it.
- **An `architectureCheck` key in spec-driven config** — no mention in `sdd-config.mjs` (`:16-25`).
- **Official docs on hooks and skills** — only the sub-agents page was fetched, and only the first 100000 of 116321 characters. Hooks and skills pages were not opened.
- **The DDM eval cases and graders** — listed by the glob but not read. They could inform eval design for the new agent.
- **The dev-digest `INSIGHTS.md` format** — only the planner's use of it was checked.

## Unverified / inferences
- Using `checkCommand` as the architecture check has a lane problem (it includes typecheck and tests) — *inference*, confidence Medium, from `README.md:262` and DDM:35-37.
- Resolving `main` vs `master` instead of hard-coding `main` — *inference*, Medium; the implement skill already handles `main`/`master` (`README.md:190`).
- Deriving the skills list from the plan's unit *Skills* fields — *inference*, Medium.
- Running the check from the project root with `{module}` placeholders rather than `cd` — *inference*, Medium.

## Search log
| Tool | Query / pattern / path | Result |
|---|---|---|
| Glob | `plugins/architecture-review/**` in DDM | agent, hooks.json, bash-guard (+test), README, 5 eval cases |
| Glob | `**/*` in `CMP\plugins\spec-driven` | 3 agents, 2 hook scripts, `lib\`, skills, README |
| Read | DD full and lite agents; DDM agent, hooks.json, bash-guard.mjs, README | all read |
| Read | spec-driven README, PLUGIN-GUIDELINES, hooks.json, `sdd-config.mjs`, `bash-guard.mjs`, implementer (lines 1-90) | all read |
| Grep | `INSIGHTS` in `planner.md` | 6 hits |
| WebFetch | https://code.claude.com/docs/en/sub-agents | frontmatter, plugin-agent limits, skills, `agent_type` |

## Suggested next steps (recommendations only)
- Decide the check key (`architectureCheck` vs `checkCommand`) before drafting; it determines the `sdd-config.mjs` and guard changes.
- Read the DDM eval cases and graders to reuse them for a spec-driven eval.
- Use `agents/implementer.md` as the template for the skill-path and `BLOCKED` wording, and DDM's agent file for the rest.
- If a lite variant is wanted, ship it as a second agent file with the same guard, since the guard keys on `agent_type`.

## Sources
- `C:\Users\mgume\PycharmProjects\dev-digest-ai-marketplace\plugins\architecture-review\agents\architecture-reviewer.md` lines 1-253
- `C:\Users\mgume\PycharmProjects\dev-digest-ai-marketplace\plugins\architecture-review\hooks\hooks.json` lines 1-16
- `C:\Users\mgume\PycharmProjects\dev-digest-ai-marketplace\plugins\architecture-review\scripts\bash-guard.mjs` lines 1-285
- `C:\Users\mgume\PycharmProjects\dev-digest-ai-marketplace\plugins\architecture-review\README.md` lines 1-182
- `C:\Users\mgume\PycharmProjects\dev-digest\.claude\agents\architecture-reviewer.md` lines 1-227
- `C:\Users\mgume\PycharmProjects\dev-digest\.claude\agents\architecture-reviewer-lite.md` lines 1-75
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\README.md` lines 1-361
- `C:\Users\mgume\PycharmProjects\claude-market-place\docs\PLUGIN-GUIDELINES.md` lines 1-165
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\hooks\hooks.json` lines 1-27
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\bash-guard.mjs` lines 1-127
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\lib\sdd-config.mjs` lines 1-99
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\agents\implementer.md` lines 1-90
- `C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\agents\planner.md` lines 93, 114, 183-187, 214, 314, 334 (grep hits)
- https://code.claude.com/docs/en/sub-agents

Skipped: the DDM eval cases, the dev-digest hook script, and the hooks and skills doc pages. Risk: the `checkCommand` vs `architectureCheck` decision affects both the guard and the config loader.
