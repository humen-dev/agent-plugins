import { expect, test, type Page } from '@playwright/test';
import { requestUrl } from '../../src/links/request-url.ts';
import { catalog } from './helpers.ts';

const repo = catalog.marketplace.repoUrl;
const NONSENSE = 'zzqxjvw&zzqxk=zzqy#zzqz?zzqw';
const hrefOf = (page: Page, scope: string) => page.locator(`${scope} a[href*="plugin-request.yml"]`);

test('header and footer request links carry the empty query (AC-45)', async ({ page }) => {
  await page.goto('#/');
  await expect(page.locator('.ftr')).toBeVisible();
  for (const scope of ['.hdr', '.ftr']) await expect(hrefOf(page, scope)).toHaveAttribute('href', requestUrl(repo, ''));
});

test('header, footer and empty-state links carry the typed query, specials encoded (AC-45, UT-5)', async ({ page }) => {
  await page.goto('#/');
  await page.getByRole('searchbox').fill(NONSENSE);
  const want = requestUrl(repo, NONSENSE);
  await expect(page.locator('.state-panel')).toBeVisible(); // fails loudly if the query ever matches the catalog
  for (const scope of ['.hdr', '.ftr', '.empty-actions']) await expect(hrefOf(page, scope)).toHaveAttribute('href', want);

  const url = new URL(want);
  expect([...url.searchParams.keys()].sort()).toEqual(['template', 'title', 'what']);
  expect(url.searchParams.get('title')).toBe(NONSENSE);
  expect(url.searchParams.get('what')).toBe(NONSENSE);
});
