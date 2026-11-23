import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const wf = parse(readFileSync(new URL('../../.github/workflows/site.yml', import.meta.url), 'utf8'));
const PATHS = ['plugins/**', '.claude-plugin/**', 'site/**', 'scripts/validate-marketplace.mjs', '.github/workflows/site.yml'];
const jobs = Object.values(wf.jobs);
const steps = (j) => j.steps.map((s) => s.name ?? s.uses);

describe('site.yml', () => {
  it('is named Site with exactly the two jobs', () => {
    expect(wf.name).toBe('Site');
    expect(jobs.map((j) => j.name).sort()).toEqual(['Site: build', 'Site: tests']);
  });

  it('filters pull_request and push(main) by the spec paths, and allows dispatch', () => {
    expect(wf.on.pull_request.paths).toEqual(PATHS);
    expect(wf.on.push.paths).toEqual(PATHS);
    expect(wf.on.push.branches).toEqual(['main']);
    expect('workflow_dispatch' in wf.on).toBe(true);
  });

  it('grants only contents: read at workflow and job level', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
    for (const j of jobs) expect(j.permissions).toEqual({ contents: 'read' });
  });

  it('installs with npm ci in site/ and checks out full history', () => {
    for (const j of jobs) {
      const ci = j.steps.find((s) => s.run === 'npm ci');
      expect(ci?.['working-directory']).toBe('site');
      expect(j.steps[0].with['fetch-depth']).toBe(0);
    }
  });

  it('audit step warns and cannot fail the job', () => {
    const a = wf.jobs.tests.steps.find((s) => /npm audit/.test(s.run ?? ''));
    expect(a.run).toContain('::warning::');
    expect(a.run).toMatch(/if ! out=/);
    expect(a['continue-on-error']).toBeUndefined();
  });

  it('runs lint and typecheck as own steps before Vitest', () => {
    const t = wf.jobs.tests.steps.map((s) => s.run);
    const [l, c, v] = ['npm run lint', 'npm run typecheck', 'npm test'].map((r) => t.indexOf(r));
    expect(l).toBeGreaterThan(-1);
    expect(c).toBeGreaterThan(l);
    expect(v).toBeGreaterThan(c);
    expect(steps(wf.jobs.tests)).toContain('Audit (warning only)');
  });

  it('build job runs the generator', () => {
    expect(wf.jobs.build.steps.some((s) => s.run === 'node site/scripts/generate.mjs --out site/src/generated/catalog.json')).toBe(true);
  });
});
