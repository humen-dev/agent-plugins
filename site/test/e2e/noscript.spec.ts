import { expect, test } from '@playwright/test';
import { catalog } from './helpers.ts';

test('JS off: noscript message, repository and README links', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('');
  await expect(page.locator('noscript p', { hasText: 'This catalog needs JavaScript to search and show plugins.' })).toBeVisible();
  const repo = catalog.marketplace.repoUrl;
  await expect(page.locator(`a[href="${repo}"]`)).toBeVisible();
  await expect(page.locator(`a[href="${repo}#readme"]`)).toBeVisible();
  await ctx.close();
});
