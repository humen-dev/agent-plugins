# codebase-onboarding

An **onboarding report** for an unfamiliar repository. When you start on a new
project or join an existing one, the skill analyses the codebase and prints a
structured report in chat: purpose, stack, architecture, how to run it
locally, tests, conventions, CI/CD and deployment, data, integrations,
security, observability, where to start reading, and open questions for the
team.

| Component | Type | Invoke as |
|---|---|---|
| `codebase-onboarding` | skill | `codebase-onboarding:codebase-onboarding` |

No agents of its own, hooks, commands or MCP servers.

## When it triggers

Claude uses the skill when you start working on a new or unfamiliar
repository, or ask for an overview:

> Onboard me to this codebase.

or explicitly with `/codebase-onboarding:codebase-onboarding`. It is not meant
for reviewing a diff or for questions about a single file.

## How it works

1. **Triage** in the main session: top-level tree, manifests, git history
   (first and last commit, commit and tag count) — classifies the project as
   fresh or mature.
2. **Three parallel Explore agents** analyse the code: stack and local
   development; architecture and data; delivery and quality. Their file
   reads stay out of the main context. Repositories with fewer than ~100
   tracked files are read directly instead, which is cheaper.
3. **Merge** into a 13-section report (0 TL;DR … 12 Open questions). For a
   fresh project, empty sections say what is missing (no CI, no tests, …).

- **Read-only:** no files written, nothing installed or run, no network.
- **Evidence:** every claim cites a `path` or `path:line`; unknowns are
  marked "not found" and listed as open questions.
- **Secrets:** only environment variable names are reported, never values.
- **Cost:** three subagents read the repository, so a run costs noticeably
  more tokens than an ordinary question, growing with repository size.

## Install

Inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install codebase-onboarding@humen-dev
```

or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install codebase-onboarding@humen-dev
```

The marketplace is private; see the [root README](../../README.md#install) for
git credential setup.

## Requirements and dependencies

None. Works with any stack; it detects the stack from the repository files.
