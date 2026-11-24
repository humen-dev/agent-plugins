import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { en } from '../../src/i18n/en.ts';
import { ROUTES, VIEWPORTS } from './helpers.ts';

const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });
const toggle = (page: Page, pressed?: boolean) => page.getByRole('button', { name: en.theme.light, pressed });
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const appBg = (page: Page) => page.evaluate(() => getComputedStyle(document.querySelector('.app')!).backgroundColor);

test.describe('routes', () => {
  for (const r of ROUTES) {
    test(`${r.name}: direct load, reload`, async ({ page }) => {
      await page.goto(r.hash);
      await expect(h1(page, r.h1)).toBeVisible();
      await page.reload();
      await expect(h1(page, r.h1)).toBeVisible();
    });

    test(`${r.name}: back and forward`, async ({ page }) => {
      const other = ROUTES.find((x) => x.name === (r.name === 'install' ? 'new' : 'install'))!;
      await page.goto(other.hash);
      await expect(h1(page, other.h1)).toBeVisible();
      await page.goto(r.hash);
      await expect(h1(page, r.h1)).toBeVisible();
      await page.goBack();
      await expect(h1(page, other.h1)).toBeVisible();
      await page.goForward();
      await expect(h1(page, r.h1)).toBeVisible();
    });
  }

  for (const hash of ['#/plugins/no-such-plugin', '#/plugins/django-reviewer/agent/no-such-artifact']) {
    test(`${hash} shows not-found with a search link`, async ({ page }) => {
      await page.goto(hash);
      await expect(h1(page, en.states.notFoundTitle)).toBeVisible();
      await expect(page.getByRole('link', { name: en.states.backToSearch })).toHaveAttribute('href', '#/');
    });
  }
});

test.describe('catalog loading', () => {
  test('shows skeletons while the catalog chunk is delayed', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route('**/assets/catalog-*.js', async (route) => { await gate; await route.continue(); });
    await page.goto('#/');
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    release();
    await expect(h1(page, en.search.heading)).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test('a failed chunk shows the error and Retry navigates again', async ({ page }) => {
    await page.route('**/assets/catalog-*.js', (route) => route.fulfill({ status: 500, body: 'boom' }));
    await page.goto('#/');
    await expect(h1(page, en.states.errorTitle)).toBeVisible();
    await page.evaluate(() => { (window as unknown as { marker: number }).marker = 1; });
    await page.getByRole('button', { name: en.states.retry }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBeUndefined();
    await expect(h1(page, en.states.errorTitle)).toBeVisible();
  });
});

test('footer date does not depend on the time zone', async ({ browser }) => {
  const texts: string[] = [];
  for (const timezoneId of ['Asia/Tokyo', 'UTC']) {
    const ctx = await browser.newContext({ timezoneId });
    const page = await ctx.newPage();
    await page.goto('#/');
    await expect(page.getByRole('contentinfo')).toBeVisible();
    texts.push(await page.getByRole('contentinfo').innerText());
    await ctx.close();
  }
  expect(texts[0]).toBe(texts[1]);
});

test.describe('theme', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`fresh context with OS ${colorScheme} gives dark`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme });
      const page = await ctx.newPage();
      await page.goto('#/');
      expect(await theme(page)).toBe('dark');
      await ctx.close();
    });
  }

  test('toggle changes data-theme, background and storage', async ({ page }) => {
    await page.goto('#/');
    await expect(toggle(page, false)).toBeVisible();
    const before = await appBg(page);
    await toggle(page).click();
    await expect(toggle(page, true)).toBeVisible();
    expect(await theme(page)).toBe('light');
    expect(await appBg(page)).not.toBe(before);
    expect(await page.evaluate(() => localStorage.getItem('catalog.theme'))).toBe('light');
  });

  test('stored light applies before DOMContentLoaded handlers run', async ({ browser }, testInfo) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      localStorage.setItem('catalog.theme', 'light');
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { atDcl: string | undefined }).atDcl = document.documentElement.dataset.theme;
      });
    });
    const page = await ctx.newPage();
    await page.goto('#/');
    await expect(h1(page, en.search.heading)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { atDcl: string }).atDcl)).toBe('light');
    await testInfo.attach('light-theme', { body: await page.screenshot(), contentType: 'image/png' });
    await ctx.close();
  });

  test('axe finds no violations on the theme toggle in both themes', async ({ page }) => {
    await page.goto('#/');
    await expect(toggle(page)).toBeVisible();
    for (const want of ['dark', 'light']) {
      if ((await theme(page)) !== want) await toggle(page).click();
      expect(await theme(page)).toBe(want);
      const { violations } = await new AxeBuilder({ page }).include('.theme-toggle.desk').analyze();
      expect(violations, `${want} theme`).toEqual([]);
    }
  });
});

test.describe('layout', () => {
  for (const width of VIEWPORTS) {
    test(`no horizontal scroll at ${width}px on every route`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const r of ROUTES) {
        await page.goto(r.hash);
        await expect(h1(page, r.h1)).toBeVisible();
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, r.name).toBeLessThanOrEqual(0);
      }
    });
  }

  // Font-independent reflow: CI fonts differ from local ones, so force a wide font.
  // Own context with bypassCSP only for the injected style; every other test keeps the CSP.
  test('no horizontal scroll at 320px on every route with a wide font', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, bypassCSP: true, viewport: { width: 320, height: 800 } });
    const page = await context.newPage();
    try {
      for (const r of ROUTES) {
        await page.goto(r.hash);
        await expect(h1(page, r.h1)).toBeVisible();
        await page.addStyleTag({ content: '* { font-family: Verdana, sans-serif !important; }' });
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, r.name).toBeLessThanOrEqual(0);
      }
    } finally {
      await context.close();
    }
  });
});
