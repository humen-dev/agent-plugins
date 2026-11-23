import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { generate } from '../scripts/generate.mjs';
import { readHistory } from '../scripts/lib/history.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const jsonIf = (rel) => (existsSync(join(ROOT, rel)) ? readJson(rel) : null);
const walk = (rel) =>
  readdirSync(join(ROOT, rel), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${rel}/${e.name}`) : [`${rel}/${e.name}`]);
const dirs = (rel) => (existsSync(join(ROOT, rel)) ? readdirSync(join(ROOT, rel), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);

/** @type {import('../src/catalog/types.ts').Catalog} */
let catalog;
beforeAll(async () => {
  catalog = (await generate({ root: ROOT, repo: 'humen-dev/agent-plugins' })).catalog;
}, 30_000);

const relative = () => readJson('.claude-plugin/marketplace.json').plugins.filter((p) => typeof p.source === 'string' && p.source.startsWith('./'));
const artifactsOf = (plugin, kind) => catalog.artifacts.filter((a) => a.plugin === plugin && a.kind === kind);

describe('real repo', () => {
  it('plugin set = relative-source marketplace entries (AC-6a)', () => {
    expect(catalog.plugins.map((p) => p.name)).toEqual(relative().map((p) => p.name).sort());
  });

  it('artifact counts per plugin and kind match the source files (AC-6b)', () => {
    for (const { name, source } of relative()) {
      const base = source.replace(/^\.\//, '');
      const hooks = jsonIf(`${base}/hooks/hooks.json`);
      const events = hooks?.hooks ?? hooks ?? {};
      const mcp = jsonIf(`${base}/.mcp.json`);
      const expected = {
        skill: dirs(`${base}/skills`).filter((d) => existsSync(join(ROOT, base, 'skills', d, 'SKILL.md'))).length,
        agent: existsSync(join(ROOT, base, 'agents')) ? readdirSync(join(ROOT, base, 'agents')).filter((f) => f.endsWith('.md')).length : 0,
        command: existsSync(join(ROOT, base, 'commands')) ? walk(`${base}/commands`).filter((f) => f.endsWith('.md')).length : 0,
        hook: Object.entries(events).filter(([k]) => k !== 'description').reduce((n, [, g]) => n + g.reduce((m, x) => m + (x.hooks?.length ?? 0), 0), 0),
        mcp: Object.keys(mcp?.mcpServers ?? mcp ?? {}).length,
      };
      for (const [kind, n] of Object.entries(expected)) expect(artifactsOf(name, kind), `${name} ${kind}`).toHaveLength(n);
    }
  });

  it('spec-creator has 3 preloadedSkills, plan-verifier maxTurns 100 (AC-3)', () => {
    const agent = (name) => catalog.artifacts.find((a) => a.kind === 'agent' && a.name === name);
    expect(agent('spec-creator').preloadedSkills).toHaveLength(3);
    expect(agent('plan-verifier').maxTurns).toBe(100);
  });

  // catalog.changes is capped at 100, so history is read unsliced here.
  it('34c247a is added for spec-driven and change for spec-creator (AC-71)', () => {
    const at = readHistory(ROOT, 'https://github.com/o/r').changes.filter((c) => c.commit.startsWith('34c247a'));
    expect(at.find((c) => c.plugin === 'spec-driven')?.type).toBe('added');
    expect(at.find((c) => c.plugin === 'spec-creator')?.type).toBe('change');
  });

  it('commits before 34c247a under plugins/spec-creator/ carry the old name (EC-10)', () => {
    const shas = execFileSync('git', ['rev-list', '--no-merges', '34c247a^', '--', 'plugins/spec-creator/'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean);
    expect(shas.length).toBeGreaterThan(0);
    const { changes } = readHistory(ROOT, 'https://github.com/o/r');
    for (const sha of shas) expect(changes.find((c) => c.commit === sha && c.plugin === 'spec-creator'), sha).toBeDefined();
  });

  it('django-reviewer runs code because of the shell (EC-18)', () => {
    expect(catalog.plugins.find((p) => p.name === 'django-reviewer')?.runs.reasons).toEqual(['shell']);
  });
});
