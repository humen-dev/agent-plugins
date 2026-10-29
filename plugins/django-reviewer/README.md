# django-reviewer

A read-only **Django/Python code reviewer** agent. It reviews changes for
clarity, project conventions, ORM/DRF anti-patterns, N+1 queries, and
authorization and validation gaps, and returns findings with `file:line`, why
each matters and a concrete recommendation. It never edits files; fixes are
applied by the caller.

| Component | Type | Invoke as |
|---|---|---|
| `django-reviewer` | agent | `django-reviewer:django-reviewer` |

No skills of its own, hooks, commands or MCP servers.

## When it triggers

Claude uses the agent proactively after Django code changes, or when you ask for
a Django code review:

> Review my Django changes with the django-reviewer agent.

or explicitly through the Agent tool with
`subagent_type: "django-reviewer:django-reviewer"`.

Scope: the files or directories you name; otherwise the uncommitted git changes
(`git diff`, `git diff --cached`, `git status`). With no changes and no target
it asks for one instead of reviewing the whole repository.

## How it works

- **Model:** Opus. **Tools:** `Read`, `Grep`, `Glob`, `Bash`, `Skill`;
  `Write`, `Edit`, `NotebookEdit`, `PowerShell` and `Agent` are disallowed.
  Its instructions limit `Bash` to read-only git commands.
- **Preloaded skills:** `django-expert:django-expert`,
  `django-celery-expert:django-celery-expert`, `cdrf-expert:cdrf-expert`.
  Files that use Celery or DRF are always reviewed against the matching skill.
- **Migrations:** loads `django-safe-migration` on demand if it is installed;
  otherwise reviews without it.
- The review ends with a **Skills used** line, so you can check which
  specialised skills were applied to which files.
- Recommendations preserve behaviour; any behaviour change (e.g. a defect fix)
  is flagged separately. Concrete defects are separated from optional
  refinements.

## Install

Inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install django-reviewer@humen-dev
```

or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install django-reviewer@humen-dev
```

The marketplace is private; see the [root README](../../README.md#install) for
git credential setup.

## Requirements and dependencies

- Depends on [`django-expert`](../django-expert/README.md),
  [`django-celery-expert`](../django-celery-expert/README.md) and
  [`cdrf-expert`](../cdrf-expert/README.md) (all `^1.0.0`), installed
  automatically.
- Optional: [`django-safe-migration`](../django-safe-migration/README.md) —
  install it to let the agent load it for migration reviews.

## Credits

Adapted from
[vintasoftware/django-ai-plugins](https://github.com/vintasoftware/django-ai-plugins)
(MIT, © Vinta Software); local changes are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
