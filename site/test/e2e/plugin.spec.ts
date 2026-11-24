import { expect, test } from '@playwright/test';
import { runsLabels } from '../../src/catalog/runs.ts';
import type { Hook } from '../../src/catalog/types.ts';
import { en } from '../../src/i18n/en.ts';
import { pluginHash } from '../../src/links/hash.ts';
import { catalog, pluginByName, rowsOf, trackForeign } from './helpers.ts';

const byId = new Map(catalog.artifacts.map((a) => [a.id, a] as const));
const runs = '#what-it-runs';

for (const p of catalog.plugins) {
  test(`plugin ${p.name}: artifacts, runs tables, badge, AC-30`, async ({ page }) => {
    await page.goto(pluginHash(p.name));
    await expect(page.getByRole('heading', { level: 1, name: p.name, exact: true })).toBeVisible();

    await expect(rowsOf(page, '.t-arts')).toHaveCount(p.artifactIds.length);

    const hooks = p.runs.hooks.map((id) => byId.get(id) as Hook);
    await expect(rowsOf(page, `${runs} .t-hooks`)).toHaveCount(hooks.length);
    const cmds = await page.locator(`${runs} .t-hooks .cmd-block`).allTextContents();
    expect(cmds).toEqual(hooks.map((h) => h.command).filter((c) => c !== null));

    await expect(rowsOf(page, `${runs} .t-scripts`)).toHaveCount(p.runs.scripts.length);
    for (const [i, s] of p.runs.scripts.entries()) {
      const row = rowsOf(page, `${runs} .t-scripts`).nth(i);
      await expect(row).toContainText(s.path);
      if (s.referencedBy.length === 0) await expect(row).toContainText(en.runs.notNamed);
      else await expect(row.locator('a[href^="#/plugins/"]')).toHaveCount(s.referencedBy.length);
    }

    await expect(rowsOf(page, `${runs} .t-agents`)).toHaveCount(p.runs.agentTools.length);

    const labels = p.runs.runsCode ? runsLabels(p, 'runs') : [];
    const badge = page.locator('.ph .runs');
    if (labels.length === 0) await expect(badge).toHaveCount(0);
    else {
      await expect(badge).toContainText(en.runs.badge);
      await expect(badge.locator('.reasons')).toHaveText(`· ${labels.join(', ')}`);
    }

    const none = p.runs.hooks.length === 0 && p.runs.mcpServers.length === 0 && p.runs.scripts.length === 0;
    await expect(page.getByText(en.runs.nothing, { exact: true })).toHaveCount(none ? 1 : 0);
  });
}

test('django-reviewer: notices, homepage, dependencies, shell access, AC-30', async ({ page }) => {
  await page.goto(pluginHash(pluginByName('django-reviewer').name));
  await expect(page.getByRole('heading', { level: 2, name: en.plugin.notices })).toBeVisible();
  await expect(page.getByRole('link', { name: en.plugin.homepage })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: en.plugin.dependencies })).toBeVisible();
  await expect(page.locator('.ph .runs')).toContainText('agent with shell access');
  await expect(page.getByText(en.runs.nothing, { exact: true })).toBeVisible();
});

test('spec-driven: what it runs, hooks, unreferenced lib scripts', async ({ page }) => {
  const p = pluginByName('spec-driven');
  await page.goto(pluginHash(p.name));
  await expect(page.getByRole('heading', { level: 2, name: en.runs.heading })).toBeVisible();
  expect(p.runs.hooks.length).toBeGreaterThan(0);
  const lib = p.runs.scripts.filter((s) => s.path.includes('scripts/lib/') && s.referencedBy.length === 0);
  expect(lib.length).toBeGreaterThan(0);
  for (const s of lib) {
    await expect(page.locator(`${runs} .t-scripts .tr`).filter({ hasText: s.path })).toContainText(en.runs.notNamed);
  }
});

test('codebase-onboarding: no notices section', async ({ page }) => {
  await page.goto(pluginHash(pluginByName('codebase-onboarding').name));
  await expect(page.getByRole('heading', { level: 1, name: 'codebase-onboarding' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: en.plugin.notices })).toHaveCount(0);
});

test('320 px: long hook command scrolls inside its box, page does not overflow, no foreign requests', async ({ page, baseURL }) => {
  const p = catalog.plugins.find((x) => x.runs.hooks.length > 0)!;
  const foreign = trackForeign(page, baseURL!);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(pluginHash(p.name));
  await expect(page.locator(`${runs} .cmd-block`).first()).toBeVisible();
  const box = await page.locator(`${runs} .cmd-block`).evaluateAll((els) => {
    const longest = els.reduce((a, b) => ((b.textContent ?? '').length > (a.textContent ?? '').length ? b : a));
    return { sw: longest.scrollWidth, cw: longest.clientWidth };
  });
  expect(box.sw).toBeGreaterThan(box.cw);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});

test('no plugin page fetches a foreign origin (README images stay text)', async ({ page, baseURL }) => {
  const foreign = trackForeign(page, baseURL!);
  for (const p of catalog.plugins) {
    await page.goto(pluginHash(p.name));
    await expect(page.getByRole('heading', { level: 1, name: p.name, exact: true })).toBeVisible();
    await page.waitForLoadState('networkidle');
  }
  expect(foreign).toEqual([]);
  expect(await page.locator('img').count()).toBe(0);
});
