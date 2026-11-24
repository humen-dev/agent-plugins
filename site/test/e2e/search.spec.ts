import { expect, test, type Page } from '@playwright/test';
import { en } from '../../src/i18n/en.ts';
import { requestUrl } from '../../src/links/request-url.ts';
import { cardKeys, cardNames, catalog, expected, keysOf } from './helpers.ts';

const box = (page: Page) => page.getByRole('searchbox', { name: en.search.label });
const type = async (page: Page, q: string) => {
  await box(page).fill(q);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
};
const hash = (page: Page) => page.evaluate(() => location.hash);
const names = (xs: { name: string }[]) => xs.map((x) => x.name).sort();

const SAFE = 'I need a skill for safe migrations';
const safePlugin = catalog.plugins.find((p) => p.name === 'django-safe-migration')!;
const cat = safePlugin.category!;

test.beforeEach(async ({ page }) => {
  await page.goto('#/');
  await expect(box(page)).toBeVisible();
});

test('natural-language query orders cards like the search module', async ({ page }) => {
  await type(page, SAFE);
  const want = keysOf({ q: SAFE });
  await expect.poll(() => cardKeys(page)).toEqual(want);
  expect(want[0]).toContain('django-safe-migration');
});

test('django-safe-migration shows as one merged card', async ({ page }) => {
  await type(page, SAFE);
  await expect(page.getByRole('heading', { level: 3, name: 'django-safe-migration', exact: true })).toHaveCount(1);
});

test('kind=plugin shows plugin cards and no merged card', async ({ page }) => {
  await page.goto('#/?kind=plugin');
  await expect.poll(() => cardKeys(page)).toEqual(keysOf({ kinds: ['plugin'] }));
  expect(await cardKeys(page)).toHaveLength(catalog.plugins.length);
  await expect(page.getByRole('article').getByText(/· plugin$/)).toHaveCount(0);
});

test('kind=skill + category filter, chip counts and hash', async ({ page }) => {
  const s = { kinds: ['skill' as const], cats: [cat] };
  await page.goto(`#/?kind=skill&cat=${encodeURIComponent(cat)}`);
  await expect.poll(() => cardKeys(page)).toEqual(keysOf(s));
  const out = expected(s);
  await expect(page.getByRole('button', { name: new RegExp(`^${en.card.kind.skill}\\s*${out.kindCounts.skill ?? 0}$`), pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${cat}\\s*${out.catCounts[cat]}$`), pressed: true })).toBeVisible();
});

test('typing writes the hash; reload restores query and results', async ({ page }) => {
  await type(page, SAFE);
  expect(decodeURIComponent(await hash(page))).toBe(`#/?q=${SAFE}`);
  const before = await cardKeys(page);
  await page.reload();
  await expect(box(page)).toHaveValue(SAFE);
  await expect.poll(() => cardKeys(page)).toEqual(before);
});

test.describe('no results', () => {
  const nonsense = 'zzqxjvk';

  test('without filters: tags, request link, no clear-filters button', async ({ page }) => {
    await type(page, nonsense);
    await expect(page.getByRole('heading', { level: 2, name: en.empty.titleQuery.replace('{q}', nonsense) })).toBeVisible();
    const tags = page.locator('.state-panel a.tag');
    expect(await tags.count()).toBeGreaterThan(0);
    const request = page.getByRole('link', { name: new RegExp(`^${en.empty.request}`) });
    await expect(request).toHaveAttribute('href', requestUrl(catalog.marketplace.repoUrl, nonsense));
    await expect(page.locator('.empty-actions').getByRole('button', { name: en.filters.clear })).toHaveCount(0);
  });

  test('with filters: clear filters button removes them', async ({ page }) => {
    await page.goto(`#/?q=${nonsense}&kind=skill`);
    const clear = page.locator('.empty-actions').getByRole('button', { name: en.filters.clear });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect.poll(() => hash(page)).not.toContain('kind=');
    await expect(clear).toHaveCount(0);
  });
});

test('"/" focuses the search box and Esc clears it', async ({ page }) => {
  await page.getByRole('heading', { level: 1 }).click();
  await page.keyboard.press('/');
  await expect(box(page)).toBeFocused();
  await type(page, 'celery');
  await page.keyboard.press('Escape');
  await expect(box(page)).toHaveValue('');
  await expect.poll(() => hash(page)).toBe('#/');
});

test('"/" on another route goes to search and focuses the box', async ({ page }) => {
  await page.goto('#/install');
  await expect(page.getByRole('heading', { level: 1, name: en.pages.installTitle })).toBeVisible();
  await page.keyboard.press('/');
  await expect(box(page)).toBeFocused();
});

test('#/ lists every plugin and #/?kind=skill every skill', async ({ page }) => {
  await expect.poll(() => cardNames(page).then((n) => n.sort())).toEqual(names(catalog.plugins));
  await page.goto('#/?kind=skill');
  const skills = catalog.artifacts.filter((a) => a.kind === 'skill');
  await expect.poll(() => cardNames(page).then((n) => n.sort())).toEqual(names(skills));
});

test.describe('EC-1: only stop and kind words', () => {
  test('"I need a" lists like the empty query without error', async ({ page }) => {
    await type(page, 'I need a');
    await expect.poll(() => cardKeys(page)).toEqual(keysOf({ q: 'I need a' }));
  });

  test('"I need a skill" turns the hint into the skill filter', async ({ page }) => {
    await box(page).fill('I need a skill');
    await expect.poll(() => hash(page)).toContain('kind=skill');
    await expect(page.getByRole('button', { name: new RegExp(`^${en.card.kind.skill}`), pressed: true })).toBeVisible();
    await expect.poll(() => cardKeys(page)).toEqual(keysOf({ q: 'I need a skill', kinds: ['skill'] }));
  });
});

test.describe('responsive', () => {
  test('320px: card name and description are clamped and stay inside the card', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('#/');
    const cards = page.getByRole('article');
    await expect(cards.first()).toBeVisible();
    const bad = await cards.evaluateAll((els) =>
      els.flatMap((el) => {
        const name = el.querySelector('.card-name') as HTMLElement;
        const desc = el.querySelector('.desc') as HTMLElement;
        const lc = (e: HTMLElement) => getComputedStyle(e).webkitLineClamp;
        const issues: string[] = [];
        if (lc(name) !== '2' || getComputedStyle(name).overflow !== 'hidden') issues.push('name not clamped');
        if (lc(desc) !== '4' || getComputedStyle(desc).overflow !== 'hidden') issues.push('desc not clamped');
        if (el.scrollWidth > el.clientWidth) issues.push('card overflows');
        return issues;
      }),
    );
    expect(bad).toEqual([]);
  });

  test('375px: filters sit behind the toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('#/');
    const kinds = page.getByRole('group', { name: en.filters.kind });
    await expect(kinds).toHaveCount(0);
    await page.getByRole('button', { name: en.filters.heading, exact: true }).click();
    await expect(kinds).toBeVisible();
  });

  test('768px: filters are visible without the toggle', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 });
    await page.goto('#/');
    await expect(page.getByRole('group', { name: en.filters.kind })).toBeVisible();
    await expect(page.getByRole('button', { name: en.filters.heading, exact: true })).toHaveCount(0);
  });
});
