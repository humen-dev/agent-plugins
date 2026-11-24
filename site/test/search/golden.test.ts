import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { generate } from '../../scripts/generate.mjs';
import type { Catalog } from '../../src/catalog/types.ts';
import { createSearch } from '../../src/search/search.ts';

const ROOT = resolve(import.meta.dirname, '../../..');

let search: ReturnType<typeof createSearch>;
beforeAll(async () => {
  const { catalog } = (await generate({ root: ROOT, repo: 'humen-dev/agent-plugins' })) as { catalog: Catalog };
  search = createSearch(catalog);
}, 30_000);

// SPEC-01 AC-14. The list never changes without the owner's approval.
const GOLDEN: [string, string[]][] = [
  ['I need a skill for safe migrations', ['skill:django-safe-migration/django-safe-migration']],
  ['review django code', ['agent:django-reviewer/django-reviewer']],
  ['write a spec with EARS', ['skill:spec-driven/specify', 'skill:spec-driven/ears-requirements']],
  ['celery retries', ['skill:django-celery-expert/django-celery-expert']],
  ['onboard to a new repo', ['skill:codebase-onboarding/codebase-onboarding']],
  ['hook that guards bash', ['hook:spec-driven/bash-guard']],
  ['mermaid diagram', ['skill:spec-driven/mermaid-diagram']],
  ['drf viewset override', ['skill:cdrf-expert/cdrf-expert']],
];

describe('golden queries (AC-14)', () => {
  it.each(GOLDEN)('%s', (q, expected) => {
    const top = search.run({ q, kinds: [], cats: [] }).cards.slice(0, 5).map((c) => `${c.key} ${c.score.toFixed(2)}`);
    const top3 = top.slice(0, 3).map((s) => s.split(' ')[0]);
    expect(top3.some((k) => expected.includes(k)), `top 5: ${top.join(' | ')}`).toBe(true);
  });
});
