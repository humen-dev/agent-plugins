// Marketplace + plugin extraction (X-1, X-2, X-9..X-12, X-15, X-18).
import { posix } from 'node:path';
import {
  extractAgents, extractCommands, extractHooks, extractMcp, extractSkills, isObj, scanHeadings, whatItRuns,
} from './artifacts.mjs';

/** @typedef {import('../../src/catalog/types.ts').Plugin} Plugin */
/** @typedef {import('../../src/catalog/types.ts').Artifact} Artifact */
/** @typedef {import('./artifacts.mjs').Ctx} Ctx */

const MARKETPLACE = '.claude-plugin/marketplace.json';
const SCRIPT_EXT = new Set(['.mjs', '.js', '.cjs', '.ts', '.sh', '.bash', '.py', '.ps1']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

/** @param {string} a @param {string} b */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** @param {unknown} v @returns {string | null} */
const str = (v) => (typeof v === 'string' ? v : null);

/** Only http(s) links survive (UT-2b). @param {unknown} v @returns {string | null} */
function httpUrl(v) {
  if (typeof v !== 'string') return null;
  try {
    const { protocol } = new URL(v);
    return protocol === 'http:' || protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

/** X-1: a relative source inside plugins/. @param {unknown} src @returns {string | null} repo-relative folder */
function relSource(src) {
  if (typeof src !== 'string' || !src.startsWith('./') || src.includes('\\')) return null;
  const p = posix.normalize(src.slice(2)).replace(/\/+$/, '');
  return p.startsWith('plugins/') && !p.split('/').includes('..') ? p : null;
}

/** @param {unknown} a @returns {{ name: string, url: string | null } | null} */
function person(a) {
  if (typeof a === 'string') return { name: a, url: null };
  return isObj(a) && typeof a.name === 'string' ? { name: a.name, url: httpUrl(a.url) } : null; // e-mail never copied
}

/** X-9. @param {string} md @param {string} fallback */
function summarize(md, fallback) {
  const lines = md.split(/\r?\n/);
  const h1 = scanHeadings(lines).find((h) => h.level === 1);
  if (!h1) return fallback;
  /** @type {string[]} */
  let cur = [];
  /** @type {string[][]} */
  const blocks = [];
  let fence = false;
  for (const l of lines.slice(h1.line + 1)) {
    if (/^ {0,3}(`{3,}|~{3,})/.test(l)) {
      fence = !fence;
      cur = [];
      continue;
    }
    if (fence) continue;
    if (l.trim() === '') {
      if (cur.length) blocks.push(cur);
      cur = [];
    } else cur.push(l.trim());
  }
  if (cur.length) blocks.push(cur);
  const para = blocks.find((b) => !/^(\||[-*+]\s|\d+[.)]\s|<|#|---|\*\*\*)/.test(b[0]));
  if (!para) return fallback;
  const text = para.join(' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '') // unclosed or nested tags must not leave a tag start behind
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text === '') return fallback;
  if (text.length <= 300) return text;
  const cut = text.slice(0, 299);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 0 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** @param {string[] | null} tools */
const givesShell = (tools) => tools?.some((t) => SHELL_TOOLS.has(t.split('(')[0].trim())) ?? false;

/**
 * @param {Ctx['reader']} reader
 * @param {import('./diagnostics.mjs').Diagnostics} diag
 * @param {{ root: string, repoUrl: string, commit: string, marketplaceName: string }} ctx
 * @returns {{ marketplace: unknown, plugins: Omit<Plugin, 'updated' | 'recentChanges'>[], artifacts: Artifact[] }}
 */
export function extractCatalogParts(reader, diag, ctx) {
  const raw = reader.readJson(MARKETPLACE, '.claude-plugin');
  const mp = isObj(raw) ? raw : {};
  const entries = (Array.isArray(mp.plugins) ? mp.plugins : []).filter(isObj);

  /** @type {{ entry: Record<string, any>, path: string }[]} */
  const accepted = [];
  for (const entry of entries) {
    const path = relSource(entry.source);
    if (typeof entry.name !== 'string') continue; // the validator already failed on it
    if (path === null) diag.warn(MARKETPLACE, `source: not a relative path, skipped (${entry.name})`);
    else accepted.push({ entry, path });
  }
  accepted.sort((a, b) => cmp(a.entry.name, b.entry.name));
  const inCatalog = new Set(accepted.map((a) => a.entry.name));

  const repo = ctx.repoUrl.replace(/^https:\/\/github\.com\//, '');
  const marketplace = {
    name: str(mp.name) ?? ctx.marketplaceName,
    description: str(mp.description) ?? '',
    version: isObj(mp.metadata) ? str(mp.metadata.version) : null,
    owner: isObj(mp.owner) ? (str(mp.owner.name) ?? '') : '',
    repo,
    repoUrl: ctx.repoUrl,
    addCommand: `claude plugin marketplace add ${repo}`,
  };

  /** @type {any[]} */
  const plugins = [];
  /** @type {any[]} */
  const artifacts = [];
  for (const { entry, path } of accepted) {
    const name = entry.name;
    const manifestPath = `${path}/.claude-plugin/plugin.json`;
    const rawManifest = reader.readJson(manifestPath, path);
    const pj = isObj(rawManifest) ? rawManifest : {};
    const readmePath = `${path}/README.md`;
    const readme = reader.readText(readmePath, path);
    const notices = reader.readText(`${path}/THIRD_PARTY_NOTICES.md`, path);
    const md = (/** @type {string} */ p, /** @type {string | null} */ s) => (s === null ? null : { path: p, source: s });

    /** @type {Ctx} */
    const c = {
      reader, diag, plugin: name, path, files: reader.list(path, path), repoUrl: ctx.repoUrl, commit: ctx.commit,
      readmePath, sections: readme === null ? [] : whatItRuns(readme), seen: new Map(),
    };

    const mine = [...extractSkills(c), ...extractAgents(c), ...extractCommands(c)];

    // Hooks and MCP servers come from the default file and from plugin.json (inline object or path).
    /** @param {unknown} v @returns {unknown[]} */
    const asList = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
    /** @param {string} ref @returns {string | null} */
    const resolveRef = (ref) => {
      const p = posix.normalize(ref.replace(/^\.\//, ''));
      if (ref.includes('\\') || p.startsWith('..') || posix.isAbsolute(p)) {
        diag.warn(manifestPath, 'file: outside the plugin folder, skipped');
        return null;
      }
      return `${path}/${p}`;
    };
    /** @param {string} def @param {unknown} fromManifest @param {(o: Record<string, any>, definedIn: string) => any[]} run */
    const sources = (def, fromManifest, run) => {
      const done = new Set();
      /** @type {{ rel: string, obj: unknown }[]} */
      const jobs = [{ rel: `${path}/${def}`, obj: undefined }];
      for (const v of asList(fromManifest)) {
        if (typeof v === 'string') {
          const rel = resolveRef(v);
          if (rel) jobs.push({ rel, obj: undefined });
        } else if (isObj(v)) jobs.push({ rel: manifestPath, obj: v });
      }
      for (const j of jobs) {
        const content = j.obj ?? (done.has(j.rel) ? null : reader.readJson(j.rel, path));
        if (j.obj === undefined) done.add(j.rel);
        if (isObj(content)) mine.push(...run(content, j.rel));
      }
    };
    const names = new Map();
    sources('hooks/hooks.json', pj.hooks, (o, rel) => extractHooks(c, o, rel, names));
    sources('.mcp.json', pj.mcpServers, (o, rel) => extractMcp(c, o, rel));

    mine.sort((a, b) => cmp(a.id, b.id));
    artifacts.push(...mine);

    const byKind = (/** @type {string} */ k) => mine.filter((a) => a.kind === k);
    const hooks = byKind('hook');
    const scripts = c.files
      .filter((f) => SCRIPT_EXT.has(posix.extname(f)) && !/\.test\.[^/]*$/.test(f) && !f.slice(path.length).includes('/evals/'))
      .map((f) => ({
        path: f,
        sourceUrl: `${ctx.repoUrl}/blob/${ctx.commit}/${f}`,
        referencedBy: hooks.filter((h) => h.scripts.includes(f)).map((h) => h.id),
      }));
    const shellArtifacts = mine
      .filter((a) => (a.kind === 'agent' && (a.tools === null || givesShell(a.tools)))
        || ((a.kind === 'skill' || a.kind === 'command') && givesShell(a.allowedTools)))
      .map((a) => a.id);
    const reasons = /** @type {const} */ ([
      ['hooks', hooks.length > 0], ['mcp', byKind('mcp').length > 0],
      ['scripts', scripts.length > 0], ['shell', shellArtifacts.length > 0],
    ]).filter(([, on]) => on).map(([r]) => r);

    const keywords = Array.isArray(pj.keywords) ? pj.keywords : [];
    const tags = [...new Set([...(Array.isArray(entry.tags) ? entry.tags : []), ...keywords]
      .filter((t) => typeof t === 'string').map((t) => t.toLowerCase()))].sort(cmp);
    const description = str(entry.description) ?? str(pj.description) ?? '';
    const deps = (Array.isArray(pj.dependencies) ? pj.dependencies : []).flatMap((d) => {
      const n = typeof d === 'string' ? d : isObj(d) ? str(d.name) : null;
      return n === null ? [] : [{ name: n, version: isObj(d) ? str(d.version) : null, inCatalog: inCatalog.has(n) }];
    });

    plugins.push({
      id: name,
      name,
      description,
      category: str(entry.category),
      tags,
      version: str(pj.version),
      author: person(pj.author),
      license: str(pj.license),
      homepage: httpUrl(pj.homepage),
      repository: httpUrl(isObj(pj.repository) ? pj.repository.url : pj.repository),
      dependencies: deps,
      installCommand: `claude plugin install ${name}@${marketplace.name}`,
      path,
      sourceUrl: `${ctx.repoUrl}/tree/${ctx.commit}/${path}`,
      summary: readme === null ? description : summarize(readme, description),
      readme: md(readmePath, readme),
      thirdPartyNotices: md(`${path}/THIRD_PARTY_NOTICES.md`, notices),
      artifactIds: mine.map((a) => a.id),
      runs: {
        runsCode: reasons.length > 0,
        reasons,
        shellArtifacts,
        hooks: hooks.map((h) => h.id),
        mcpServers: byKind('mcp').map((m) => m.id),
        scripts,
        agentTools: byKind('agent').map((a) => ({ agent: a.id, model: a.model, tools: a.tools, disallowedTools: a.disallowedTools })),
        whatItRuns: c.sections.map((s) => ({ heading: s.heading, text: { path: readmePath, source: s.text } })),
      },
    });
  }
  artifacts.sort((a, b) => cmp(a.id, b.id));
  return { marketplace, plugins, artifacts };
}
