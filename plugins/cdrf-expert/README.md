# cdrf-expert

Django REST Framework class-based views, navigated with
[Classy DRF](https://www.cdrf.co): choosing the right generic view or viewset,
tracing the method resolution order (MRO), and picking the narrowest method to
override.

| Component | Type | Invoke as |
|---|---|---|
| `cdrf-expert` | skill | model-invoked by its description, or `/cdrf-expert:cdrf-expert` |

No agents, hooks, commands or MCP servers.

## When it triggers

Claude loads the skill when you select or debug `APIView`, `GenericAPIView`,
concrete generic views, mixin combinations, or `ViewSet` / `GenericViewSet` /
`ModelViewSet` behaviour; trace the MRO; decide which method to override
(`create` vs `perform_create`, `update` vs `perform_update`, `destroy` vs
`perform_destroy`, `get_queryset`, `get_serializer_class`); or compare behaviour
across DRF versions.

It is not meant for function-based views, GraphQL, FastAPI/Flask, frontend work
or non-DRF backends.

The skill reads only the reference files it needs from
`skills/cdrf-expert/references/` (class selection matrix, lifecycle and
overrides, MRO debugging playbook, version-check workflow), opens the cdrf.co
pages for your DRF version first, and cites exact class and method names. If
the DRF version is unknown it asks for it or marks its assumptions; if cdrf.co
is unreachable it falls back to the official DRF docs and installed source.

## Install

Inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install cdrf-expert@humen-dev
```

or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install cdrf-expert@humen-dev
```

See the [root README](../../README.md#install) for full install instructions.

## Requirements and dependencies

None. The skill browses cdrf.co when it is reachable. If installed,
[`django-reviewer`](../django-reviewer/README.md) loads this skill when a review
touches DRF class-based views or viewsets.

## Credits

Copied unchanged from
[vintasoftware/django-ai-plugins](https://github.com/vintasoftware/django-ai-plugins)
(MIT, © Vinta Software). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
