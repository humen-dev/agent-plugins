import { expect, test, type Page } from '@playwright/test';
import { en, t } from '../../src/i18n/en.ts';
import { cliText } from '../../src/install/resolve.ts';
import { cardKeys, catalog, closureOf, expected, plugin0, tabTo, textOf } from './helpers.ts';

const box = (page: Page) => page.getByRole('searchbox', { name: en.search.label });
// OS clipboards may hand back CRLF; the app writes LF.
const clipboard = async (page: Page) => (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
const first = (q: string) => expected({ q }).cards[0];
const countText = (q: string) => {
  const out = expected({ q });
  return t('search.count', { n: out.cards.length }) + (out.hasTerms ? t('search.bestFirst') : t('search.sortedByName'));
};
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });
const installBox = (page: Page) =>
  page.getByLabel(en.plugin.installBoxLabel, { exact: true }).locator('xpath=ancestor::div[contains(@class,"cmd")]');

const Q = plugin0.name;

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('keyboard only: search, open, copy', async ({ page }) => {
  await page.goto('#/');
  await expect(box(page)).toBeVisible();
  await tabTo(page, box(page), 15);
  await page.keyboard.type(Q);
  const want = first(Q);
  await expect.poll(async () => (await cardKeys(page))[0]).toBe(want.key);

  const link = page.getByRole('article').first().getByRole('heading', { level: 3 }).getByRole('link');
  await tabTo(page, link, 30);
  await page.keyboard.press('Enter');
  await expect(heading(page, want.artifact?.name ?? want.plugin.name)).toBeVisible();

  const copy = installBox(page).getByRole('button', { name: en.card.copy });
  await tabTo(page, copy, 60);
  await page.keyboard.press('Enter');
  await expect(installBox(page).getByRole('button', { name: en.card.copied })).toBeVisible();
  expect(await clipboard(page)).toBe(want.plugin.installCommand);
});

test('keyboard only: Space on #/install adds the plugin and its CLI line', async ({ page }) => {
  await page.goto('#/install');
  await expect(heading(page, en.pages.installTitle)).toBeVisible();
  const row = page.locator('.cb-row').filter({ has: page.getByText(plugin0.name, { exact: true }) });
  const cb = row.getByRole('checkbox');
  await tabTo(page, cb, 80);
  await page.keyboard.press('Space');
  await expect(cb).toBeChecked();
  const want = cliText(catalog, closureOf([plugin0.name]).final, 'user');
  await expect.poll(() => textOf(page.locator('.out-cmd .cmd-text').first())).toBe(want);
  expect(want).toContain(plugin0.installCommand);
});

test('the polite live region follows the result count', async ({ page }) => {
  await page.goto('#/');
  const live = page.locator('.count-line[role="status"]');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await expect(live).toHaveText(countText(''));
  expect(expected({ q: Q }).cards.length).not.toBe(expected({ q: '' }).cards.length);
  await box(page).fill(Q);
  await expect(live).toHaveText(countText(Q));
});

test('smoke', async ({ page }) => {
  await page.goto('#/');
  await box(page).fill(Q);
  const want = first(Q);
  await expect.poll(async () => (await cardKeys(page))[0]).toBe(want.key);
  await page.getByRole('article').first().getByRole('heading', { level: 3 }).getByRole('link').click();
  await expect(heading(page, want.artifact?.name ?? want.plugin.name)).toBeVisible();

  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.getByRole('button', { name: en.theme.light }).first().click();
  await expect.poll(() => html.getAttribute('data-theme')).not.toBe(before);

  await installBox(page).getByRole('button', { name: en.card.copy }).click();
  await expect(installBox(page).getByRole('button', { name: en.card.copied })).toBeVisible();
  expect(await clipboard(page)).toBe(want.plugin.installCommand);
});
