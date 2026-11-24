import { expect, test } from '@playwright/test';
import { utcDay } from '../../src/format.ts';
import { en } from '../../src/i18n/en.ts';
import { pluginHash } from '../../src/links/hash.ts';
import { catalog, pluginByName } from './helpers.ts';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('#/new: day headings and row count follow catalog.changes (AC-42)', async ({ page }) => {
  await page.goto('#/new');
  const days = [...new Set(catalog.changes.map((c) => utcDay(c.date)))];
  await expect(page.locator('h2.day-h')).toHaveText(days);
  await expect(page.locator('.chg-list .chg')).toHaveCount(catalog.changes.length);
});

test('a plugin chip filters to that plugin (AC-43)', async ({ page }) => {
  const name = catalog.plugins.map((p) => p.name).find((n) => catalog.changes.some((c) => c.plugin === n))!;
  const mine = catalog.changes.filter((c) => c.plugin === name);
  await page.goto('#/new');
  await page.getByRole('button', { name: new RegExp(`^${esc(name)}\\s*${mine.length}$`) }).click();
  await expect(page.locator('.chg-list .chg')).toHaveCount(mine.length);
  await expect(page.locator('.chg-list .chg .nm')).toHaveText(mine.map(() => name));
  await expect(page.locator('h2.day-h')).toHaveText([...new Set(mine.map((c) => utcDay(c.date)))]);
});

test('spec-creator rows are text, not links (AC-69)', async ({ page }) => {
  const old = catalog.changes.filter((c) => c.plugin === 'spec-creator');
  expect(old.length).toBeGreaterThan(0);
  expect(catalog.plugins.some((p) => p.name === 'spec-creator')).toBe(false);
  await page.goto('#/new');
  await expect(page.locator('.chg .old').filter({ hasText: 'spec-creator' })).toHaveCount(old.length);
  await expect(page.locator('.chg a[href*="spec-creator"]')).toHaveCount(0);
});

test('spec-driven page lists its recent changes, versions as from → to (AC-44)', async ({ page }) => {
  const p = pluginByName('spec-driven');
  await page.goto(pluginHash(p.name));
  const rows = page.locator('#plugin-changes ~ .chg-list .chg');
  await expect(rows).toHaveCount(p.recentChanges.length);
  await expect(rows.locator('.subj')).toHaveText(p.recentChanges.map((c) => c.subject));
  const versions = p.recentChanges.filter((c) => c.type === 'version' && c.version);
  expect(versions.length).toBeGreaterThan(0);
  await expect(page.locator('#plugin-changes ~ .chg-list .ctype[data-type="version"] .v')).toHaveText(
    versions.map((c) => `${c.version!.from ?? ''} → ${c.version!.to}`),
  );
  await expect(page.getByRole('link', { name: en.plugin.allChanges.replace('{name}', p.name) })).toBeVisible();
});
