import { expect, test, type Page } from '@playwright/test';
import { en } from '../../src/i18n/en.ts';
import { installHash } from '../../src/install/link.ts';
import { cliText } from '../../src/install/resolve.ts';
import { STORAGE_KEY } from '../../src/install/types.ts';
import { pluginHash } from '../../src/links/hash.ts';
import { catalog, closureOf, plugin0, pluginByName, textOf } from './helpers.ts';

const row = (page: Page, name: string) => page.locator('.cb-row').filter({ has: page.getByText(name, { exact: true }) });
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
const withDeps = catalog.plugins.filter((p) => p.dependencies.length > 0);
// OS clipboards may hand back CRLF; the app writes LF.
const clipboard = async (page: Page) => (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
const cli = (page: Page) => page.locator('.out-cmd .cmd-text').first();

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('catalog has plugins with dependencies', () => {
  expect(withDeps.length).toBeGreaterThan(0);
});

for (const p of withDeps) {
  test(`install ${p.name}: dependency closure, auto labels, CLI text, hash`, async ({ page }) => {
    const want = closureOf([p.name]);
    await page.goto('#/install');
    await row(page, p.name).getByRole('checkbox').check();
    await expect(page.locator('.cb-row input:checked')).toHaveCount(want.final.length);

    for (const n of want.final) {
      const r = row(page, n);
      await expect(r.getByRole('checkbox')).toBeChecked();
      const added = want.addedFor[n];
      if (added) await expect(r.locator('.auto-label')).toHaveText(en.install.autoLabel.replace('{names}', [...added].sort().join(', ')));
      else await expect(r.locator('.auto-label')).toHaveCount(0);
    }

    await expect.poll(() => textOf(cli(page))).toBe(cliText(catalog, want.final, 'user'));
    await page.getByRole('button', { name: en.install.scopeProject, exact: true }).click();
    await expect.poll(() => textOf(cli(page))).toBe(cliText(catalog, want.final, 'project'));

    await expect.poll(() => page.evaluate(() => location.hash)).toBe(installHash([p.name])); // AC-41b
  });
}

test('the selection survives a reload (AC-41a)', async ({ page }) => {
  await page.goto('#/install');
  await row(page, plugin0.name).getByRole('checkbox').check();
  await expect.poll(() => stored(page)).toBe(JSON.stringify([plugin0.name]));
  await page.goto('about:blank'); // a hash-only goto would not reload
  await page.goto('#/install');
  await expect(row(page, plugin0.name).getByRole('checkbox')).toBeChecked();
  await page.reload();
  await expect(row(page, plugin0.name).getByRole('checkbox')).toBeChecked();
});

test('a ?p= link previews without touching storage until a tick (AC-41a, AC-41c)', async ({ page }) => {
  const b = catalog.plugins[0].name;
  const inB = closureOf([b]).final;
  const a = catalog.plugins.find((x) => !inB.includes(x.name))!.name;
  const c = catalog.plugins.find((x) => !inB.includes(x.name) && x.name !== a)!.name; // not a dependency of b, so its box is enabled
  await page.goto('#/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify([a])]);
  await page.goto('about:blank');
  await page.goto(`#/install?p=${encodeURIComponent(b)}`);

  await expect(row(page, b).getByRole('checkbox')).toBeChecked();
  await expect(row(page, a).getByRole('checkbox')).not.toBeChecked();
  expect(await stored(page)).toBe(JSON.stringify([a]));

  await row(page, c).getByRole('checkbox').check();
  await expect.poll(() => stored(page)).toBe(JSON.stringify([b, c].sort()));
});

test('an unedited ?p= link never writes storage: away and back, reload, then an edit elsewhere (Decision 3, AC-41a)', async ({ page }) => {
  const b = catalog.plugins[0].name;
  const inB = closureOf([b]).final;
  const a = catalog.plugins.find((x) => !inB.includes(x.name))!.name;
  const c = catalog.plugins.find((x) => x.name !== a && !inB.includes(x.name) && !closureOf([a]).final.includes(x.name))!.name;
  const mine = JSON.stringify([a]);
  await page.goto('#/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, mine]);
  await page.goto('about:blank');
  await page.goto(`#/install?p=${encodeURIComponent(b)}`);
  await expect(row(page, b).getByRole('checkbox')).toBeChecked();
  expect(await stored(page)).toBe(mine);

  await page.goto(pluginHash(c)); // away: the header falls back to the stored set
  await expect(page.locator('.nav .count-pill')).toHaveText(String(closureOf([a]).final.length));
  expect(await stored(page)).toBe(mine);
  await page.goBack(); // back to the shared link: previewed again, still not stored
  await expect(row(page, b).getByRole('checkbox')).toBeChecked();
  expect(await stored(page)).toBe(mine);
  await page.reload();
  await expect(row(page, b).getByRole('checkbox')).toBeChecked();
  expect(await stored(page)).toBe(mine);

  await page.goto(pluginHash(c)); // an edit on another page builds on the stored set, not the preview
  await page.getByRole('button', { name: en.plugin.addToSet }).click();
  await expect.poll(() => stored(page)).toBe(JSON.stringify([a, c].sort()));
});

test('unknown names in ?p= give one notice naming them (EC-6)', async ({ page }) => {
  await page.goto(`#/install?p=${encodeURIComponent(plugin0.name)},ghost`);
  await expect(row(page, plugin0.name).getByRole('checkbox')).toBeChecked();
  const notice = page.locator('.notice.info');
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText('ghost');
});

test('CLI and card copy buttons write the shown text (AC-36a)', async ({ page }) => {
  await page.goto('#/install');
  await row(page, plugin0.name).getByRole('checkbox').check();
  const box = page.locator('.out-cmd').first();
  await box.getByRole('button', { name: en.card.copy }).click();
  await expect(box.getByRole('button', { name: en.card.copied })).toBeVisible();
  expect(await clipboard(page)).toBe(await textOf(cli(page)));

  await page.goto('#/');
  const card = page.getByRole('article').first();
  await card.getByRole('button', { name: en.card.copy }).click();
  await expect(card.getByRole('button', { name: en.card.copied })).toBeVisible();
  expect(await clipboard(page)).toBe(await textOf(card.locator('.cmd-text')));
});

test('a rejected clipboard write selects the text and shows the hint (AC-37a, AC-37b)', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => Promise.reject(new Error('denied')) });
  });
  await page.goto(pluginHash(plugin0.name));
  const box = page.getByLabel(en.plugin.installBoxLabel, { exact: true });
  await box.locator('xpath=ancestor::div[contains(@class,"cmd")]').getByRole('button', { name: en.card.copy }).click();
  await expect(page.getByText(en.card.copyFailed)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.getSelection()!.toString())).toBe(pluginByName(plugin0.name).installCommand);
});

test('"Add to install set" on a plugin page raises the header count', async ({ page }) => {
  const want = closureOf([plugin0.name]).final.length;
  await page.goto(pluginHash(plugin0.name));
  await expect(page.locator('.nav .count-pill')).toHaveText('0');
  await page.getByRole('button', { name: en.plugin.addToSet }).click();
  await expect(page.locator('.nav .count-pill')).toHaveText(String(want));
});
