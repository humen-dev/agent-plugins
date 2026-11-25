# root insights

- MiniSearch BM25 averages field length per field and skips `null`/`undefined` values, which drags the average down; a fixture that expects equal scores across two fields needs the same field shape in both (`node_modules/minisearch/src/MiniSearch.ts:2028-2030`, `site/test/search/fixture-catalog.ts`). — U1
- In MiniSearch 7.2 `result.terms` holds the query terms; the matched index terms are the keys of `result.match` (`node_modules/minisearch/src/MiniSearch.ts:1921-1932`). — U1
- React runs its development build under vitest (about 60 µs per element), so an "N-thousand elements within X ms" limit is bound by element count, not by the parser; bound the rendered elements instead (`site/test/markdown/hostile.test.ts:18`). — U1 (M3)
- An anchored regex of the form `\s+(.*)$` needs the `s` flag (or no trailing `$`); otherwise a long whitespace run followed by U+2028 backtracks quadratically (`site/src/markdown/parse.ts:98`, `:102`). — U1 (M3)
- A Markdown table separator needs `---` in test fixtures; a bare `-` row is parsed as a body row (`site/test/markdown/markdown-block.test.tsx:97`). — U1 (M3)
- The AC-63 scan flags any string literal inside a `title`/`aria-label`/`data-label` attribute expression and any `t()` call whose argument is not a plain literal; a ternary inside `t(...)` or `title={...}` fails, so write `cond ? t('a') : t('b')` (`site/test/i18n.test.ts:28-37`). — U2 (M3)
- `site/scripts/*.mjs` are type-checked by `tsc` (checkJs), so arrow-function parameters need JSDoc types (`site/scripts/check-size.mjs:15`). — U1 (M5)
- The search input sets `outline: none` and its `.search` wrapper draws the focus ring, so a focus check reads the wrapper border, not the input outline (`site/src/styles/search.css:14`, `site/test/e2e/a11y.spec.ts`). — U2 (M5)
