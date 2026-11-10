# humen-dev agent plugins

A private [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugins/create-marketplace)
for full-stack development: backend, frontend (React + TypeScript) and
spec-driven development (SDD). It currently ships Django backend plugins;
frontend and SDD plugins are planned.

## Install

This repository is private, so Claude Code uses your machine's git credentials.
For HTTPS, set up the GitHub CLI credential helper once:

```bash
gh auth login
gh auth setup-git
```

Then, inside Claude Code:

```text
/plugin marketplace add humen-dev/agent-plugins
/plugin install <plugin-name>@humen-dev
```

Or from a shell:

```bash
claude plugin marketplace add humen-dev/agent-plugins
claude plugin install <plugin-name>@humen-dev
```

### Share with a project

To make the marketplace available to everyone who opens a project, add it at
project scope (writes `extraKnownMarketplaces` to `.claude/settings.json`):

```bash
claude plugin marketplace add humen-dev/agent-plugins --scope project
```

### Updates

Auto-update is **off** by default for third-party marketplaces. Update manually:

```text
/plugin marketplace update humen-dev
```

or enable auto-update in `/plugin` → Marketplaces → `humen-dev`. After an
update, run `/reload-plugins` (or restart) to load the new version.

## Plugins

| Plugin | Kind | What it adds |
|--------|------|--------------|
| [`django-expert`](plugins/django-expert/) | skill | Django backend guidance: models and ORM, views and URLs, DRF, testing, performance, security, deployment |
| [`django-celery-expert`](plugins/django-celery-expert/) | skill | Celery with Django: task design, worker configuration, retries and error handling, Celery Beat, monitoring, production deployment |
| [`cdrf-expert`](plugins/cdrf-expert/) | skill | DRF class-based views via [Classy DRF](https://www.cdrf.co): choosing the right generic view or viewset, MRO, which method to override |
| [`django-safe-migration`](plugins/django-safe-migration/) | skill | Write, review and rewrite Django migrations for PostgreSQL with zero downtime |
| [`django-reviewer`](plugins/django-reviewer/) | agent | Read-only Django/Python code reviewer agent |
| [`codebase-onboarding`](plugins/codebase-onboarding/) | skill | Onboarding report for an unfamiliar repository: stack, architecture, setup, conventions, CI/CD, deployment |
| [`spec-creator`](plugins/spec-creator/) | agent | Stack-agnostic behaviour-spec agent for spec-driven development: EARS requirements, module interactions, untrusted-input rules; writes only spec Markdown (hook-enforced) |

## Repository layout

```text
.claude-plugin/marketplace.json   catalog of plugins
plugins/<name>/                   one folder per plugin
  .claude-plugin/plugin.json      plugin manifest (name, version, ...)
  skills/<skill>/SKILL.md         skill, with optional references/
  agents/<agent>.md               subagent
  README.md                       what the plugin adds and how to use it
  THIRD_PARTY_NOTICES.md          attribution and license, for copied plugins
docs/                             plugin guidelines, security policy, releases
scripts/                          structural linter and version-bump check (CI)
CONTRIBUTING.md                   how to add or change a plugin
```

## Develop locally

```bash
# add this checkout as a local marketplace (plugins load in place)
claude plugin marketplace add ./
claude plugin install <plugin-name>@humen-dev

# after editing a plugin, inside Claude Code
/reload-plugins

# validate the marketplace and plugins
claude plugin validate . --strict
```

Every plugin pins `version` in its `plugin.json`, and users receive an update
only when that value changes. **Bump `version` in the plugin's `plugin.json` in
the same PR as the change** (SemVer):

- MAJOR — removed or renamed skill, agent or command; changed behaviour.
- MINOR — new component or option.
- PATCH — fixes and wording.

## License and credits

The Django plugins are copied from
[vintasoftware/django-ai-plugins](https://github.com/vintasoftware/django-ai-plugins)
under the MIT License. Each plugin ships its own `THIRD_PARTY_NOTICES.md` with
the upstream path, source commit, local changes and the licence text:

- [django-expert](plugins/django-expert/THIRD_PARTY_NOTICES.md)
- [django-celery-expert](plugins/django-celery-expert/THIRD_PARTY_NOTICES.md)
- [cdrf-expert](plugins/cdrf-expert/THIRD_PARTY_NOTICES.md)
- [django-safe-migration](plugins/django-safe-migration/THIRD_PARTY_NOTICES.md)
- [django-reviewer](plugins/django-reviewer/THIRD_PARTY_NOTICES.md)
