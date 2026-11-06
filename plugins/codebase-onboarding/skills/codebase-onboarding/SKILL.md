---
name: codebase-onboarding
description: Analyse an unfamiliar repository and print an onboarding report in chat — purpose, stack, architecture, how to run it locally, tests, conventions, CI/CD and deployment, data, integrations, security, observability, and where to start reading. Use when the user starts working on a new or unfamiliar repository, joins an existing project, or asks for an overview, onboarding, or "explain this codebase". Do not use for reviewing a diff or for questions about a single file.
---

# Codebase Onboarding

Produce a factual onboarding report for the repository so a developer new to
it knows what it is, how it is built, run, tested and deployed, and where to
start. Works for any stack: detect it from the files, never assume it.

## Rules

- **Read-only.** Never create or modify files, install dependencies, run the
  app, tests or migrations, or access the network. Bash only for read-only
  commands such as `git log`, `git ls-files`, `git shortlog -sn`, `git tag`,
  `ls`.
- **Evidence for every claim.** Cite `path` or `path:line`. If something is
  not found, write "not found" — never guess. Anything unresolved goes to
  *Open questions*.
- **No secret values.** List environment variable **names** only (from
  `.env.example`, settings, compose files, CI). Never print values from
  `.env`, settings, CI files, or anything that looks like a key, token or
  password.
- **Scope.** The repository root is the current working directory unless the
  user names another path.
- **Output in chat only.** Do not write the report to a file unless the user
  asks.

## Step 1 — Triage (main session, keep it cheap)

Collect, without reading file contents in bulk:

- top-level tree and `git ls-files | wc -l`;
- which manifests and config files exist (e.g. `pyproject.toml`,
  `requirements*.txt`, `package.json`, lockfiles, `Dockerfile`,
  `docker-compose*.yml`, `.github/workflows/`, `Makefile`, `README*`,
  `CLAUDE.md`, `AGENTS.md`);
- first and last commit dates, commit count, tag count.

Classify the project:

- **fresh** — few commits or weeks of history, no tags, little CI;
- **mature** — long history, releases or tags, CI and deployment config.

## Step 2 — Analyse with three parallel Explore agents

**Small repository (fewer than ~100 tracked files):** skip the agents and read
the relevant files directly in the main session; it is cheaper and just as
complete. Otherwise you **must** delegate: after triage, do not read source
files yourself — launch all three agents in **one message** with `subagent_type: "Explore"`. Give
each: the repository path, the triage summary, the Rules above, its section
list with the bullet descriptions from the template below, and this
instruction: "Return compact findings per section with evidence paths. No
file dumps, no secret values. Say 'not found' when something is absent."

| Agent | Focus | Sections |
|---|---|---|
| A | Stack and local development | 1, 3, 4 |
| B | Architecture and data | 0 (purpose and domain only), 2, 7, 8 |
| C | Delivery and quality | 5, 6, 9, 10 |

## Step 3 — Merge and report

Merge the findings into the template. Resolve contradictions between agents by
checking the cited file yourself. Keep each section to about 8 bullets.

- **Fresh project:** for empty sections, state what is missing (no CI, no
  tests, no linter, no README, no deployment config) instead of leaving them
  blank.
- **Mature project:** keep sections factual; do not suggest refactors.

## Report template

```markdown
# Onboarding: <repository name>

## 0. TL;DR
Purpose and domain; stage (fresh / mature, first and last commit dates,
commit count); 3–5 key facts.

## 1. Stack
Languages and versions, frameworks, key libraries, database, cache, queue,
package manager — from manifests and lockfiles.

## 2. Architecture and layout
Entry points, map of modules / apps / packages, layers, where business logic
lives, how a request flows from URL or route to the database.

## 3. Run locally
Prerequisites, setup commands (Makefile, scripts, compose services),
environment variable names, seed or fixture data.

## 4. Tests
Framework, how to run, fixtures / factories, what CI runs.

## 5. Conventions
Linters, formatters, type checker, pre-commit hooks, naming and import style,
commit / branch / PR conventions, CODEOWNERS.

## 6. CI/CD and deployment
Pipelines and triggers, environments, Dockerfiles, IaC, deploy strategy
(rolling or with downtime), whether migrations run on deploy.

## 7. Data
Key models / entities and relations, migrations state, background jobs and
schedules.

## 8. Integrations
External APIs, payments, email, file storage, auth providers.

## 9. Security and config
Authentication and authorisation model, settings / config split, where secrets
come from (location only, never values).

## 10. Observability
Logging, error tracking, metrics, health checks.

## 11. Where to start
5–10 files to read first, one line each on why.

## 12. Open questions
What could not be determined from the code; questions to ask the team.
```
