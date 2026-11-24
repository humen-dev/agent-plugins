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

  it('tests job runs Vitest < Generate < Build < Install Chromium < E2E < Audit', () => {
    const n = steps(wf.jobs.tests);
    const order = ['Vitest', 'Generate catalog', 'Build site', 'Install Chromium', 'E2E', 'Audit (warning only)'].map((s) => n.indexOf(s));
    expect(order).not.toContain(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const by = (name) => wf.jobs.tests.steps.find((s) => s.name === name);
    expect(by('Build site')).toMatchObject({ run: 'npm run build', 'working-directory': 'site' });
    expect(by('Install Chromium')).toMatchObject({ run: 'npx playwright install --with-deps chromium', 'working-directory': 'site' });
    expect(by('E2E')).toMatchObject({ run: 'npm run e2e', 'working-directory': 'site' });
  });

  it('uploads the Playwright report right after E2E, only on failure', () => {
    const n = steps(wf.jobs.tests);
    const up = wf.jobs.tests.steps.find((s) => s.name === 'Upload Playwright report');
    expect(n.indexOf('Upload Playwright report')).toBe(n.indexOf('E2E') + 1);
    expect(up.if).toBe('failure()');
    // Pinned the same way as checkout and setup-node (major tag).
    expect(up.uses).toMatch(/^actions\/upload-artifact@v\d+$/);
    expect(up.with).toEqual({ name: 'playwright-report', path: 'site/playwright-report/', 'retention-days': 7 });
  });

  it('build job builds the site then runs the fixture check after Generate', () => {
    const n = steps(wf.jobs.build);
    const [g, b, f] = ['Generate catalog', 'Build site', 'Fixture check'].map((s) => n.indexOf(s));
    expect(g).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(g);
    expect(f).toBeGreaterThan(b);
    expect(wf.jobs.build.steps[f].run).toBe('node site/scripts/check-fixtures.mjs site/src/generated/catalog.json');
  });
});
