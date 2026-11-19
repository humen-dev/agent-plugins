# Research report: doc-writer agent design for spec-driven

| Field | Value |
|---|---|
| Question | How to build a stack-agnostic doc-writer subagent from the DevDigest course version |
| Mode | HYBRID (local files + one official-docs page) |
| Status | ✅ Found |
| Confidence | High for local facts, Medium for docs/hook-wiring details |
| Assumptions | The plugin agent is `spec-driven:doc-writer`. "Course version" = `dev-digest/.claude/agents/doc-writer.md`. |

## TL;DR
Most of the course agent generalises: verify-against-code with `path:line`, "Not documented", never-copy-the-plan, Diátaxis, the Mermaid table, interview mode, the fixed report, and no Bash. Stack-specific parts are the package names, the `docs/README.md` Index format and the hard-coded globs in the hook. Two repo facts change the design.
- The course agent wires its hook in agent frontmatter. Plugin agents ignore `hooks` frontmatter, so enforcement must go into `plugins/spec-driven/hooks/hooks.json` plus `scripts/write-guard.mjs`, keyed on `agent_type`.
- Allow and deny globs must come from `.claude/sdd.json` instead of a hard-coded profile.

## Findings (codebase)

| # | What | Location | Notes |
|---|---|---|---|
| 1 | Course doc-writer: frontmatter, rules, steps, report | `dev-digest\.claude\agents\doc-writer.md:1-161` | Source of every item below. |
| 2 | Verify claims, cite `path:line`, "Not documented" | `doc-writer.md:33-36, 85-86, 139-140, 154` | Unverifiable claims never enter docs. |
| 3 | Never copy the plan, present tense | `doc-writer.md:37-38, 115-118` | Rewrite from code. |
| 4 | Never-edit list | `doc-writer.md:39-43` | Specs, AGENTS/CLAUDE/INSIGHTS/TESTING, plans, agent-prompts, skill-*. Drift is reported as a follow-up with an owner. |
| 5 | No git/shell, so the caller passes the range or a changed-file list | `doc-writer.md:24-27, 44`; frontmatter `tools`/`disallowedTools` at lines 5-6 | With no git, it reads the files the plan names. |
| 6 | Placement map and ADR rules | `doc-writer.md:88-111` | `<pkg>/docs/<topic>.md`, `<pkg>/docs/adr/NNNN-slug.md`, cross-package `docs/adr/`, package/root README. ADR is Nygard format, append-only, next free NNNN, first ADR creates the folder index. |
| 7 | Index linking | `doc-writer.md:47-49, 104-106` | Format is `- [name.md](./name.md) — summary`, inserted above a `_(add docs here …)_` placeholder. This is a DevDigest convention. |
| 8 | Diagram table and constraints | `doc-writer.md:120-135` | flowchart for structure, sequenceDiagram for call flow, stateDiagram-v2 for lifecycle, erDiagram for tables. ≤20 nodes, labelled edges, quoted special characters, one C4 level per flowchart, no `C4Context`, update an existing diagram instead of adding one. |
| 9 | Interview mode | `doc-writer.md:56-77` | At most 4 questions, with options and a default. One round, then write. Blockers: Missing source, Unclear target, Unclear doc type. |
| 10 | Fixed report | `doc-writer.md:145-160` | Written, Claims verified (path:line), Not documented, BLOCKED/follow-ups. It is written in the language of the request. |
| 11 | Course hook with hard-coded profile | `dev-digest\.claude\hooks\write-scope-guard.mjs:32-50` | Allow: README.md, `{server,client,reviewer-core,e2e,mcp}/README.md`, `.../docs/**/*.md`, `docs/adr/**/*.md`. Deny: `**/specs/**`, `**/AGENTS.md`, `**/CLAUDE.md`, `**/INSIGHTS.md`, `TESTING.md`, `docs/plans/**`, `docs/agent-prompts/**`, `docs/skill-*/**`. |
| 12 | Hook mechanics | `write-scope-guard.mjs:58-106` | Deny globs are checked first, then allow globs, then default deny. Paths outside the repo are denied. An unknown profile is denied. The rationale (lines 6-10) is that the list lives in the hook, so the agent cannot be talked into editing a spec. |
| 13 | Course agent uses frontmatter hooks | `doc-writer.md:9-14` | This does not work for a plugin agent (see finding 17). |
| 14 | Existing plugin hook | `plugins\spec-driven\hooks\hooks.json:3-14` | One `Write\|Edit` matcher runs `write-guard.mjs` for all agents. |
| 15 | Plugin guard dispatch | `plugins\spec-driven\scripts\write-guard.mjs:29-39` | A `RULES` Map keyed by full agent name (`spec-driven:spec-creator`, `spec-driven:planner`). Other agents pass through. A doc-writer entry would be added here. |
| 16 | Config-driven rules and fail-closed behaviour | `write-guard.mjs:41-76`; `scripts\lib\sdd-config.mjs:18-25, 76-93`; `scripts\lib\guard-io.mjs:21-48, 59-77` | The guard loads `.claude/sdd.json` (defaults `specsDir: specs/`, `plansDir: docs/plans/`, `agentDocs`, `modules`). Malformed config, missing `file_path` or paths escaping the project block the write. Block means exit 2 plus a stderr reason that says what is allowed instead. |
| 17 | Plugin agents ignore `hooks` frontmatter | `docs\PLUGIN-GUIDELINES.md:115-116`; confirmed at https://code.claude.com/docs/en/sub-agents | Official docs say plugin authors should ship hooks in `hooks/hooks.json`. Those hooks apply whenever the plugin is enabled, and the script must filter on `agent_type`. |
| 18 | Repo conventions | `docs\PLUGIN-GUIDELINES.md:99-123, 125-133, 135-156`; `plugins\spec-driven\README.md:252-319` | Agents declare `tools` and `disallowedTools`. Paths are not hard-coded to a project. Node scripts are called through `node "${CLAUDE_PLUGIN_ROOT}/…"`. The README needs a config row per new key and a `### write-guard` entry under `## What it runs`. |
| 19 | Existing config key model | `README.md:254-264` | Keys are `specsDir`, `plansDir`, `modules[].path`, `agentDocs`, `checkCommand`. `modules` already exists. There is no docs key yet. |
| 20 | Mermaid skill | `plugins\spec-driven\skills\mermaid-diagram\SKILL.md:23-37, 224-242`; `examples.md` exists but was not read | The decision table and the do/don't list (≤~20 nodes, label edges, one direction, no invisible links first) match the course rules. The skill is generic and has no C4 or quoting guidance. It is already preloaded by spec-creator (README line 38). |
| 21 | Stack-agnostic precedent for agent shape | `plugins\spec-driven\agents\implementer.md:1-7, 41-60, 107-143, 224-251` | Tools allow-list plus `disallowedTools`, "Project configuration" table, "Never invent a command", `BLOCKED:` first in the follow-ups, report in the request's language. |

## Details by topic

### Verification and citation (generalises fully)
- Build a candidate-claim list from the source, then check each with Glob, Grep and Read.
- Keep a claim only with a `path:line`; otherwise it goes to *Not documented* (`doc-writer.md:85-86`).
- The "Claims verified" section of the report is the audit trail. The self-check requires every factual sentence to appear there (`doc-writer.md:139`).

### Placement rules (generalise the shape, not the paths)
- Content kinds map to destinations: explanation, ADR, how-to, overview/README, and "not ours" (specs, gotchas).
- Stack-specific parts:
  - package names;
  - the Index placeholder line;
  - `<pkg>/docs/README.md` as the index file.
- Config options to consider (these are inferences, not existing keys):
  - add a `docsDir` or per-module `docsDir`, defaulting to `<module path>/docs/`;
  - add `adrDir`, defaulting to `docs/adr/`;
  - add `docsIndex`, a file name defaulting to `README.md`;
  - add a `docWriter.deny` list for extra protected globs.
- Reuse `modules[].path`. Do not add a parallel package list.
- When the project has no docs convention, the course ask-first rule fits: "if both are silent, it asks" (the planner rule, `README.md:149-150`).
- Per-package Index insertion is only safe if the index file exists. Otherwise infer the format from the existing docs, or put the question in interview mode.

### Never-touch files and hook enforcement
- Always deny, regardless of config:
  - everything under `specsDir` and every module `specsDir` (`specDirs(config)` already exists);
  - `plansDir`;
  - `.claude/` (including `sdd.json`);
  - files named in `agentDocs` (default AGENTS.md and CLAUDE.md);
  - every `INSIGHTS.md`;
  - the spec template.
- Allow only `*.md` under the resolved docs dirs and the ADR dir, plus module and root `README.md`.
- Deny-first ordering, outside-project blocking and fail-closed behaviour are already present in both guards (finding 12 and finding 16).
- Fit with the existing plugin guard:
  - add `['spec-driven:doc-writer', docsOnly]` to `RULES` (`write-guard.mjs:29-32`);
  - add a `docDirs` helper to `sdd-config.mjs`;
  - add validation for the new keys at `sdd-config.mjs:45-68`;
  - extend the description in `hooks.json:2`;
  - add tests in `write-guard.test.mjs` (not read);
  - update the README "What it runs" and config table.
- The hook is needed even though the agent has Write and Edit, because the prompt alone cannot hold the scope.

### Diagram choice
- Rule: a diagram earns its place only when it shows more than prose. Examples are structure, a call flow over time, a lifecycle, and tables with relations.
- Types:
  - flowchart for structure;
  - sequenceDiagram for a request or call flow;
  - stateDiagram-v2 for a lifecycle;
  - erDiagram for tables;
  - classDiagram only for real type relationships (skill, lines 109-134).
- Do not use gantt, pie, journey, timeline or gitGraph for docs of existing code.
- Constraints to carry over: ≤20 nodes, labelled edges, quoted special characters, node names match the code, edit an existing diagram instead of duplicating it.
- The skill covers "labelled edges" and "≤~20 nodes". It does not cover one C4 level per flowchart or the C4Context ban. Those are course additions that could be stated in the agent body.

### No shell or git versus needing a git range
- The course agent takes the range as a label only and cannot run git (`doc-writer.md:24-27`).
- The caller must pass the changed-file list (or the agent reads the files the plan names).
- Plugin precedent: the implementer's Bash is allow-listed to read-only git by `bash-guard` (`README.md:305-319`).
- Options, as a design choice rather than a finding:
  - keep doc-writer Bash-free, and have the calling skill run `git diff --name-only <range>` and pass the list;
  - or give it guarded read-only git.
- The course approach is simpler and consistent with `spec-creator` and `planner`, which have no Bash.

### Report and interview
- Fixed report as in finding 10. Rename it "Doc-writer result".
- Keep the `BLOCKED:`-first rule from the implementer.
- Interview format at `doc-writer.md:64-77` is the same shape as the researcher template. It is reusable verbatim, with the blockers adapted.

## Generalises vs stack-specific

| Generalises | Stack/project-specific (replace with config or repo discovery) |
|---|---|
| Rules 1, 2, 4, 5, 7, 8, 9; Steps 0, 1, 4, 5 | The `server`/`client`/`reviewer-core`/`e2e`/`mcp` package list (`doc-writer.md:3, 27`; hook line 35) |
| Diagram table and constraints | `docs/README.md` Index and the `_(add docs here …)_` placeholder (`doc-writer.md:47-49`) |
| ADR format, numbering and append-only rule | `docs/agent-prompts/**`, `docs/skill-*/**`, `TESTING.md` deny entries (hook lines 44-47) |
| Never-edit categories (specs, plans, agent docs, INSIGHTS) | The `engineering-insights` skill reference (`doc-writer.md:43`) |
| Deny-first fail-closed hook mechanism | `$CLAUDE_PROJECT_DIR/.claude/hooks/...` frontmatter wiring (`doc-writer.md:9-14`) |
| Google style (second person, present tense) | The TypeScript-style relative link example `../src/review/run.ts` (`doc-writer.md:117`) |

## Not found
- **An existing `docsDir`, `adrDir` or doc-writer key in `sdd.json` handling** — searched: `sdd-config.mjs`, README config table. Result: none; these would be new.
- **`write-guard.test.mjs` and `bash-guard.mjs` content** — not read, so test conventions are not described here.
- **`mermaid-diagram/examples.md` content** — listed, not read.
- **Official-doc coverage beyond sub-agents** — the last ~16k characters of the sub-agents page and the hooks and skills pages were not read. Nothing on hook exit-code semantics was verified from docs; the exit-2 behaviour is from the repo's own `guard-io.mjs:14, 21-24`.
- **The Index convention in a non-DevDigest repo** — cannot be known.

## Unverified / inferences
- A `RULES` entry for `spec-driven:doc-writer` will receive `agent_type` of that form — *inference*, Medium. It is based on the existing entries (`write-guard.mjs:29-32`) and the docs statement that plugin subagent names are scoped.
- The config key names proposed above — *inference*, Low. They are my suggestions and not existing conventions.
- Index handling can be made generic by copying an existing index entry's format — *inference*, Medium.

## Search log
| Tool | Query / path | Result |
|---|---|---|
| Read | course `doc-writer.md`, `write-scope-guard.mjs` | full |
| Read | plugin `mermaid-diagram/SKILL.md`, README, PLUGIN-GUIDELINES, `write-guard.mjs`, `sdd-config.mjs`, `guard-io.mjs`, `hooks.json`, `implementer.md` | full |
| Glob | plugin tree; `dev-digest\.claude\hooks` | file lists |
| WebFetch | https://code.claude.com/docs/en/sub-agents | plugin-agent hook limitation, `agent_type`, `disallowedTools` (first 100k chars) |

## Suggested next steps (recommendations)
- Read `write-guard.test.mjs` before adding a doc-writer rule, so tests follow the existing style.
- Decide the Index handling (config key versus discover-and-copy) and the git-range handoff (skill passes the changed-file list versus guarded git) before writing the agent.
- Bump `plugin.json` version in the same PR (per the repo memory note).

## Sources
- C:\Users\mgume\PycharmProjects\dev-digest\.claude\agents\doc-writer.md:1-161
- C:\Users\mgume\PycharmProjects\dev-digest\.claude\hooks\write-scope-guard.mjs:1-106
- C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\skills\mermaid-diagram\SKILL.md:1-281
- C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\README.md:1-361
- C:\Users\mgume\PycharmProjects\claude-market-place\docs\PLUGIN-GUIDELINES.md:1-165
- C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\write-guard.mjs:1-76
- C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\lib\sdd-config.mjs:1-99
- C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\scripts\lib\guard-io.mjs:1-115
- C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\hooks\hooks.json:1-27
- C:\Users\mgume\PycharmProjects\claude-market-place\plugins\spec-driven\agents\implementer.md:1-267
- https://code.claude.com/docs/en/sub-agents

Not checked or skipped: the remaining docs pages and the test files. Main risk is the hook wiring. If the guard is left in agent frontmatter, it is silently ignored in the plugin.
