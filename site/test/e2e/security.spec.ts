import { expect, test } from '@playwright/test';
import { ROUTES } from './helpers.ts';

// SPEC-01 §3.2
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

for (const r of ROUTES) {
  test(`${r.name}: no CSP violations, same-origin requests only, served CSP matches`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const consoleErrors: string[] = [];
    const foreign: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && /content security policy|refused to/i.test(m.text())) consoleErrors.push(m.text()); });
    page.on('request', (req) => { if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== origin) foreign.push(req.url()); });
    await page.addInitScript(() => {
      const w = window as unknown as { csp: string[] };
      w.csp = [];
      document.addEventListener('securitypolicyviolation', (e) => w.csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });

    await page.goto(r.hash);
    await expect(page.getByRole('heading', { level: 1, name: r.h1, exact: true })).toBeVisible();
    if (r.name === 'home') await page.getByRole('searchbox').fill('migrations'); // exercise the search path too

    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toBe(CSP);
    expect(await page.evaluate(() => (window as unknown as { csp: string[] }).csp)).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(foreign).toEqual([]);
  });
}
