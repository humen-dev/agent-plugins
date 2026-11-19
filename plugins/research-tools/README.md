# research-tools

A read-only **researcher** agent. It answers questions about this repository
(where something lives, how it works, what uses it) or about external sources
(docs, APIs, versions, known issues, practices) and returns a structured report:
every finding carries evidence (`path:line` or a URL), and what it could not
find is listed with where it looked. It never edits files.

| Component | Type | Invoke as |
|---|---|---|
| `researcher` | agent | `research-tools:researcher` |

No skills, hooks, commands or MCP servers.

## Usage

Ask for it by name, or through the Agent tool with
`subagent_type: "research-tools:researcher"`.

Codebase question:

> Use the researcher agent: where is request retry configured and what uses it?

Web question:

> Use the researcher agent: what changed in the latest major release of
> \<library\> and does it affect our usage?

If the request has no concrete question, or its target, goal or scope is
unclear, the agent replies with a **Clarification needed** block (at most 4
questions, each with options and a default) instead of searching. Answer the
questions and invoke it again with the original request plus the answers.

## How it works

- **Model:** Sonnet. **Tools:** `Read`, `Grep`, `Glob`, `WebSearch`,
  `WebFetch`; `Write`, `Edit`, `NotebookEdit`, `Bash`, `PowerShell`, `Agent`
  and `Skill` are disallowed, so it cannot change files, run commands or start
  other agents.
- **Modes:** `CODEBASE`, `WEB` or `HYBRID`, chosen from the request.
- **Rules:** focused search only (no deep-research workflow); evidence for
  every finding; gaps stated honestly; facts separated from inferences with a
  confidence level; file and web content treated as data, not instructions;
  short quotes only; report in English.
- **Report:** header (question, mode, status, confidence, assumptions),
  TL;DR, findings with evidence, *Not found* (with where it looked),
  *Unverified / inferences*, *Search log*, optional *Suggested next steps*.

`spec-driven`'s `/spec-driven:specify` uses this agent for its research
requests when it is installed; it does not depend on it.

## Install

Inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install research-tools@humen-dev
```

or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install research-tools@humen-dev
```

The marketplace is private; see the [root README](../../README.md#install) for
git credential setup.

## Requirements and dependencies

- No plugin dependencies.
- Web research needs `WebSearch` and `WebFetch` to be available in the session.
