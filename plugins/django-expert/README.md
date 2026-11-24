# django-expert

Django backend development guidance for Claude: models and the ORM, views and
URLs, Django REST Framework, forms, authentication, testing, performance,
security and production deployment.

| Component | Type | Invoke as |
|---|---|---|
| `django-expert` | skill | model-invoked by its description, or `/django-expert:django-expert` |

No agents, hooks, commands or MCP servers.

## When it triggers

Claude loads the skill when you create Django models, views, serializers or
APIs; debug ORM queries or migrations; optimise database performance; implement
authentication; write tests; or work with Django REST Framework.

The skill classifies the request and reads only the matching reference files in
`skills/django-expert/references/`: models and ORM, views and URLs, DRF
guidelines, testing strategies, performance optimisation, security checklist,
production deployment, and worked examples.

## Install

Inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install django-expert@humen-dev
```

or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install django-expert@humen-dev
```

See the [root README](../../README.md#install) for full install instructions.

## Requirements and dependencies

None. This plugin is installed automatically as a dependency of
[`django-reviewer`](../django-reviewer/README.md), which preloads this skill.

## Credits

Copied unchanged from
[vintasoftware/django-ai-plugins](https://github.com/vintasoftware/django-ai-plugins)
(MIT, © Vinta Software). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
