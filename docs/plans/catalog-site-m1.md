# Catalog site M1 (generator and "Site" workflow) — development plan

| Field | Value |
|---|---|
| Status | approved |
| Goal | A maintainer runs `node site/scripts/generate.mjs --out <file>` (locally or in the new "Site" workflow) and gets a deterministic, schema-checked `catalog.json` built from the repository and its git history, with the validator run first and every other source problem reported as a warning. |
| Requirements source | `docs/specs/catalog-site.md` (SPEC-01, Status: approved), milestone M1 only (`:919`) (input — this plan never edits it) |
| Execution mode | single-agent (sequential pass) — chosen by the user |
| Modules touched | root |

## 1. Context

Today there is no generator, no `site/` app code and no "Site" workflow. `site/` holds only the design prototype (`site/prototype/*`). CI is one workflow, `.github/workflows/validate.yml` (actions pinned `checkout@v7` `:16`, `setup-node@v7` `:20`, Node 22 `:22`, `permissions: contents: read` `:9-10`). The validator takes a repo-root argument (`scripts/validate-marketplace.mjs:12,17`), prints `warning: …` lines to stderr, `error:   …` lines to stderr and a summary to stdout (`:207-212`), and exits 1 on errors (`:214`).

Requirements: SPEC-01 M1 rows — AC-1..AC-5, AC-6a, AC-6b, AC-8a, AC-8b, AC-9..AC-12, AC-53a, AC-55a, AC-65a..AC-65d, AC-66, AC-67a, AC-71, AC-72, EC-8, EC-9, EC-10, EC-18, UT-2b, UT-7, UT-8, UT-9a, UT-9b, UT-10a, UT-10b, NFR-4, NFR-10a, NFR-10b, NFR-15a, NFR-16a, NFR-16b, NFR-18. Data model `docs/specs/catalog-site.md:147-281`, extraction rules X-1..X-18 `:288-307`, CI/CD `:854-911`, testing `:812-831`.

Binding sources: there is no root `AGENTS.md` / `CLAUDE.md` and no `INSIGHTS.md` anywhere (Glob at the root). No existing TS/Node app module exists; the layout below was chosen by the user (Answer 2a). The only `scripts/lib` pattern in the repo is `plugins/spec-driven/scripts/lib/*.mjs`. Line endings: `.gitattributes:8,10` forces LF for `*.mjs` and `*.json` (the validator rejects CRLF `.mjs`, `scripts/validate-marketplace.mjs:70-71`).

All paths are relative to the repository root.

### Requirements review
Approved-spec review round 1 (findings 1–8) and the user's answers:
- F1 Infeasible (checks not runnable by implementer/verifier, `.claude/sdd.json:4`, `plugins/spec-driven/scripts/bash-guard.mjs:107-127`): resolved by Answer 1a — U0 sets the new `checkCommand` (§3.6).
- F2 Gap (layout inside `site/`): resolved by Answer 2a (§3.3 paths).
- F3 Gap (M1 workflow steps): the M1 workflow contains only the steps that exist in M1 (Decision 4).
- F4 Untestable locally: NFR-4, NFR-16b, AC-53a, AC-55a are inspection + CI; locally NOT VERIFIABLE (§6). NFR-4 has a 30 s test timeout as a local proxy.
- F5 Feasibility: symlink, > 1 MB and invalid-UTF-8 fixtures are created at test time (Decision 6).
- F6 Validator reuse: confirmed (Decision 2).
- F7 Serialized `.gitignore`: a new `site/.gitignore` instead of editing the root file.
- F8 Note: fixture `hooks/` and `.mcp.json` match `CODEOWNERS:6-7`; the PR needs owner review.
- New minor finding F9: a skill without `description` is a validator **error** (`scripts/validate-marketplace.mjs:166`), so AC-10 for skills is tested at extraction level (U3), not end to end.
- New minor finding F10: X-17 example "a README without the expected heading" does not say which heading (Decision 9; spec follow-up).
- New minor finding F11: the model types frontmatter values as `string | number | boolean | string[]` (`:216`); YAML can also yield null, maps or non-string lists (Decision 10; spec follow-up).
- Recommendation 1 (AC-1 schema derived from the types with `ts-json-schema-generator` + `ajv`, devDependencies): **accepted**.
- Recommendation 2 (generator in `.mjs` with JSDoc, type-checked by `tsc` `checkJs` against `site/src/catalog/types.ts`): **accepted**.

### Decisions
1. **One `types.ts` is the single source** (§3.1), used by the JSDoc in the generator, by the AC-1 schema test, and later by the M2 app. Rejected: a hand-written JSON schema (drift).
2. **The generator runs the repo's own validator** by path relative to itself (`site/scripts/../../scripts/validate-marketplace.mjs`) with `process.execPath` and the target root as argument. Fixture repos therefore need no copy of the validator. Rejected: copying the validator into each temp repo.
3. **In-process API + thin CLI.** `generate()` (§3.2) returns the catalog; the CLI only parses flags, prints annotations and writes the file. Real-repo tests call `generate()` in-process (`:824-826`); stdout, exit-code, env and determinism tests spawn the CLI.
4. **M1 workflow = M1 steps only.** "Site: tests": checkout `fetch-depth: 0`, Node 22 + npm cache, `npm ci`, lint, typecheck, Vitest, `npm audit` warning step. "Site: build": checkout `fetch-depth: 0`, Node 22, `npm ci`, generate. Spec steps tests-6/7 and build-3/4/5/6, concurrency and deploy are added by M2/M5. Rejected: placeholder steps that do nothing.
5. **Output path in CI and the `generate` npm script:** `site/src/generated/catalog.json`, ignored by `site/.gitignore`. M2 may move it; it is not a contract of this milestone.
6. **Hostile binary-ish fixtures at test time.** Symlink, > 1 MB file, invalid UTF-8 file, `.env` and `secrets.txt` are written into the temp copy of the fixture repo by the test. If `symlinkSync` fails with `EPERM` (Windows without developer mode) the symlink case is skipped with that reason; it always runs on `ubuntu-latest`. Rejected: committed symlinks/binaries.
7. **Failure leaves no output** (AC-8b): the CLI deletes any file at `--out` before it starts and writes the result through `<out>.tmp` + rename only after success.
8. **History via plain `git`** with `--no-merges --no-renames -z`, `%H %ct %cI`, and `git cat-file --batch` for file contents at a commit (one process; NFR-4). `--no-renames` makes a moved folder a `change` for the old name (X-13 (3), EC-10). Sorting newest-first uses `%ct` (epoch), ties by sha ascending — never the ISO string. A historic `plugin.json` that does not parse counts as "no version", without a diagnostic (history is not a current source).
9. **"README without the expected heading"** (X-17, F10) is read as: a hook or MCP server whose README has no matching `### <name>` under `## What it runs`. It gives one warning on the README path; the description then falls back by X-7/X-8.
10. **Unsupported frontmatter value** (F11): a key whose value is null, a map, or a list with a non-string item is dropped with one warning (`frontmatter: key "<k>" has an unsupported value`), as X-16's "only that key is dropped".
11. **Deterministic text:** every sort compares by UTF-16 code unit (`a < b`), never `localeCompare`; git is spawned with `LC_ALL=C`, `-c core.quotepath=off`; JSON is `JSON.stringify(x, null, 2) + "\n"` (NFR-10a/b).
12. **`--repo` wins over `GITHUB_REPOSITORY`**; with neither, or a value not matching `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`, the CLI exits 2 with a usage message. Rejected: a hard-coded default repo.
13. **Annotation escaping:** diagnostic text is untrusted; `::warning` lines escape `%`, `\r`, `\n` (and `:` `,` in the `file` property) as GitHub workflow commands require (§3.4), so a hostile message cannot inject another workflow command.
14. **`tsc` covers `src/` and `scripts/` only** (`checkJs`); tests are linted, not type-checked. Rejected: type-checking tests (cost, no requirement).
15. **Skills:** no available skill covers Node/Vitest/YAML implementation; `spec-driven:untrusted-input-threats` is for spec writing only ("Not for … implementation advice"). Every unit lists `none`.

### Open questions
none

## 2. Affected modules
| Module | Touched? | Why / what changes | Rule that applies |
|---|---|---|---|
| root | yes | new `site/` package (generator, types, tests, fixtures, configs), new `.github/workflows/site.yml`, `checkCommand` in `.claude/sdd.json` | spec code location `docs/specs/catalog-site.md:131-133`; layout Answer 2a; lib pattern `plugins/spec-driven/scripts/lib/`; workflow pins `.github/workflows/validate.yml:16,20` |
| shared / duplicated contracts | no | — | — |

`site/` consumes `scripts/validate-marketplace.mjs` as a subprocess (read-only; never edited). `validate.yml` is unchanged (`:910-911`).

## 3. Contracts (the interfaces every unit agrees on)

### 3.1 `site/src/catalog/types.ts` (U0)
```text
The TypeScript block at docs/specs/catalog-site.md:149-281, verbatim (field order = model order, X-15),
with `export` in front of every `type` and `interface`, plus:

export type FrontmatterValue = string | number | boolean | string[];
// ArtifactBase.frontmatter is Record<string, FrontmatterValue> (same type as the spec).
```

### 3.2 Generator CLI and in-process API (`site/scripts/generate.mjs`, U4)
```text
node site/scripts/generate.mjs --out <file> [--repo <owner/name>] [--root <dir>]
  --out   required; parent dir is created
  --repo  else env GITHUB_REPOSITORY (the only env value copied, UT-9b); see Decision 12
  --root  repo to read; default: resolve(<dir of generate.mjs>, '../..')
exit 0  catalog written (warnings allowed, AC-65d); one `::warning file=<path>::<message>` line per diagnostic on stdout
exit 1  validator errors (validator stdout+stderr forwarded to stderr, AC-8a) · shallow clone
        (stderr exactly `full git history required (shallow clone)`, AC-9) · unexpected error
exit 2  usage error
on exit != 0: no file at --out (AC-8b, Decision 7)
```
```js
/** @param {{ root: string, repo: string }} opts
 *  @returns {Promise<{ catalog: Catalog, json: string }>}  json = serialised catalog, LF, 2-space, trailing \n
 *  @throws {GeneratorError} { message: string, exitCode: 1 } */
export async function generate(opts);
export class GeneratorError extends Error { exitCode; }
// CLI main runs only when import.meta.url === pathToFileURL(process.argv[1]).href
```
Order inside `generate()`: (1) validator (§3.3 `runValidator`), (2) shallow check, (3) read sources, (4) history, (5) assemble.

### 3.3 Internal lib modules (`site/scripts/lib/`)
```js
// diagnostics.mjs (U1)
export function createDiagnostics(); // → { warn(path: string, message: string): void, list(): Diagnostic[] }  list() sorted by path, then message (code unit)
export function formatWarning(d: Diagnostic): string; // §3.4

// frontmatter.mjs (U1) — X-16; yaml@2 parseDocument, schema 'core', toJS({ maxAliasCount: 100 })
export function parseFrontmatter(text: string, path: string, diag): { data: Record<string, FrontmatterValue>, body: string };
// no frontmatter → { data: {}, body: text }. YAML syntax error (doc.errors) → line reader, no warning.
// Rejected (warning code TAG_RESOLVE_FAILED, or toJS throws for the alias limit) → line reader + UT-10b warning.

// safe-fs.mjs (U1) — the ONLY module that touches the file system for sources (UT-7, UT-8, UT-9a)
export function createReader(root: string, diag); // → {
//   readText(relPath: string, within: string): string | null  // within = repo-relative plugin folder or '.claude-plugin'
//   readJson(relPath: string, within: string): unknown | null  // invalid JSON → warning, null
//   list(relDir: string, within: string): string[]             // repo-relative file paths, sorted; skips symlinks (warning),
//                                                              // node_modules/, dot-entries (X-14); never follows a link
// }
// readText: lstat first; symlink → warning, null (content never read); realpath outside `within` → warning, null;
// size > 1 048 576 bytes → warning, null; TextDecoder('utf-8', { fatal: true }) fails → warning, null.
// Throws if relPath is outside '.claude-plugin/' and 'plugins/' (programming error, X-14).

// history.mjs (U2) — X-13, Decision 8
export function assertFullHistory(root: string): void;   // throws GeneratorError(`full git history required (shallow clone)`)
export function readHead(root: string): { commit: string, commitDate: string };
export function readHistory(root: string, repoUrl: string): {
  changes: Change[],                       // all plugins incl. old names, newest first (unsliced)
  updated: Map<string, string>,            // plugin folder name → committer date ISO of last commit touching plugins/<name>/
};
// caller: catalog.changes = changes.slice(0, 100); plugin.recentChanges = changes.filter(c => c.plugin === name).slice(0, 10)

// validator.mjs (U4) — X-17 step 1
export function runValidator(root: string): { ok: boolean, output: string, warnings: string[] };
// warnings = text after `warning: ` of each validator warning line; output = stdout + stderr verbatim

// plugin.mjs, artifacts.mjs (U3) — X-1..X-12, X-15, X-18
export function extractCatalogParts(reader, diag, ctx: { root: string, repoUrl: string, commit: string, marketplaceName: string })
  : { marketplace: unknown, plugins: Omit<Plugin, 'updated' | 'recentChanges'>[], artifacts: Artifact[] };
// artifacts.mjs exports per-kind extractors used by plugin.mjs; their names are U3's choice.
```

### 3.4 Diagnostic and annotation formats
```text
::warning file=<esc(path, prop)>::<esc(message)>
esc(s)        = s.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')
esc(s, prop)  = esc(s).replaceAll(':','%3A').replaceAll(',','%2C')

Message prefixes (tests match on path + prefix):
  validator: <text after "warning: ">                path ".claude-plugin/marketplace.json"
  source: not a relative path, skipped               (X-1)
  frontmatter: YAML rejected (<reason>); read line by line   (UT-10b, exact)
  frontmatter: key "<k>" could not be read           (X-16)
  frontmatter: key "<k>" has an unsupported value    (Decision 10)
  description: missing                               (X-17)
  hook: unknown shape                                (X-7)
  mcp: url only, transport unknown                   (X-8)
  duplicate: <kind> "<name>" already defined by <path>   (X-15)
  file: larger than 1 MB, skipped · file: not valid UTF-8, skipped · file: symlink, skipped · file: outside the plugin folder, skipped
  readme: no "### <name>" under "## What it runs"    (Decision 9)
  json: invalid (<reason>)
```

### 3.5 `.github/workflows/site.yml` (U5)
```yaml
name: Site
on:
  pull_request: { paths: &p ['plugins/**', '.claude-plugin/**', 'site/**', 'scripts/validate-marketplace.mjs', '.github/workflows/site.yml'] }
  push: { branches: [main], paths: *p }   # write the list out twice if anchors are not accepted by Actions
  workflow_dispatch:
permissions: { contents: read }
jobs:
  tests:  { name: 'Site: tests', runs-on: ubuntu-latest, permissions: { contents: read }, steps: [...] }
  build:  { name: 'Site: build', runs-on: ubuntu-latest, permissions: { contents: read }, steps: [...] }
```
Steps per Decision 4; `actions/checkout@v7` with `fetch-depth: 0`; `actions/setup-node@v7` with `node-version: 22`, `cache: npm`, `cache-dependency-path: site/package-lock.json`; `npm ci` with `working-directory: site`. Audit step (never fails, NFR-16b):
```bash
if ! out="$(npm audit --omit=dev --audit-level=high 2>&1)"; then
  s="$(printf '%s' "$out" | tail -n 5)"; s="${s//'%'/'%25'}"; s="${s//$'\r'/'%0D'}"; s="${s//$'\n'/'%0A'}"
  echo "::warning::npm audit: ${s}"
fi
```
Build generate step: `node site/scripts/generate.mjs --out site/src/generated/catalog.json` (runner's default `GITHUB_REPOSITORY`).

### 3.6 `site/package.json` scripts and `checkCommand` (U0)
```json
{ "name": "catalog-site", "private": true, "type": "module", "engines": { "node": ">=22" },
  "scripts": { "lint": "eslint .", "typecheck": "tsc --noEmit", "test": "vitest run",
               "check": "eslint . && tsc --noEmit && vitest run",
               "generate": "node scripts/generate.mjs --out src/generated/catalog.json" } }
```
`.claude/sdd.json` `checkCommand` = `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check`

### 3.7 Test helper (`site/test/helpers/fixture-repo.mjs`, U2)
```js
export function tempRepo(): string;                          // mkdtemp + git init -b main, core.autocrlf=false, commit.gpgsign=false
export function copyFixture(srcDir: string, dest: string): void;
export function commit(repo: string, { files?: Record<string, string | Buffer | null>, message: string, date: string }): string; // null = delete; returns sha; sets GIT_AUTHOR_DATE/GIT_COMMITTER_DATE, fixed name/e-mail via -c
export function git(repo: string, ...args: string[]): string;
export function shallowClone(repo: string): string;           // git clone --depth 1 file://<repo>
export function cleanup(dir: string): void;
```

## 4. Work units

### U0 — Package, configs, types, checkCommand
| Field | Value |
|---|---|
| Kind | orchestrator |
| Skills | none |
| Module | root |
| Wave | 0 |
| Depends on | none |
| Owns (create/modify) | `site/package.json`, `site/package-lock.json`, `site/tsconfig.json`, `site/eslint.config.js`, `site/vitest.config.ts`, `site/.gitignore`, `site/src/catalog/types.ts`, `.claude/sdd.json` |
| Must not touch | `docs/specs/**`, root `.gitignore`, `site/prototype/**` |
| Consumes | spec model `docs/specs/catalog-site.md:149-281` |
| Produces | §3.1, §3.6 |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. Write `site/package.json` per §3.6. Install: runtime `yaml` (v2); dev `typescript`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`, `globals`, `ajv`, `ts-json-schema-generator`, `@types/node` (`npm --prefix site install …`, commits the lockfile).
2. `tsconfig.json`: `strict`, `noEmit`, `allowJs`, `checkJs`, `module: esnext`, `moduleResolution: bundler`, `allowImportingTsExtensions`, `target`/`lib` ES2023, `types: ["node"]`, `include: ["src/**/*.ts", "scripts/**/*.mjs"]` (Decision 14).
3. `eslint.config.js`: `@eslint/js` recommended + `typescript-eslint` recommended for `*.ts`, `globals.node`; ignores `node_modules/`, `dist/`, `prototype/`, `src/generated/`, `test/fixtures/`.
4. `vitest.config.ts`: `include: ['test/**/*.test.mjs']`, `exclude: ['test/fixtures/**', 'node_modules/**']`, `passWithNoTests: true` (Wave 0 has no tests yet).
5. `site/.gitignore`: `node_modules/`, `dist/`, `src/generated/`, `*.tmp`.
6. `types.ts` per §3.1.
7. Set `checkCommand` in `.claude/sdd.json` per §3.6; run `npm --prefix site ci` and the check once.

**Acceptance criteria**
- [ ] `npm --prefix site run check` passes on the Wave 0 tree; `site/package-lock.json` is committed — NFR-16a, NFR-18
- [ ] `types.ts` equals the spec model with `export` added — AC-1

### U1 — Diagnostics, lenient frontmatter, safe reader
| Field | Value |
|---|---|
| Kind | library |
| Skills | none |
| Module | root |
| Wave | 1 |
| Depends on | U0 |
| Owns (create/modify) | `site/scripts/lib/diagnostics.mjs`, `site/scripts/lib/frontmatter.mjs`, `site/scripts/lib/safe-fs.mjs`, `site/test/diagnostics.test.mjs`, `site/test/frontmatter.test.mjs`, `site/test/safe-fs.test.mjs` |
| Must not touch | `site/src/catalog/types.ts`, configs from U0 |
| Consumes | §3.1, §3.4 |
| Produces | §3.3 `diagnostics.mjs`, `frontmatter.mjs`, `safe-fs.mjs` |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `diagnostics.mjs` and `formatWarning` per §3.3/§3.4, sorted output (Decision 11).
2. `frontmatter.mjs` per X-16 (`docs/specs/catalog-site.md:305`): YAML first; line reader for syntax errors (no warning) and for rejected YAML (UT-10b warning, exact text); the line reader splits at the first `: `, skips blank and `#` lines (also inside lists), types `true`/`false`/ints/floats like the core schema, reads `>`/`|` blocks and `- item` lists. Folded descriptions join into one line (X-3). Unreadable key → warning, key dropped; unsupported value → Decision 10.
3. `safe-fs.mjs` per §3.3. Tests create symlink, > 1 MB, invalid UTF-8 files in `os.tmpdir()` (Decision 6).

**Acceptance criteria**
- [ ] `description: Use when: X` parses to `Use when: X` with no diagnostic — SPEC-01 AC-66
- [ ] a billion-laughs frontmatter (alias chain over 100) and a custom-tag frontmatter are read by the line reader within 1 s, result size bounded — SPEC-01 UT-10a
- [ ] the same inputs add exactly `frontmatter: YAML rejected (<reason>); read line by line` for that path — SPEC-01 UT-10b
- [ ] comment lines inside a `skills:` list are skipped; `maxTurns: 100` is the number 100 — SPEC-01 AC-3
- [ ] symlinked file and a realpath outside `within` return null, content never read, one warning each — SPEC-01 UT-7, AC-65a
- [ ] a 1 048 577-byte file and an invalid-UTF-8 file return null with one warning each — SPEC-01 UT-8, AC-65a
- [ ] `formatWarning` output for a message containing `\n::error::x` stays one line — SPEC-01 AC-65b

### U2 — Git history and fixture-repo helper
| Field | Value |
|---|---|
| Kind | library |
| Skills | none |
| Module | root |
| Wave | 2 |
| Depends on | U0, U1 |
| Owns (create/modify) | `site/scripts/lib/history.mjs`, `site/test/helpers/fixture-repo.mjs`, `site/test/history.test.mjs` |
| Must not touch | U1 files (consume only) |
| Consumes | §3.1, §3.3 `diagnostics.mjs` |
| Produces | §3.3 `history.mjs`, §3.7 |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. Helper per §3.7 (commits scripted in the test, known dates).
2. `history.mjs` per X-13 (`docs/specs/catalog-site.md:302`) and Decision 8: candidates per plugin folder; `added` = first commit (committer date, ties sha asc) where the name is an exact `plugins[].name` of `marketplace.json` at that commit; `version` only when `plugin.json` exists at parent and commit with different `version`; precedence added > version > change; `url` = `<repoUrl>/commit/<sha>`; `subject` verbatim.
3. `assertFullHistory` via `git rev-parse --is-shallow-repository`.

**Acceptance criteria**
- [ ] scripted repo with a `--no-ff` merged branch older than a later `main` commit and two commits with equal dates: `updated`, per-plugin and global order match X-13/X-15; no merge commit appears — SPEC-01 AC-5
- [ ] a commit that adds a plugin to `marketplace.json` together with its `plugin.json` gives one `added` Change — SPEC-01 AC-71
- [ ] that Change has `version: { from: null, to: "<version>" }` — SPEC-01 AC-72
- [ ] a commit touching two plugin folders gives one Change per plugin — SPEC-01 EC-9
- [ ] a commit touching only `plugins/<old>/` of a renamed plugin gives `plugin: "<old>"`; deleting/moving a folder gives `change` — SPEC-01 EC-10
- [ ] `assertFullHistory` on `shallowClone()` throws with `full git history required (shallow clone)` — SPEC-01 AC-9

### U3 — Plugin and artifact extraction, fixture repo
| Field | Value |
|---|---|
| Kind | library |
| Skills | none |
| Module | root |
| Wave | 3 |
| Depends on | U1, U2 |
| Owns (create/modify) | `site/scripts/lib/plugin.mjs`, `site/scripts/lib/artifacts.mjs`, `site/test/fixtures/repo/**` (marketplace + `plugins/fixture-*`), `site/test/extract.test.mjs` |
| Must not touch | U1/U2 files (consume only); `site/test/helpers/fixture-repo.mjs` |
| Consumes | §3.1, §3.3 (reader, frontmatter, diagnostics), §3.4 |
| Produces | §3.3 `extractCatalogParts` |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. Fixture repo `site/test/fixtures/repo/` that passes the validator (each plugin: `plugin.json` with matching name + SemVer, `README.md`, LF scripts; skills with descriptions, `scripts/validate-marketplace.mjs:116-166`): `fixture-full` (every field incl. `author.email`, deps string + object, notices, What it runs, every kind, two hooks referencing one script, `.mcp.json` with env values, a `*.test.mjs` and `evals/` file), `fixture-minimal` (optional fields absent), `fixture-inline` (hooks and mcpServers inline in `plugin.json`), `fixture-paths` (`hooks` as a path string), `fixture-hostile` (`javascript:`/`data:` URLs, billion-laughs and custom-tag agents, `tools: Bash` agent, agent without `tools`, unknown hook shape, url-only MCP, duplicate names, README without the hook heading, artifacts without description), and a marketplace entry with a `github` source pinned to a 40-hex `sha` (`:91-92`).
2. `plugin.mjs`/`artifacts.mjs` per X-1..X-12, X-15, X-18 and §3.3; every file read goes through the reader; `homepage`/`repository`/`author.url` keep only `http:`/`https:` (parsed with `URL`), e-mail never copied; `envVars` = env keys only.
3. Tests run `extractCatalogParts` on a temp copy (`copyFixture`), adding at test time a symlink, a > 1 MB file, an invalid-UTF-8 agent, `.env` at the root and `plugins/fixture-full/secrets.txt`, each holding a sentinel string.

**Acceptance criteria**
- [ ] one Plugin per relative-source entry with X-1, X-2, X-9..X-11 fields for `fixture-full` and `fixture-minimal`; the `github` entry is skipped with a warning — SPEC-01 AC-2, AC-65a
- [ ] one artifact per X-3..X-8 source item, in both inline and separate-file forms — SPEC-01 AC-3
- [ ] table test: `invokeAs` per kind per X-6 — SPEC-01 AC-4
- [ ] artifacts of every kind without a source description have `description: ""` (skill case here only, F9) — SPEC-01 AC-10
- [ ] no MCP `env` value string occurs in the output — SPEC-01 AC-11
- [ ] no `email` key anywhere in the output — SPEC-01 AC-12
- [ ] both hook ids in the shared script's `referencedBy` — SPEC-01 EC-8
- [ ] `tools: Bash` agent and no-`tools` agent give `runsCode: true`, `reasons` incl. `shell`, ids in `shellArtifacts` — SPEC-01 EC-18
- [ ] `javascript:`/`data:` manifest URLs become `null` — SPEC-01 UT-2b
- [ ] symlink, > 1 MB, invalid-UTF-8 targets: content absent, one warning each, sibling items present — SPEC-01 UT-7, UT-8, AC-65c
- [ ] sentinels from `.env` and `secrets.txt` are absent from the output — SPEC-01 UT-9a
- [ ] one warning per X-17 example on the problem's path (§3.4 prefixes) — SPEC-01 AC-65a

### U4 — CLI, validator step, schema and real-repo tests
| Field | Value |
|---|---|
| Kind | cli |
| Skills | none |
| Module | root |
| Wave | 4 |
| Depends on | U1, U2, U3 |
| Owns (create/modify) | `site/scripts/generate.mjs`, `site/scripts/lib/validator.mjs`, `site/test/generate.test.mjs`, `site/test/schema.test.mjs`, `site/test/real-repo.test.mjs` |
| Must not touch | `scripts/validate-marketplace.mjs`, `site/test/fixtures/**` (U3; mutate only temp copies) |
| Consumes | §3.1–§3.4, §3.7 |
| Produces | §3.2 |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. `validator.mjs` per §3.3/Decision 2 (`spawnSync(process.execPath, [validator, root])`).
2. `generate.mjs` per §3.2: order validator → shallow → sources → history → assemble; `marketplace` (`repoUrl`, `addCommand`), `build`, `categories`, `kinds` (Kind order), `plugins` with `updated`/`recentChanges`, `artifacts`, `changes` ≤ 100, `diagnostics` (validator warnings first mapped per X-17 step 1); object keys in model order; Decisions 7, 11, 12.
3. `schema.test.mjs`: build the JSON schema from `src/catalog/types.ts` type `Catalog` with `ts-json-schema-generator`, validate with `ajv`.
4. `real-repo.test.mjs` (in-process on the checkout, timeout 30 000 ms): expected sets and counts computed from source files in the test, never hard-coded (`:827-831`).

**Acceptance criteria**
- [ ] fixture output and real-repo output pass the schema derived from `Catalog` — SPEC-01 AC-1
- [ ] temp fixture with `plugin.json` deleted: exit ≠ 0, validator output on stderr — SPEC-01 AC-8a
- [ ] same run: no file at `--out` (also when one existed before) — SPEC-01 AC-8b
- [ ] fixture with only a validator warning (unlisted plugin folder, `:196`) exits 0 and has a diagnostic with `path: ".claude-plugin/marketplace.json"` — SPEC-01 AC-8a, AC-65a, AC-65d
- [ ] CLI stdout has one `::warning file=<path>::<message>` per diagnostic — SPEC-01 AC-65b
- [ ] CLI on a shallow clone of the fixture: exit ≠ 0, stderr `full git history required (shallow clone)` — SPEC-01 AC-9
- [ ] CLI with a sentinel env var: value absent from catalog and stdout; `GITHUB_REPOSITORY` lands in `marketplace.repo` — SPEC-01 UT-9b
- [ ] two runs byte-identical; runs with `LANG=de_DE.UTF-8 TZ=Asia/Tokyo` and `LANG=C TZ=UTC` byte-identical (fixture and real repo) — SPEC-01 NFR-10a, NFR-10b
- [ ] real repo: plugin set = relative-source `plugins[].name` — SPEC-01 AC-6a
- [ ] real repo: per plugin and kind, artifact counts = counts computed from source files — SPEC-01 AC-6b
- [ ] real repo: `spec-creator.md` has exactly 3 `preloadedSkills`; `plan-verifier.md` has `maxTurns: 100` — SPEC-01 AC-3
- [ ] real repo: 34c247a gives `added` for spec-driven and `change` for spec-creator — SPEC-01 AC-71
- [ ] real repo: commits before 34c247a under `plugins/spec-creator/` have `plugin: "spec-creator"` — SPEC-01 EC-10
- [ ] real repo: django-reviewer has `reasons: ["shell"]` — SPEC-01 EC-18
- [ ] real-repo `generate()` finishes within the 30 s test timeout (local proxy) — SPEC-01 NFR-4

### U5 — "Site" workflow
| Field | Value |
|---|---|
| Kind | ci |
| Skills | none |
| Module | root |
| Wave | 5 |
| Depends on | U0, U4 |
| Owns (create/modify) | `.github/workflows/site.yml`, `site/test/workflow.test.mjs` |
| Must not touch | `.github/workflows/validate.yml` |
| Consumes | §3.5, §3.6 |
| Produces | workflow "Site" |
| Checks | `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check` |

**Steps**
1. Write `site.yml` per §3.5 and Decision 4 (no deploy, no concurrency, no Pages upload in M1, `:710-713`).
2. `workflow.test.mjs` parses `../.github/workflows/site.yml` with `yaml` and asserts the structure below (inspection made repeatable).

**Acceptance criteria**
- [ ] workflow `name: Site` with exactly jobs `Site: tests` and `Site: build` — SPEC-01 AC-67a
- [ ] `pull_request` and `push` (main) path filters equal the five spec paths — SPEC-01 AC-53a
- [ ] `workflow_dispatch` trigger present — SPEC-01 AC-55a
- [ ] both jobs and the workflow grant only `contents: read` — SPEC-01 NFR-15a
- [ ] both jobs install with `npm ci` in `site/` from the committed lockfile — SPEC-01 NFR-16a
- [ ] audit step per §3.5 prints `::warning::` and cannot fail the job (CI-only proof: NOT VERIFIABLE locally) — SPEC-01 NFR-16b
- [ ] lint and typecheck run as their own steps in "Site: tests" before Vitest — SPEC-01 NFR-18
- [ ] "Site: build" runs the generator on the full checkout (`fetch-depth: 0`); its step time is the NFR-4 CI measure — SPEC-01 NFR-4

## 5. Waves (execution order)
| Wave | Units | Runs | Why this order |
|---|---|---|---|
| 0 | U0 | sequential, by the orchestrator | dependencies, configs, types, `checkCommand` |
| 1 | U1 | sequential | reader, frontmatter, diagnostics are used by everything |
| 2 | U2 | sequential | history + temp-repo helper (U3/U4 tests use it) |
| 3 | U3 | sequential | extraction needs U1; fixtures |
| 4 | U4 | sequential | CLI assembles U1–U3 |
| 5 | U5 | sequential | workflow runs the finished check and generator |

Serialized files: `.claude/sdd.json`, `site/package.json`, `site/package-lock.json` (Wave 0 only); `site/test/helpers/fixture-repo.mjs` (U2 only); `site/test/fixtures/**` (U3 only).

## 6. Test plan
| Module | Tests | Owner (unit) | Needs a running stack? |
|---|---|---|---|
| root | unit: `diagnostics`, `frontmatter`, `safe-fs` (symlink case skipped on Windows without symlink rights) | U1 | no |
| root | unit: `history` on scripted temp git repos (needs `git` on PATH) | U2 | no |
| root | unit: `extract` on temp fixture copies | U3 | no |
| root | unit: `generate` (CLI subprocess), `schema`, `real-repo` (full-history checkout) | U4 | no |
| root | unit: `workflow` structure | U5 | no |
| root | CI: AC-53a (PR run), AC-55a (manual run), NFR-4 (step timing), NFR-16b (vulnerable lockfile run), NFR-18 (red run) | U5 | GitHub Actions — NOT VERIFIABLE locally |

## 7. Verification (orchestrator, after the last wave)
1. `node scripts/validate-marketplace.mjs && node --test 'plugins/**/*.test.mjs' && npm --prefix site run check`.
2. `node site/scripts/generate.mjs --out site/src/generated/catalog.json --repo humen-dev/agent-plugins` exits 0 and prints only `::warning` lines.
3. After push: the PR shows "Site: tests" and "Site: build" checks; one `workflow_dispatch` run (AC-55a).

## 8. Risks
- **Windows checkout:** `.ts` files are not in `.gitattributes`; fixture `.mjs`/`.json`/`.md` stay LF (`.gitattributes:8,10`). Temp repos set `core.autocrlf=false` so the validator's CRLF check (`scripts/validate-marketplace.mjs:70-71`) does not fire on fixtures.
- **Symlink test skipped locally on Windows** (Decision 6): UT-7 symlink proof comes from CI. Verifier must read the CI result.
- **Fixture `*.test.mjs` picked up as tests:** vitest `exclude` covers `test/fixtures/**` (U0 step 4); `node --test 'plugins/**'` never sees `site/`.
- **yaml@2 rejection detection** relies on warning code `TAG_RESOLVE_FAILED` and the `toJS` alias-limit throw (https://eemeli.org/yaml/); a library change shows as a failing UT-10b test.
- **Annotation injection** from hostile diagnostic text: §3.4 escaping, tested in U1.
- **Real-repo tests depend on history** (34c247a): a shallow local clone fails them with the AC-9 message, which is the intended signal.
- **CODEOWNERS** (`CODEOWNERS:6-8`) requires owner review of fixture `hooks/`, `.mcp.json` and `.github/`.

## 9. Out of scope
M2–M5 rows; spec CI steps tests-6/7, build-3..6, workflow concurrency, "Site: deploy" (Decision 4); docs changes (AC-57a..AC-58b); root `.gitignore`, `validate.yml`, the validator.

### Spec follow-ups (owner: user / spec author)
- X-17: name the "expected heading" of "a README without the expected heading" (planned as Decision 9).
- Data model `frontmatter` (`:216`): state what happens to null, map or non-string-list values (planned as Decision 10).
- AC-10 Verify by: note that a skill without a description is a validator error (`scripts/validate-marketplace.mjs:166`), so the skill case is extraction-level only.
- CI/CD (`:874-900`): mark which job steps each milestone adds (M1 subset per Decision 4).
