# Catalog site — design prototype

Design reference for SPEC-01 (`docs/specs/catalog-site.md`), made in Claude Design from
`docs/design/site-brief.md` and `docs/design/catalog-sample.json`.
Source artifact: https://claude.ai/artifact/LD5dHxF4ichbrctGocsgkP (private to the owner).

**Not part of the build.** These `*.dc.html` files run only inside Claude Design's runtime
(`support.js` is not in the repo), so they don't open standalone. Read them as source:

| File | What it holds |
|---|---|
| `Main.dc.html` | The whole interactive prototype: every route and state, desktop 1280 (data + logic in the script block) |
| `Mobile.dc.html` | `Main` at 375 px |
| `Markdown.dc.html` | Markdown block component (safe link handling, tables, code) |
| `Foundations.dc.html` | Tokens with contrast ratios (dark + light), type scale, spacing, icon set (inline SVG paths) |
| `Components.dc.html` | Every component state in both themes |
| `catalog.css` | Tokens and component styles — the starting point for `site/src` styles |
| `canvas.json` | Board layout of the design canvas |

If the prototype and SPEC-01 disagree, the spec wins.
