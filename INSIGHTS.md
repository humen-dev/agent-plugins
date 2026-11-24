# root insights

- MiniSearch BM25 averages field length per field and skips `null`/`undefined` values, which drags the average down; a fixture that expects equal scores across two fields needs the same field shape in both (`node_modules/minisearch/src/MiniSearch.ts:2028-2030`, `site/test/search/fixture-catalog.ts`). — U1
- In MiniSearch 7.2 `result.terms` holds the query terms; the matched index terms are the keys of `result.match` (`node_modules/minisearch/src/MiniSearch.ts:1921-1932`). — U1
