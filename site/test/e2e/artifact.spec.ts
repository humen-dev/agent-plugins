import { expect, test } from '@playwright/test';
import { en } from '../../src/i18n/en.ts';
import { artifactHash, pluginHash } from '../../src/links/hash.ts';
import { blobUrl } from '../../src/links/source-url.ts';
import { catalog, rowsOf } from './helpers.ts';

const kinds = [...new Set(catalog.artifacts.map((a) => a.kind))];

for (const kind of kinds) {
  const a = catalog.artifacts.find((x) => x.kind === kind)!;
  test(`artifact ${kind} ${a.id}: breadcrumb, facts, frontmatter, source links`, async ({ page }) => {
    await page.goto(artifactHash(a));
    await expect(page.getByRole('heading', { level: 1, name: a.name, exact: true })).toBeVisible();

    const crumbs = page.getByRole('navigation', { name: en.artifact.breadcrumb });
    await expect(crumbs.locator(`a[href="${pluginHash(a.plugin)}"]`)).toHaveText(a.plugin);
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(a.name);

    const facts = page.locator('dl.facts');
    await expect(facts.locator('dt').first()).toHaveText(en.artifact.plugin);
    await expect(facts.locator('dt').nth(1)).toHaveText(en.artifact.kind);

    const fmKeys = Object.keys(a.frontmatter).length;
    if (fmKeys === 0) await expect(page.locator('.t-fm')).toHaveCount(0);
    else await expect(rowsOf(page, '.t-fm')).toHaveCount(fmKeys);

    // every source link in facts and sidebar points at <repoUrl>/blob/<commit>/<path shown in the link>
    const links = await page.locator('dl.facts a[target="_blank"], aside a[target="_blank"]').evaluateAll((els) =>
      els.map((e) => ({ href: (e as HTMLAnchorElement).href, path: e.querySelector('code')?.textContent ?? '' })));
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.href).toBe(blobUrl(catalog, l.path));
    expect(links.some((l) => l.href === a.sourceUrl)).toBe(true);
  });
}
