import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const wf = parse(readFileSync(new URL('../../.github/workflows/site.yml', import.meta.url), 'utf8'));
const PATHS = ['plugins/**', '.claude-plugin/**', 'site/**', 'scripts/validate-marketplace.mjs', '.github/workflows/site.yml'];
const jobs = Object.values(wf.jobs);
const steps = (j) => j.steps.map((s) => s.name ?? s.uses);

describe('site.yml', () => {
  it('is named Site with exactly the three jobs', () => {
    expect(wf.name).toBe('Site');
    expect(jobs.map((j) => j.name).sort()).toEqual(['Site: build', 'Site: deploy', 'Site: tests']);
  });

  it('filters pull_request and push(main) by the spec paths, and allows dispatch', () => {
    expect(wf.on.pull_request.paths).toEqual(PATHS);
    expect(wf.on.push.paths).toEqual(PATHS);
    expect(wf.on.push.branches).toEqual(['main']);
    expect('workflow_dispatch' in wf.on).toBe(true);
  });

  it('grants pages/id-token only to deploy; everything else contents: read', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
    expect(wf.jobs.tests.permissions).toEqual({ contents: 'read' });
    expect(wf.jobs.build.permissions).toEqual({ contents: 'read' });
    expect(wf.jobs.deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
  });

  it('installs with npm ci in site/ and checks out full history', () => {
    for (const j of [wf.jobs.tests, wf.jobs.build]) {
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

  const PUSH_MAIN = "github.event_name == 'push' && github.ref == 'refs/heads/main'";

  it('deploy runs only on push to main, after tests and build, with a status-free if', () => {
    const d = wf.jobs.deploy;
    expect(d.needs).toEqual(['tests', 'build']);
    expect(d.if).toBe(PUSH_MAIN);
    expect(d.environment.name).toBe('github-pages');
    expect(d.steps).toHaveLength(1);
    expect(d.steps[0].uses).toMatch(/^actions\/deploy-pages@v\d+$/);
  });

  it('serializes main deploys and isolates other runs', () => {
    expect(wf.concurrency).toEqual({
      group: "${{ github.event_name == 'push' && github.ref == 'refs/heads/main' && 'pages' || format('site-{0}', github.run_id) }}",
      'cancel-in-progress': false,
    });
  });

  it('build steps run Generate < Build < Fixture < Size < Lighthouse < Upload report < Pages upload (last)', () => {
    const n = steps(wf.jobs.build);
    const order = ['Generate catalog', 'Build site', 'Fixture check', 'Size budgets', 'Lighthouse (report only)', 'Upload Lighthouse report'].map((s) => n.indexOf(s));
    expect(order).not.toContain(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const last = wf.jobs.build.steps.at(-1);
    expect(last.name).toBe('Upload Pages artifact');
    expect(n.indexOf('Upload Pages artifact')).toBeGreaterThan(order.at(-1));
    expect(last.if).toBe(PUSH_MAIN);
    expect(last.with.path).toBe('site/dist');
    expect(last.uses).toMatch(/^actions\/upload-pages-artifact@v\d+$/);
    const uploads = jobs.flatMap((j) => j.steps).filter((s) => /upload-pages-artifact/.test(s.uses ?? ''));
    expect(uploads).toHaveLength(1);
  });

  it('Lighthouse is report-only with a summary; Size budgets can fail the job', () => {
    const by = (name) => wf.jobs.build.steps.find((s) => s.name === name);
    expect(by('Lighthouse (report only)')['continue-on-error']).toBe(true);
    expect(by('Lighthouse (report only)').run).toContain('GITHUB_STEP_SUMMARY');
    expect(by('Upload Lighthouse report').with.name).toBe('lighthouse-report');
    expect(by('Size budgets')['continue-on-error']).toBeUndefined();
  });
});
