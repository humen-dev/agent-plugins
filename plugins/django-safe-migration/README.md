# django-safe-migration

Write, review and rewrite Django migrations for PostgreSQL with zero-downtime
guarantees: `SeparateDatabaseAndState` two-file splits, `AddIndexConcurrently`,
foreign keys with `NOT VALID` + `VALIDATE`, `db_default` for `NOT NULL` columns,
`lock_timeout`, and `RunPython` safety rules.

| Component | Type | Invoke as |
|---|---|---|
| `django-safe-migration` | skill | model-invoked by its description, or `/django-safe-migration:django-safe-migration` |

No agents, hooks, commands or MCP servers.

## When it triggers

Claude loads the skill whenever you mention migrations, Django schema changes or
deployment safety, even without saying "zero downtime" — for example "review
this migration", "is this migration safe?", "write a migration for…", "rewrite
this migration", "how do I add a NOT NULL column / drop a column / add an index /
rename a column / add a FK without downtime", "will this migration cause
locks?", "this migration is blocking production".

It works in three modes:

- **Review** — reports Errors, Warnings, structural issues and safe operations
  for a migration file.
- **Write** — produces a new migration that is safe for your deploy strategy.
- **Rewrite** — turns an unsafe migration into a safe sequence.

Details live in `skills/django-safe-migration/references/` (operation guide,
PostgreSQL locks, examples).

## Configuration

Optional. The skill reads a `## django-safe-migration` section from your
project instruction file (`CLAUDE.md` or `AGENTS.md`) and otherwise uses the
defaults shown:

| Key | Default |
|---|---|
| Django version | unknown (`db_default` needs Django 5.0+) |
| Deploy strategy | rolling deploy |
| Runtime guard | none (e.g. `django-pg-zero-downtime-migrations`) |
| Migration command | `python manage.py sqlmigrate` |
| Docs / wiki URL | none |

```markdown
## django-safe-migration
- Django version: 5.1
- Deploy strategy: rolling deploy
- Runtime guard: none
- Migration command: docker compose run web python manage.py sqlmigrate
- Docs URL: https://github.com/your-org/repo/wiki/migrations
```

## Install

Inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install django-safe-migration@humen-dev
```

or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install django-safe-migration@humen-dev
```

The marketplace is private; see the [root README](../../README.md#install) for
git credential setup.

## Requirements and dependencies

No plugin dependencies. Targets PostgreSQL. If installed,
[`django-reviewer`](../django-reviewer/README.md) loads this skill when a review
touches migrations.

## Credits

Copied unchanged from
[vintasoftware/django-ai-plugins](https://github.com/vintasoftware/django-ai-plugins)
(MIT, © Vinta Software). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
