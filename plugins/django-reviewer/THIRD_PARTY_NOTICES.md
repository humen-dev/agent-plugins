# Third-party notices — django-reviewer

This plugin's agent is copied from a third-party project.

| | |
|---|---|
| **Upstream repository** | [vintasoftware/django-ai-plugins](https://github.com/vintasoftware/django-ai-plugins) |
| **Upstream path** | `plugins/django-reviewer/agents/django-reviewer.md` |
| **Source commit** | [`b8af2688d994747666e6a793d441365807d6772f`](https://github.com/vintasoftware/django-ai-plugins/tree/b8af2688d994747666e6a793d441365807d6772f) |
| **Copyright holder** | Vinta Software |
| **Licence** | MIT (declared as "MIT © Vinta Software" in the upstream README and `"license": "MIT"` in its plugin manifests) |

## Local changes

`agents/django-reviewer.md` was modified:

- made the agent **read-only**: added `tools: Read, Grep, Glob, Bash, Skill`
  and `disallowedTools: Write, Edit, NotebookEdit, PowerShell, Agent`;
  rewrote the *Authorization Boundary* section (never create, modify, move or
  delete files; return suggested changes for the caller to apply; Bash only for
  read-only git commands) and removed the upstream edit-authorized mode from the
  review process, output and success criteria; behaviour changes are now flagged
  separately instead of applied;
- rewrote the `description` to match (read-only, review scope, output format);
- **preloads** the `django-expert:django-expert`,
  `django-celery-expert:django-celery-expert` and `cdrf-expert:cdrf-expert`
  skills (`skills` frontmatter), with plugin dependencies on all three; the
  review process makes the Celery and DRF skills mandatory for matching files
  and the output ends with a *Skills used* line;
- may **load** `django-safe-migration` for migrations when available (`Skill`
  tool);
- wording "this skill" changed to "this agent";
- removed the generated-file comment.

The plugin manifest (`.claude-plugin/plugin.json`) was adapted from the
upstream one for this marketplace (version, description, keywords, dependencies),
and this plugin's `README.md` was written for this marketplace.

## Licence text

The upstream repository has no licence file, so the standard MIT text is
reproduced below with the declared copyright holder.

```text
MIT License

Copyright (c) Vinta Software

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
