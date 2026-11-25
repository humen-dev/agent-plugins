# Catalog site M5 (deploy, concurrency, size budgets, a11y matrix, Lighthouse, docs) — development plan

| Field | Value |
|---|---|
| Status | draft |
| Goal | Every push to `main` that touches the site paths, with "Site: tests" and "Site: build" passing, deploys the site built in that run to GitHub Pages at `https://humen-dev.github.io/agent-plugins/`. The build fails on the size budgets and reports Lighthouse. The site passes the axe matrix, focus, keyboard, reduced-motion and smoke checks. The docs describe a public marketplace with a live catalog. |
| Requirements source | `docs/specs/catalog-site.md` (SPEC-01, Status: approved `:4`), milestone M5 only (`:923`); design `site/prototype/` (token contrast table `Foundations.dc.html:111-151`); merged M1–M4 plans `docs/plans/catalog-site-m1.md` … `m4.md` and SF-1..SF-18; the owner's M5 brief; the planner's Requirements review (findings 1–12) with the owner's answers Q1 a, Q2 a, Q3 a, Q4 b. Input only: this plan never edits them. |
| Execution mode | single-agent (sequential pass), chosen by the owner (Q4 b) |
| Modules touched | root |

## 1. Context
M1–M4 and the plugin-README prerequisite PR are merged (spec `:802-805`).
- `.github/workflows/site.yml:24-116` has only "Site: tests" and "Site: build", no `concurrency`, no Pages upload, no deploy. Workflow and jobs grant `contents: read` (`:21-22`, `:28-29`, `:91-92`). Actions are pinned by major tag (`:31`, `:35`, `:74`).
- The build job ends with the fixture check (`site.yml:115-116`, script `site/scripts/check-fixtures.mjs:1-18`). No size check and no Lighthouse step exist. `lighthouse` is not a dependency (`site/package.json:25-43`).
- `site/test/workflow.test.mjs:13` requires exactly two jobs, `:25` requires `contents: read` on every job, `:29-33` requires `npm ci` in every job.
- Build output: `vite.config.ts:5` base `/agent-plugins/`; `theme-init.js` is a classic script in `index.html` (`vite.config.ts:12`); chunks are `assets/[name]-[hash].js` (`:43`), so the catalog chunk is `assets/catalog-<hash>.js` (as `shell.spec.ts:46` routes it).
- A11y today: `@axe-core/playwright` is installed (`package.json:26`) and used only on the theme toggle (`site/test/e2e/shell.spec.ts:116-125`). Focus ring `.app :focus-visible` (`site/src/styles/app.css:10`); the search input's indicator is `.search:focus-within` (`site/src/styles/search.css:14`). Reduced motion: `app.css:93-95`. Live regions: `SearchPage.tsx:124`, `NewPage.tsx:60`. Copy: `site/src/ui/CommandBox.tsx:25-26`. Clipboard e2e pattern: `site/test/e2e/install.spec.ts:17`.
- Docs: `README.md:3`, `:10` say "private"; `:13-16` has `gh auth setup-git`; `:5-6` says only Django ships, while `.claude-plugin/marketplace.json:84-123` also ships `codebase-onboarding`, `spec-driven`, `research-tools`; the layout block `:67-78` has no `site/`. `docs/SECURITY.md:69` says "(private)". `CONTRIBUTING.md` has no site section. Local commands exist: `site/package.json:10-17` (`preview` on 4173, `generate` with `--repo humen-dev/agent-plugins`).

Requirements: SPEC-01 M5 row (`:923`): AC-7a (`:487`), AC-52..AC-58b, AC-67b (`:600-613`), NFR-1a..NFR-9, NFR-15b, NFR-15c, NFR-17 (`:719-744`), CI/CD (`:854-911`), manual M-1..M-4 (`:845-852`).

Binding sources:
- No `AGENTS.md`/`CLAUDE.md` at the root or in `site/`; no project skills (as M4 `§1`).
- `INSIGHTS.md:8` (`t()` takes plain literals only) applies to any `.tsx` fix in U2 and U3.
- Layout follows M1–M4: scripts in `site/scripts/`, Node script tests in `site/test/*.test.mjs` (`check-fixtures.test.mjs:1-16`), Vitest unit tests in `site/test/`, shared test helpers in `site/test/helpers/` (`fixture-repo.mjs`), e2e in `site/test/e2e/` with `helpers.ts`.

### Requirements review
- Finding 1 (deploy trigger): **Q1 a** — push to `main` only, on both the upload step and the deploy job (Decision 1). SF-20.
- Finding 2 (Lighthouse tool): **Q2 a** — `lighthouse` exact-pinned devDependency, Wave 0 (Decision 4).
- Finding 3 (budget units): decided as proposed (Decision 3). SF-22.
- Finding 4 (CI-only rows): inspection halves in `workflow.test.mjs`; CI halves in the PR checklist (§7, Recommendation 1).
- Finding 5: `workflow.test.mjs` assertions change (U1); no M1 contract changes.
- Findings 6, 7: Decisions 6 and 7. Finding 8: risk §8. Findings 9–11: U2, U4, U1. Finding 12: SF-19.
- **Recommendation 1: accepted** — post-merge CI checks in the PR body next to M-1..M-4, all unchecked (§7).
- **Recommendation 2: accepted** — `docs/SECURITY.md` reporting section reworded (U4).
- **Recommendation 3: accepted** — `site/` line in the README layout block (U4).

### Decisions
1. **Deploy and upload only on `push` to `refs/heads/main`** (Q1 a): both use `github.event_name == 'push' && github.ref == 'refs/heads/main'`. A dispatch on `main` runs tests and build only. Rejected: push or dispatch (spec `:905`) — the owner's brief.
2. **Concurrency group `pages` only for push runs to `main`**, every other run in `site-<run_id>`, `cancel-in-progress: false` (§3.1). Reason: under Decision 1 a dispatch on `main` does not deploy. In the `pages` group it could cancel a pending push run, and the newest push would never deploy (AC-52). Rejected: keying on `github.ref` alone (spec `:865`). This is part of SF-20.
3. **Budgets** (finding 3): 1 KB = 1000 bytes; gzip = `zlib.gzipSync` at the default level. Initial JS = every `<script src>` and `<link rel="modulepreload" href>` in `dist/index.html`, `theme-init.js` included, minus the catalog chunk. Catalog chunk = the single `dist/assets/catalog-*.js`; any other count fails (§3.2). Rejected: Vite's own size report (no gate, no stable output).
4. **Lighthouse** (Q2 a): `npx --no-install lighthouse` against `npm run preview` in "Site: build", mobile defaults, Chrome from the runner image. JSON and HTML go to artifact `lighthouse-report`; Performance and LCP go to the job summary. The step has `continue-on-error: true`; the report is written under `runner.temp`, never into `site/dist` (§3.1). Rejected: `@lhci/cli`, third-party action (Q2).
5. **Pins**: `actions/upload-pages-artifact` and `actions/deploy-pages` by major tag, like `site.yml:31`. The current majors at review time were `@v5`; U1 confirms the latest major on each releases page.
6. **Focus check (NFR-6b)**: every element reached by Tab must have a computed outline (`outline-style` not `none`, width ≥ 1px) whose colour has ≥ 3:1 contrast against the effective background behind the ring (nearest ancestor with a non-transparent background, starting at the parent). The search input is the one exception: the check is the `.search` wrapper's border colour, as in the design (`site/prototype/catalog.css:121`). `.main` (`app.css:24`) is a programmatic focus target, not reached by Tab, so it is not in the walk.
7. **Reduced motion (NFR-8)**: the test asserts computed `transition-duration` and `animation-duration` of `0s` on every element under `.app` and their `::before`/`::after`. If any is not `0s`, U2 sets the durations explicitly in `app.css:93-95`.
8. **Axe fixes stay in the app**: no rule is disabled, no element excluded, no impact filter beyond "serious, critical". Token values are not changed by this plan; a failing token pair stops the work (`BLOCKED:`) for an owner decision.
9. **Skills**: `none` for every unit. No available skill covers CI YAML, Playwright or docs (owner rule, as M4 Decision 11).

### Open questions
none

## 2. Affected modules
| Module | Touched? | Why / what changes | Rule that applies |
|---|---|---|---|
| root | yes | `.github/workflows/site.yml`, new `site/scripts/check-size.mjs`, new tests, possible a11y fixes in `site/src/`, `README.md`, `CONTRIBUTING.md`, `docs/SECURITY.md`, `site/package.json` + lockfile | layout of M1–M4 (§1 Binding sources); `INSIGHTS.md:8` |
| shared / duplicated contracts | no | — | — |

`validate.yml` is unchanged (spec `:910`). No plugin folder changes, so no plugin version bump.

## 3. Contracts

### 3.1 `site.yml` changes (everything not listed stays as is)
```yaml
# after `permissions: contents: read` (workflow level stays exactly that)
concurrency:
  group: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' && 'pages' || format('site-{0}', github.run_id) }}
  cancel-in-progress: false

# build job: append after "Fixture check", in this order
      - name: Size budgets
        run: node site/scripts/check-size.mjs site/dist

      - name: Lighthouse (report only)
        continue-on-error: true
        working-directory: site
        run: |
          npm run preview > "$RUNNER_TEMP/preview.log" 2>&1 &
          for i in $(seq 1 30); do curl -sf -o /dev/null http://localhost:4173/agent-plugins/ && break; sleep 1; done
          mkdir -p "$RUNNER_TEMP/lighthouse"
          npx --no-install lighthouse http://localhost:4173/agent-plugins/ --quiet \
            --output=json --output=html --output-path="$RUNNER_TEMP/lighthouse/home" \
            --chrome-flags="--headless=new --no-sandbox"
          node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('Lighthouse mobile, home: Performance '+Math.round(r.categories.performance.score*100)+', LCP '+(r.audits['largest-contentful-paint'].numericValue/1000).toFixed(2)+' s')" "$RUNNER_TEMP/lighthouse/home.report.json" >> "$GITHUB_STEP_SUMMARY"

      - name: Upload Lighthouse report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: lighthouse-report
          path: ${{ runner.temp }}/lighthouse/
          retention-days: 7

      - name: Upload Pages artifact
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: actions/upload-pages-artifact@v5   # latest major, confirmed in U1
        with:
          path: site/dist

# new job (a custom `if` without a status function implies success(), so a failed need skips it)
  deploy:
    name: 'Site: deploy'
    needs: [tests, build]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5   # latest major, confirmed in U1
```
The Lighthouse output file names (`home.report.json`, `home.report.html`) follow Lighthouse's multi-output naming; U1 confirms them against the installed version and adjusts only the path.

### 3.2 `site/scripts/check-size.mjs` CLI
```text
node site/scripts/check-size.mjs <dist-dir>
  initial JS  = files named by <script src> and <link rel="modulepreload" href> in <dist>/index.html,
                base prefix "/agent-plugins/" stripped, each counted once, minus <dist>/assets/catalog-*.js
  catalog     = the files matching <dist>/assets/catalog-*.js; exactly 1 required
  size        = zlib.gzipSync(bytes).length (default level), summed for initial JS; bytes, 1 KB = 1000 B
  budgets     = initial JS <= 120000 B, catalog <= 300000 B
stdout:  "initial JS: <n> B gzip (budget 120000 B)"   and   "catalog chunk: <n> B gzip (budget 300000 B)"
exit 0:  both within budget
exit 1:  over budget      -> stderr "::error::<initial JS|catalog chunk> <n> B gzip exceeds <max> B"
         catalog count != 1 -> stderr "::error::catalog chunk: expected 1 file, found <k>"
         a referenced file is missing -> stderr "::error::missing <path>"
exit 2:  no argument -> stderr "usage: check-size.mjs <dist-dir>"
```

### 3.3 Token contrast pairs (NFR-6a), both themes, values read from `site/src/styles/tokens.css`
```text
>= 4.5:1  --text, --text-2, --muted, --link, --link-visited  on --bg and --surface; --muted on --sunken
          --on-accent on --accent, --accent-hover, --accent-pressed
          --k-plugin, --k-skill, --k-agent, --k-hook, --k-command, --k-mcp on --kind-bg
          --warn on --warn-bg, --ok on --ok-bg, --err on --err-bg, --info on --info-bg
          --c-added, --c-version, --c-change on --surface
          --text on --mark;  --code on --code-bg
>= 3:1    --border on --bg, --surface, --sunken;  --focus on --bg, --surface;  --accent on --bg
excluded  --divider (decorative, Foundations.dc.html:126), --scrim, --overlay (= --surface)
```

## 4. Work units

### U0 — Lighthouse devDependency (Wave 0)
| Field | Value |
|---|---|
| Kind | orchestrator |
| Skills | — |
| Module | root |
| Wave | 0 |
| Depends on | none |
| Owns (create/modify) | `site/package.json`, `site/package-lock.json` |
| Must not touch | everything else |
| Consumes | — |
| Produces | `node_modules/.bin/lighthouse` for §3.1 |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `npm --prefix site install --save-dev --save-exact lighthouse@latest`. The entry has no `^`/`~`.
2. `npx --prefix site --no-install lighthouse --version` prints the installed version.

**Acceptance criteria**
- [ ] `site/package.json` lists `lighthouse` with an exact version; the lockfile is updated, and `npm ci` in `site/` succeeds — SPEC-01 NFR-2 (dependency), NFR-16a

### U1 — Pipeline: deploy, concurrency, budgets, Lighthouse (Wave 1)
| Field | Value |
|---|---|
| Kind | ci |
| Skills | none |
| Module | root |
| Wave | 1 |
| Depends on | U0 |
| Owns (create/modify) | `.github/workflows/site.yml`; `site/scripts/check-size.mjs` (create); `site/test/check-size.test.mjs` (create); `site/test/workflow.test.mjs` |
| Must not touch | `.github/workflows/validate.yml`, the triggers and path filters (`site.yml:3-19`), the tests job, `site/scripts/check-fixtures.mjs`, `site/package.json` |
| Consumes | §3.1, §3.2 |
| Produces | "Site: deploy", the size gate, the Lighthouse report |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. Confirm the latest majors of `actions/upload-pages-artifact` and `actions/deploy-pages` on their GitHub releases pages; use them in §3.1.
2. Edit `site.yml` exactly per §3.1.
3. Write `check-size.mjs` per §3.2 in the style of `check-fixtures.mjs:1-18` (top comment citing NFR-1a/1b, `node:` imports only).
4. `check-size.test.mjs` mirrors `check-fixtures.test.mjs:1-16`: temp `dist/` trees with `index.html` and `assets/`; `crypto.randomBytes` gives files that do not compress.
5. Update `workflow.test.mjs`:
   - job names = the three names, sorted (`:13`);
   - workflow `permissions` = `{contents: 'read'}`; tests and build = `{contents: 'read'}`; deploy = `{pages: 'write', 'id-token': 'write'}`; no other job or the workflow grants `pages` or `id-token`;
   - the `npm ci` / `fetch-depth` test (`:28-34`) iterates tests and build only;
   - deploy: `needs` = `['tests', 'build']`, `if` = the §3.1 expression, `environment.name` = `github-pages`, one step `uses` matching `/^actions\/deploy-pages@v\d+$/`;
   - `concurrency` equals §3.1 (group string, `cancel-in-progress: false`);
   - build step order Generate < Build < Fixture check < Size budgets < Lighthouse < Upload Lighthouse report < Upload Pages artifact, the last being the final step;
   - the Pages upload: `if` = the §3.1 expression, `with.path` = `site/dist`, `uses` matching `/^actions\/upload-pages-artifact@v\d+$/`; it is the only `upload-pages-artifact` use in any job;
   - the Lighthouse step has `continue-on-error: true` and writes to `GITHUB_STEP_SUMMARY`; Size budgets has no `continue-on-error`.
6. Run `npm --prefix site run build` then `node site/scripts/check-size.mjs site/dist` locally; record both sizes in the result.

**Acceptance criteria**
- [ ] `check-size.test.mjs`: within budget → exit 0 with both stdout lines; initial JS of 130 000 random bytes → exit 1; catalog of 310 000 random bytes → exit 1; 0 or 2 catalog files → exit 1; a catalog file named in a `modulepreload` is not counted in initial JS; a missing referenced file → exit 1; no argument → exit 2 — SPEC-01 NFR-1a, NFR-1b
- [ ] the real `site/dist` passes `check-size.mjs` — SPEC-01 NFR-1a, NFR-1b
- [ ] workflow test: three jobs, deploy reported as "Site: deploy" — SPEC-01 AC-67b
- [ ] workflow test: deploy `needs: [tests, build]` with a status-free `if` — SPEC-01 AC-54, NFR-17 (inspection half)
- [ ] workflow test: deploy and Pages upload carry the push-to-`main` `if`, so a PR run or any other ref skips both — SPEC-01 AC-53b, AC-53c, AC-55b (inspection half)
- [ ] workflow test: generate, build and Pages upload of `site/dist` in the one build job, and deploy only after it — SPEC-01 AC-7a, AC-52 (inspection half)
- [ ] workflow test: concurrency per §3.1 — SPEC-01 AC-56 (inspection half)
- [ ] workflow test: permissions per Step 5 — SPEC-01 NFR-15b (NFR-15a still holds)
- [ ] workflow test: deploy `environment.name` is `github-pages` — SPEC-01 NFR-15c
- [ ] workflow test: Lighthouse step `continue-on-error: true`, summary and `lighthouse-report` upload — SPEC-01 NFR-2 (report on a real run: §7)

### U2 — A11y matrix, focus, reduced motion, token contrast (Wave 2)
| Field | Value |
|---|---|
| Kind | a11y |
| Skills | none |
| Module | root |
| Wave | 2 |
| Depends on | U1 |
| Owns (create/modify) | `site/test/helpers/contrast.ts` (create); `site/test/tokens.test.ts` (create); `site/test/e2e/a11y.spec.ts` (create); `site/test/e2e/helpers.ts` (add helpers only); fixes only where a check fails: `site/src/styles/*.css` except `tokens.css`, `site/src/**/*.tsx`, `site/src/i18n/en.ts` (new keys only) |
| Must not touch | `site/src/styles/tokens.css`, `site/src/catalog/types.ts`, the existing e2e specs, `.github/`, `site/scripts/`, `site/vite.config.ts` |
| Consumes | §3.3; `ROUTES`, `VIEWPORTS` (`helpers.ts:18-31`) |
| Produces | `contrast(a, b)` and colour parsing in `site/test/helpers/contrast.ts` (used by U3 only if needed) |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` (e2e: run per §7 steps 2–3) |

**Steps**
1. `contrast.ts`: parse `#rrggbb` and `rgb()/rgba()` strings; WCAG 2.x relative luminance and ratio.
2. `tokens.test.ts`: read `tokens.css`, split the dark (`:root, :root[data-theme="dark"]`) and light blocks, assert every §3.3 pair in both themes. Fail with the pair, theme and ratio.
3. `a11y.spec.ts`, axe matrix: for the 5 routes `home, plugin, artifact, install, new` (`ROUTES` minus `unknown`) × themes `dark, light` (set `catalog.theme` by `addInitScript`) × widths 375 and 1280 → 20 named tests. Wait for the route h1, run `AxeBuilder` with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`, and assert no violation with impact `serious` or `critical`. On failure, print rule id and target.
4. Focus walk (Decision 6): per route, both themes, 1280 px. Press Tab until focus returns to an element already seen or `document.body`, with a cap of the page's focusable count + 5. For each focused element, read outline style, width and colour and the effective background in the page; assert ≥ 3:1 with `contrast()`. For the search input, check `.search` border colour instead.
5. Reduced motion (Decision 7): context `reducedMotion: 'reduce'`, each of the 5 routes: every `.app` element and pseudo-element has all `transition-duration` and `animation-duration` values `0s`. Leave the state: with `reducedMotion: 'no-preference'`, at least one `.btn` has a non-zero `transition-duration`.
6. Fix every failure in the app (Decision 8): markup in `.tsx`, rules in `app.css`/`search.css`/`pages.css`. New strings go into `en.ts` and follow `INSIGHTS.md:8`. List each fix with its axe rule or check in the result.
7. If a §3.3 pair fails, or a fix would change a token value, a route's layout or an M1–M4 contract, stop with `BLOCKED:`.

**Acceptance criteria**
- [ ] 20 axe tests green: 0 serious and 0 critical on home, plugin, artifact, install, new × dark, light × 375, 1280 — SPEC-01 NFR-5
- [ ] `tokens.test.ts` green for every §3.3 pair in both themes; the axe colour-contrast rule is part of the matrix — SPEC-01 NFR-6a
- [ ] focus walk green on the 5 routes in both themes: every Tab stop has an indicator ≥ 3:1 against its background — SPEC-01 NFR-6b
- [ ] with reduced motion every duration is `0s`; without it a `.btn` transition is non-zero — SPEC-01 NFR-8
- [ ] the M2–M4 e2e and Vitest suites stay green after the fixes — SPEC-01 NFR-5 (no regression)

### U3 — Keyboard flows, live region, smoke flow (Wave 3)
| Field | Value |
|---|---|
| Kind | e2e |
| Skills | none |
| Module | root |
| Wave | 3 |
| Depends on | U2 |
| Owns (create/modify) | `site/test/e2e/flows.spec.ts` (create); `site/test/e2e/helpers.ts` (add helpers only); fixes only where a flow fails: `site/src/**/*.tsx`, `site/src/styles/*.css` except `tokens.css`, `site/src/i18n/en.ts` (new keys only) |
| Must not touch | `site/src/styles/tokens.css`, `site/test/e2e/a11y.spec.ts`, `site/test/tokens.test.ts`, the M2–M4 e2e specs, `.github/`, `site/scripts/` |
| Consumes | `catalog`, `expected`, `plugin0` (`helpers.ts:8-14`); `en.search.count` (`SearchPage.tsx:101`) |
| Produces | — |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` (e2e: run per §7 steps 2–3) |

**Steps**
1. Add `tabTo(page, locator, max)` to `helpers.ts`: press Tab until the locator is focused, fail after `max` presses.
2. Keyboard-only tests use only `page.keyboard` (no `click`, `fill` or `check`). Context with clipboard permissions as `install.spec.ts:17`.
   - Search: Tab to the search box, type a query from a real catalog name, assert the first card matches `expected({ q })`.
   - Open: `tabTo` the first result's link, Enter → the plugin page h1.
   - Copy: on that page `tabTo` the install command's copy button, Enter → `navigator.clipboard.readText()` equals the plugin's `installCommand`.
   - Install set: on `#/install`, `tabTo` a plugin checkbox, Space → checked, and the CLI output contains its `installCommand`.
3. Live region: the `role="status"` count line has `aria-live="polite"`. Its text equals the `search.count` text for `expected({ q: '' })`, then for a typed query with a different result count.
4. Smoke flow (Chromium, normal clicks): search, open a plugin page, toggle theme (`data-theme` flips), copy an install command (clipboard text matches). Name the test "smoke" so M-4 repeats the same steps by hand.
5. Fix a failing flow in the app under the U2 limits (`INSIGHTS.md:8`), or stop with `BLOCKED:`.

**Acceptance criteria**
- [ ] keyboard-only search returns the expected first result — SPEC-01 NFR-7a
- [ ] keyboard-only Enter on a result opens its plugin page — SPEC-01 NFR-7b
- [ ] keyboard-only copy writes the install command to the clipboard — SPEC-01 NFR-7c
- [ ] keyboard-only Space on `#/install` adds the plugin and its CLI line — SPEC-01 NFR-7d
- [ ] the polite live region text changes to the new count when the result count changes — SPEC-01 NFR-7e
- [ ] smoke flow green on Chromium; Firefox and Safari are M-4 — SPEC-01 NFR-9

### U4 — Docs: README, SECURITY, CONTRIBUTING (Wave 4)
| Field | Value |
|---|---|
| Kind | docs |
| Skills | none |
| Module | root |
| Wave | 4 |
| Depends on | U1 (job names), U0 (no new commands) |
| Owns (create/modify) | `README.md`, `docs/SECURITY.md`, `CONTRIBUTING.md` |
| Must not touch | `docs/specs/**`, `docs/plans/**`, `plugins/**` (no version bumps), other docs |
| Consumes | `site/package.json:9-17` scripts |
| Produces | — |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `README.md`:
   - `:3`: drop "private" ("A Claude Code plugin marketplace …").
   - `:5-6`: state what ships, from `marketplace.json`: Django backend plugins, codebase onboarding, the spec-driven development workflow and research tools; frontend plugins are planned.
   - Add a line after the intro: browse the catalog at `https://humen-dev.github.io/agent-plugins/`.
   - `:10-18`: remove the private-repo paragraph and the `gh auth login` / `gh auth setup-git` block; the section starts with "Inside Claude Code:".
   - Layout block `:67-78`: add `site/  catalog website: generator and app, deployed to GitHub Pages` (Recommendation 3).
2. `docs/SECURITY.md:69-71`: "Open an issue for non-sensitive problems. Send exploit details to the owner ([@humen-dev](https://github.com/humen-dev)) directly; do not post them in issues or other public channels." (Recommendation 2).
3. `CONTRIBUTING.md`: new section `## Catalog site` before `## Commits and PRs`:
   - The site at `https://humen-dev.github.io/agent-plugins/` rebuilds and deploys on every merge to `main` that touches `plugins/**`, `.claude-plugin/**`, `site/**`, `scripts/validate-marketplace.mjs` or `.github/workflows/site.yml` (workflow "Site").
   - Local commands from the repository root, written out: `cd site`, `npm ci`, `node scripts/generate.mjs --out src/generated/catalog.json --repo humen-dev/agent-plugins` (same as `npm run generate`), `npm run dev`, `npm run build`, `npm run preview` (`http://localhost:4173/agent-plugins/`), `npm run check`, `npx playwright install chromium` then `npm run e2e`.

**Acceptance criteria**
- [ ] `README.md` and `docs/SECURITY.md` contain no match for `private` (case-insensitive) — SPEC-01 AC-57a
- [ ] `README.md` contains no `setup-git` — SPEC-01 AC-57b
- [ ] `README.md` links `https://humen-dev.github.io/agent-plugins/`, and its intro lists the shipped plugin areas — SPEC-01 AC-57c (owner brief)
- [ ] `CONTRIBUTING.md` states the rebuild on every merge to `main` that touches the site paths — SPEC-01 AC-58a
- [ ] `CONTRIBUTING.md` lists generate (with `--repo`), build, preview, dev, check and e2e; they run on a fresh clone (§7 step 4) — SPEC-01 AC-58b

## 5. Waves (execution order)
| Wave | Units | Runs | Why this order |
|---|---|---|---|
| 0 | U0 | sequential (orchestrator) | dependency + lockfile first (shared checkout rule) |
| 1 | U1 | sequential | pipeline, independent of the app |
| 2 | U2 | sequential | a11y checks and their fixes |
| 3 | U3 | sequential | keyboard flows run on the fixed app |
| 4 | U4 | sequential | docs name the final job and commands |

Serialized files:
- `site/package.json`, `site/package-lock.json`: U0 only.
- `.github/workflows/site.yml`, `site/test/workflow.test.mjs`: U1 only.
- `site/test/e2e/helpers.ts`: U2, then U3 (additions only).
- `site/src/i18n/en.ts`, `site/src/styles/*.css`, `site/src/**/*.tsx`: U2, then U3, fixes only.
- No migrations, vendored folders, agent docs or `INSIGHTS.md` edits.

## 6. Test plan
| Module | Tests | Owner (unit) | Needs a running stack? |
|---|---|---|---|
| root | `test/check-size.test.mjs` (node subprocess), `test/workflow.test.mjs` (yaml) | U1 | no |
| root | `test/tokens.test.ts` (unit) | U2 | no |
| root | `test/e2e/a11y.spec.ts` (20 axe tests, focus walk, reduced motion) | U2 | yes: generated catalog, `vite build`, `vite preview` on 4173, Chromium. NOT VERIFIABLE inside `checkCommand`; §7 runs it. |
| root | `test/e2e/flows.spec.ts` (keyboard, live region, smoke) | U3 | yes: as above, plus clipboard permissions |
| root | Lighthouse report, deploy, concurrency (real runs) | U1 | yes: GitHub Actions only. NOT VERIFIABLE locally; PR checklist (§7 step 6) |

## 7. Verification (orchestrator, after the last wave)
1. `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check`
2. `npm --prefix site run generate`, `npm --prefix site run build`, `node site/scripts/check-fixtures.mjs site/src/generated/catalog.json`, `node site/scripts/check-size.mjs site/dist` (record both sizes).
3. Free port 4173 (stop any process listening on it). Then `npm --prefix site run e2e -- --repeat-each=3`. All M2–M5 specs must be green in every run before reporting.
4. Docs: `grep -ni private README.md docs/SECURITY.md` and `grep -n setup-git README.md` print nothing; `grep -n 'humen-dev.github.io/agent-plugins/' README.md` matches. In a fresh clone (temp dir), run the `CONTRIBUTING.md` commands through `npm run build` and `npm run preview`.
5. Optional local Lighthouse: with the preview running, `npx --prefix site --no-install lighthouse http://localhost:4173/agent-plugins/ --quiet --output=json --output-path=<scratch>/home.json`; report Performance and LCP (target only: ≥ 90, ≤ 2.5 s).
6. PR body: the checklist below, every item unchecked (owner's launch checks and Recommendation 1):
   - [ ] M-1 screen-reader pass (NVDA or VoiceOver) through the search flow
   - [ ] M-2 visual check of both themes against `site/prototype/` (SF-19)
   - [ ] M-3 install-set CLI lines and settings snippet in a scratch project; one prefilled request link
   - [ ] M-4 smoke flow on current Firefox and Safari desktop
   - [ ] this PR's run: "Site: deploy" skipped, no `github-pages` artifact, `lighthouse-report` artifact and summary present (AC-53b, AC-53c, NFR-2)
   - [ ] after merge: the live footer shows the merged head sha within 15 min of the run's end (AC-52)
   - [ ] after merge: a failing run leaves the footer sha unchanged (AC-54, NFR-17)
   - [ ] after merge: three quick pushes to `main`, the middle run is cancelled, then AC-52 holds (AC-56)
7. Pre-PR:
   - Work on `feature/catalog-site-m5` only; never commit to `main`.
   - No Co-Authored-By or "Generated with" lines in commits or the PR body.
   - Show the owner the diff before opening the PR.
   - No plugin is touched, so no plugin version bump.

## 8. Risks
- **Axe and focus fixes outgrow U2** (finding 8): the violation count is unknown until the matrix runs. Mitigation: fixes limited to markup and non-token CSS; anything touching tokens, layout or M1–M4 contracts stops with `BLOCKED:` for the owner (Decision 8).
- **Deploy never fires or fires on PRs**: a wrong `if` would deploy from a PR or never deploy. Mitigation: one expression in both places, asserted in `workflow.test.mjs`; the PR run itself shows deploy skipped (§7 step 6).
- **Pending push cancelled by a dispatch**: avoided by Decision 2; asserted in the workflow test.
- **Least privilege**: `pages: write`/`id-token: write` leaking to another job. Mitigation: the workflow test asserts they appear only on deploy.
- **Lighthouse on the runner**: no Chrome found, or the preview not up yet. It shows as a failed, non-blocking step and a missing artifact. Mitigation: the readiness loop; `continue-on-error`; if Chrome is not found, set `CHROME_PATH` to the runner's Chrome in that step only.
- **Size check counts the wrong files**: Vite changes how `index.html` references chunks. Mitigation: §3.2 fails on a missing file or a catalog count other than 1, so drift shows as a red build, not a silent pass.
- **Focus walk flakiness** on long Tab sequences (home has many cards) under `--repeat-each=3`. Mitigation: a bounded walk, read styles in one `evaluate` per stop.
- **AC-63 scan failures** from fixes that add strings (`INSIGHTS.md:8`). Mitigation: cited in U2 and U3.

## 9. Out of scope
- M-1..M-4 manual launch checks (owner; PR checklist only).
- Lighthouse as a gate (NFR-2 is report-only).
- Firefox and Safari in CI (NFR-9: manual M-4).
- Path filter for `.github/ISSUE_TEMPLATE/**` (SF-18, still with the spec owner).

### Spec follow-ups (owner: user / spec author)
- SF-19: M-2 (`:806-807`, `:847`) points to `docs/design/`, which holds only `site-brief.md` and `catalog-sample.json`. The approved design is `site/prototype/`.
- SF-20: CI/CD `:905` says deploy runs on `main` "push or dispatch"; the owner chose push only (Decision 1). Align `:899` (upload condition) and `:865-870` (concurrency group `pages` for push runs to `main` only, Decision 2), and AC-56 wording if needed.
- SF-21: CI/CD `:898` says "Lighthouse CI report"; M5 uses the `lighthouse` CLI (Decision 4). Say "Lighthouse report".
- SF-22: NFR-1a/1b (`:719-720`) leave "KB" and "initial JavaScript" undefined. State Decision 3: 1 KB = 1000 B gzip; initial JS = every script and modulepreload in `index.html`, `theme-init.js` included, minus the catalog chunk.
