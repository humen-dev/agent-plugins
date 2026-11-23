// Catalog generator: in-process API (generate) + thin CLI (§3.2).
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDiagnostics, formatWarning } from './lib/diagnostics.mjs';
import { GeneratorError } from './lib/errors.mjs';
import { assertFullHistory, readHead, readHistory } from './lib/history.mjs';
import { extractCatalogParts } from './lib/plugin.mjs';
import { createReader } from './lib/safe-fs.mjs';
import { runValidator } from './lib/validator.mjs';

export { GeneratorError } from './lib/errors.mjs';

/** @typedef {import('../src/catalog/types.ts').Catalog} Catalog */
/** @typedef {import('../src/catalog/types.ts').Kind} Kind */

const MARKETPLACE = '.claude-plugin/marketplace.json';
/** @type {Kind[]} */
const KINDS = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const USAGE = 'usage: node site/scripts/generate.mjs --out <file> [--repo <owner/name>] [--root <dir>]';

/** @param {string} a @param {string} b */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * @param {{ root: string, repo: string }} opts
 * @returns {Promise<{ catalog: Catalog, json: string }>}
 */
export async function generate({ root, repo }) {
  const v = runValidator(root);
  if (!v.ok) throw new GeneratorError(v.output);
  assertFullHistory(root);

  const diag = createDiagnostics();
  for (const w of v.warnings) diag.warn(MARKETPLACE, w);
  const repoUrl = `https://github.com/${repo}`;
  const { commit, commitDate } = readHead(root);
  const reader = createReader(root, diag);
  const rawMp = /** @type {any} */ (reader.readJson(MARKETPLACE, '.claude-plugin'));
  const parts = extractCatalogParts(reader, diag, {
    root, repoUrl, commit, marketplaceName: typeof rawMp?.name === 'string' ? rawMp.name : '',
  });

  const { changes, updated } = readHistory(root, repoUrl);
  const plugins = parts.plugins.map((p) => {
    const { thirdPartyNotices, artifactIds, runs, ...head } = p;
    return {
      ...head,
      thirdPartyNotices,
      updated: updated.get(p.path.slice('plugins/'.length)) ?? null,
      artifactIds,
      runs,
      recentChanges: changes.filter((c) => c.plugin === p.name).slice(0, 10),
    };
  });

  /** @type {Catalog} */
  const catalog = {
    marketplace: /** @type {Catalog['marketplace']} */ (parts.marketplace),
    build: { commit, commitDate },
    categories: [...new Set(plugins.flatMap((p) => (p.category === null ? [] : [p.category])))].sort(cmp),
    kinds: KINDS.filter((k) => (k === 'plugin' ? plugins.length > 0 : parts.artifacts.some((a) => a.kind === k))),
    plugins,
    artifacts: parts.artifacts,
    changes: changes.slice(0, 100),
    diagnostics: diag.list(),
  };
  return { catalog, json: `${JSON.stringify(catalog, null, 2)}\n` };
}

/** @param {string[]} argv @returns {Record<string, string> | null} null = usage error */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    const val = argv[i + 1];
    if (!['--out', '--repo', '--root'].includes(k) || val === undefined) return null;
    out[k.slice(2)] = val;
  }
  return out.out ? out : null;
}

/** @param {string[]} argv @returns {Promise<number>} exit code */
async function main(argv) {
  const args = parseArgs(argv);
  const repo = args?.repo ?? process.env.GITHUB_REPOSITORY;
  if (!args || !repo || !REPO_RE.test(repo)) {
    process.stderr.write(`${USAGE}\n(--repo or GITHUB_REPOSITORY must be <owner>/<name>)\n`);
    return 2;
  }
  const out = resolve(args.out);
  rmSync(out, { force: true }); // a failed run must leave no file (Decision 7)
  try {
    const root = resolve(args.root ?? resolve(import.meta.dirname, '../..'));
    const { catalog, json } = await generate({ root, repo });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(`${out}.tmp`, json);
    renameSync(`${out}.tmp`, out);
    for (const d of catalog.diagnostics) process.stdout.write(`${formatWarning(d)}\n`);
    return 0;
  } catch (e) {
    rmSync(`${out}.tmp`, { force: true });
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return e instanceof GeneratorError ? e.exitCode : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
