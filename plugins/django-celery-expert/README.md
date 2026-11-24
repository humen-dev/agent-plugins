# django-celery-expert

Celery with Django: background task design, worker and broker configuration,
retries and error handling, Celery Beat periodic tasks, monitoring and
production deployment.

| Component | Type | Invoke as |
|---|---|---|
| `django-celery-expert` | skill | model-invoked by its description, or `/django-celery-expert:django-celery-expert` |

No agents, hooks, commands or MCP servers.

## When it triggers

Claude loads the skill when you design background tasks, configure Celery
workers, handle task retries and errors, tune Celery performance, implement
periodic tasks with Celery Beat, or set up production monitoring for Celery.

It is not meant for general Django questions unrelated to Celery, other task
systems (Django Q, Huey, RQ), pipeline orchestrators (Airflow, Prefect), or
frontend and API-only concerns.

The skill classifies the request and reads the matching reference files in
`skills/django-celery-expert/references/` (Django integration, task design
patterns, configuration, error handling, periodic tasks, monitoring, production
deployment) before implementing. Before presenting a solution it checks that
task arguments are serialisable, retried tasks are idempotent, errors are logged
with context and long-running tasks have timeouts.

## Install

Inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install django-celery-expert@humen-dev
```

or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install django-celery-expert@humen-dev
```

See the [root README](../../README.md#install) for full install instructions.

## Requirements and dependencies

None. If installed, [`django-reviewer`](../django-reviewer/README.md) loads this
skill when a review touches Celery tasks or configuration.

## Credits

Copied unchanged from
[vintasoftware/django-ai-plugins](https://github.com/vintasoftware/django-ai-plugins)
(MIT, © Vinta Software). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
