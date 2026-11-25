import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { contrast } from '../helpers/contrast.ts';
import { ROUTES, setTheme, THEMES } from './helpers.ts';

const PAGES = ROUTES.filter((r) => r.name !== 'unknown');
const waitH1 = (page: Page, name: string) => expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();

test.describe('axe matrix', () => {
  for (const r of PAGES) {
    for (const theme of THEMES) {
      for (const width of [375, 1280]) {
        test(`${r.name} ${theme} ${width}px: no serious or critical violations`, async ({ page }) => {
          await setTheme(page, theme);
          await page.setViewportSize({ width, height: 900 });
          await page.goto(r.hash);
          await waitH1(page, r.h1);
          const { violations } = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          const bad = violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
          expect(bad).toEqual([]);
        });
      }
    }
  }
});

/** Describes the focused element in the page; null when it is body or was already seen. */
const probeFocus = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __seen?: WeakSet<Element> };
    const seen = (w.__seen ??= new WeakSet());
    const el = document.activeElement;
    if (!el || el === document.body || seen.has(el)) return null;
    seen.add(el);
    // The search input hides its own outline; the .search wrapper draws the ring (design, catalog.css:121).
    const wrapper = el.matches('.search input') ? el.closest('.search') : null;
    const cs = getComputedStyle(el);
    const ring = wrapper
      ? { style: 'solid', width: 1, color: getComputedStyle(wrapper).borderTopColor }
      : { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor };
    let bg = 'rgb(255, 255, 255)';
    for (let p = (wrapper ?? el).parentElement; p; p = p.parentElement) {
      const c = getComputedStyle(p).backgroundColor;
      if (!/^(transparent|rgba\(0, 0, 0, 0\))$/.test(c)) { bg = c; break; }
    }
    const label = `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(/\s+/).join('.') : ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
    return { label, ring, bg };
  });

test.describe('focus walk', () => {
  for (const r of PAGES) {
    for (const theme of THEMES) {
      test(`${r.name} ${theme}: every Tab stop has a visible indicator >= 3:1`, async ({ page }) => {
        await setTheme(page, theme);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(r.hash);
        await waitH1(page, r.h1);
        const cap = (await page.locator('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])').count()) + 5;
        const failures: string[] = [];
        let stops = 0;
        for (let i = 0; i < cap; i++) {
          await page.keyboard.press('Tab');
          const f = await probeFocus(page);
          if (!f) break;
          stops++;
          if (f.ring.style === 'none' || !(f.ring.width >= 1)) failures.push(`${f.label}: no outline`);
          else {
            const ratio = contrast(f.ring.color, f.bg);
            if (ratio < 3) failures.push(`${f.label}: ${ratio.toFixed(2)}:1 (${f.ring.color} on ${f.bg})`);
          }
        }
        expect(stops).toBeGreaterThan(0);
        expect(failures).toEqual([]);
      });
    }
  }
});

test.describe('reduced motion', () => {
  const offending = (page: Page) =>
    page.evaluate(() => {
      const bad: string[] = [];
      const zero = (v: string) => v.split(',').every((d) => parseFloat(d) === 0);
      for (const el of document.querySelectorAll('.app, .app *')) {
        for (const pseudo of [null, '::before', '::after']) {
          const cs = getComputedStyle(el, pseudo);
          if (!zero(cs.transitionDuration) || !zero(cs.animationDuration)) {
            bad.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ''}`);
          }
        }
      }
      return bad;
    });

  test.describe('reduce', () => {
    test.use({ reducedMotion: 'reduce' });
    for (const r of PAGES) {
      test(`${r.name}: all durations are 0s`, async ({ page }) => {
        await page.goto(r.hash);
        await waitH1(page, r.h1);
        expect(await offending(page)).toEqual([]);
      });
    }
  });

  test.describe('no-preference', () => {
    test.use({ reducedMotion: 'no-preference' });
    test('a .btn keeps a non-zero transition', async ({ page }) => {
      await page.goto('#/install');
      await waitH1(page, ROUTES.find((x) => x.name === 'install')!.h1);
      const durations = await page.locator('.btn').evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration));
      expect(durations.some((d) => d.split(',').some((x) => parseFloat(x) > 0))).toBe(true);
    });
  });
});
