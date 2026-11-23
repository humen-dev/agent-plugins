// Per-kind artifact extractors (X-3..X-8, X-15). Every file read goes through the safe reader.
import { posix } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

/** @typedef {import('./diagnostics.mjs').Diagnostics} Diagnostics */
/** @typedef {ReturnType<import('./safe-fs.mjs').createReader>} Reader */
/**
 * Per-plugin context shared by the extractors.
 * @typedef {{
 *   reader: Reader, diag: Diagnostics, plugin: string, path: string, files: string[],
 *   repoUrl: string, commit: string, readmePath: string,
 *   sections: { heading: string, text: string }[], seen: Map<string, string>,
 * }} Ctx
 */

/** @param {unknown} v @returns {v is Record<string, any>} */
export const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** @param {unknown} v @returns {string[] | null} YAML list or comma-separated string, trimmed (X-4). */
export function toList(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return null;
}

/** @param {string[]} lines @returns {{ level: number, text: string, line: number }[]} ATX headings outside code fences. */
export function scanHeadings(lines) {
  /** @type {{ level: number, text: string, line: number }[]} */
  const out = [];
  /** @type {string | null} */
  let fence = null;
  lines.forEach((l, line) => {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(l);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      return;
    }
    if (fence) return;
    const m = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(l);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line });
  });
  return out;
}

/** @param {string} text @returns {string[]} H1-H3 text in order */
export const headingsOf = (text) =>
  scanHeadings(text.split(/\r?\n/)).filter((h) => h.level <= 3).map((h) => h.text);

/** README `## What it runs` → each `### heading` and its text, verbatim (X-10). @param {string} readme */
export function whatItRuns(readme) {
  const lines = readme.split(/\r?\n/);
  const hs = scanHeadings(lines);
  const start = hs.findIndex((h) => h.level === 2 && h.text === 'What it runs');
  if (start < 0) return [];
  /** @type {{ heading: string, text: string }[]} */
  const out = [];
  for (let i = start + 1; i < hs.length && hs[i].level > 2; i++) {
    if (hs[i].level !== 3) continue;
    const end = hs.slice(i + 1).find((h) => h.level <= 3)?.line ?? lines.length;
    out.push({ heading: hs[i].text, text: lines.slice(hs[i].line + 1, end).join('\n').trim() });
  }
  return out;
}

/** @param {string} text @returns {string | null} */
const firstParagraph = (text) => {
  const p = text.split(/\n[ \t]*\n/).map((s) => s.trim()).find(Boolean);
  return p ? p.split('\n').map((l) => l.trim()).join(' ') : null;
};

/** @param {Ctx} c @param {string} p */
const blobUrl = (c, p) => `${c.repoUrl}/blob/${c.commit}/${p}`;

/** @param {Ctx} c @param {string} rel @returns {{ data: Record<string, import('../../src/catalog/types.ts').FrontmatterValue>, body: string } | null} */
function readMd(c, rel) {
  const text = c.reader.readText(rel, c.path);
  return text === null ? null : parseFrontmatter(text, rel, c.diag);
}

/** Same kind + name within a plugin: first by path wins (X-15). @param {Ctx} c @param {any} art @param {any[]} out */
function add(c, art, out) {
  const key = `${art.kind}\0${art.name}`;
  const first = c.seen.get(key);
  if (first !== undefined) {
    c.diag.warn(art.path, `duplicate: ${art.kind} "${art.name}" already defined by ${first}`);
    return;
  }
  c.seen.set(key, art.path);
  out.push(art);
}

/** @param {Ctx} c @param {string} desc @param {string} path */
function needDescription(c, desc, path) {
  if (desc === '') c.diag.warn(path, 'description: missing');
  return desc;
}

/**
 * Assemble the shared ArtifactBase fields in model order (X-15).
 * @param {Ctx} c
 * @param {{ kind: string, name: string, description: string, path: string, invokeAs: string | null,
 *   body?: string | null, files?: { path: string, title: string, body: string }[], fm?: Record<string, any> }} a
 */
function base(c, a) {
  const files = (a.files ?? []).map((f) => ({ path: f.path, title: f.title, body: { path: f.path, source: f.body } }));
  return {
    id: `${a.kind}:${c.plugin}/${a.name}`,
    kind: a.kind,
    name: a.name,
    plugin: c.plugin,
    description: a.description,
    path: a.path,
    sourceUrl: blobUrl(c, a.path),
    invokeAs: a.invokeAs,
    headings: [a.body ?? '', ...files.map((f) => f.body.source)].flatMap(headingsOf),
    body: a.body == null ? null : { path: a.path, source: a.body },
    files,
    frontmatter: a.fm ?? {},
  };
}

/** @param {Record<string, any>} fm @param {string} k @returns {string | null} */
const fmStr = (fm, k) => (typeof fm[k] === 'string' ? fm[k] : null);

/** @param {Ctx} c @returns {any[]} */
export function extractSkills(c) {
  const prefix = `${c.path}/skills/`;
  /** @type {Map<string, string[]>} */
  const dirs = new Map();
  for (const f of c.files) {
    const rest = f.slice(prefix.length);
    if (!f.startsWith(prefix) || !f.endsWith('.md') || !rest.includes('/') || /(^|\/)(evals|templates)\//.test(rest)) continue;
    const dir = rest.split('/')[0];
    dirs.set(dir, [...(dirs.get(dir) ?? []), f]);
  }
  /** @type {any[]} */
  const out = [];
  for (const [dir, paths] of dirs) {
    const main = `${prefix}${dir}/SKILL.md`;
    if (!paths.includes(main)) continue;
    const md = readMd(c, main);
    if (!md) continue;
    const { data: fm, body } = md;
    const name = fmStr(fm, 'name') || dir;
    const files = [];
    for (const p of paths.filter((x) => x !== main)) {
      const text = c.reader.readText(p, c.path);
      if (text === null) continue;
      const h1 = scanHeadings(text.split(/\r?\n/)).find((h) => h.level === 1);
      files.push({ path: p, title: h1?.text ?? posix.basename(p), body: text });
    }
    add(c, {
      ...base(c, {
        kind: 'skill', name, path: main, invokeAs: `/${c.plugin}:${name}`, body, files, fm,
        description: needDescription(c, fmStr(fm, 'description') ?? '', main),
      }),
      argumentHint: fmStr(fm, 'argument-hint'),
      userInvokedOnly: fm['disable-model-invocation'] === true,
      allowedTools: toList(fm['allowed-tools']),
      model: fmStr(fm, 'model'),
    }, out);
  }
  return out;
}

/** @param {Ctx} c @returns {any[]} */
export function extractAgents(c) {
  const prefix = `${c.path}/agents/`;
  /** @type {any[]} */
  const out = [];
  for (const p of c.files) {
    const rest = p.slice(prefix.length);
    if (!p.startsWith(prefix) || rest.includes('/') || !rest.endsWith('.md')) continue;
    const md = readMd(c, p);
    if (!md) continue;
    const { data: fm, body } = md;
    const name = fmStr(fm, 'name') || rest.slice(0, -3);
    add(c, {
      ...base(c, {
        kind: 'agent', name, path: p, invokeAs: `${c.plugin}:${name}`, body, fm,
        description: needDescription(c, fmStr(fm, 'description') ?? '', p),
      }),
      model: fmStr(fm, 'model'),
      tools: 'tools' in fm ? toList(fm.tools) : null,
      disallowedTools: toList(fm.disallowedTools ?? fm['disallowed-tools']) ?? [],
      preloadedSkills: toList(fm.skills) ?? [],
      maxTurns: typeof fm.maxTurns === 'number' ? fm.maxTurns : null,
    }, out);
  }
  return out;
}

/** @param {Ctx} c @returns {any[]} */
export function extractCommands(c) {
  const prefix = `${c.path}/commands/`;
  /** @type {any[]} */
  const out = [];
  for (const p of c.files) {
    if (!p.startsWith(prefix) || !p.endsWith('.md')) continue;
    const rest = p.slice(prefix.length);
    if (/(^|\/)(evals|templates)\//.test(rest)) continue;
    const md = readMd(c, p);
    if (!md) continue;
    const { data: fm, body } = md;
    const name = rest.slice(0, -3).replaceAll('/', ':');
    const firstLine = body.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
    add(c, {
      ...base(c, {
        kind: 'command', name, path: p, invokeAs: `/${c.plugin}:${name}`, body, fm,
        description: needDescription(c, fmStr(fm, 'description') ?? firstLine, p),
      }),
      argumentHint: fmStr(fm, 'argument-hint'),
      allowedTools: toList(fm['allowed-tools']),
      model: fmStr(fm, 'model'),
    }, out);
  }
  return out;
}

/** README description for a hook or MCP server; warns when the heading is missing (Decision 9). @param {Ctx} c @param {string} name */
function readmeDescription(c, name) {
  const s = c.sections.find((x) => x.heading === name);
  if (!s) c.diag.warn(c.readmePath, `readme: no "### ${name}" under "## What it runs"`);
  return s ? firstParagraph(s.text) : null;
}

/**
 * One Hook per inner hook object (X-7).
 * @param {Ctx} c
 * @param {Record<string, any>} obj hooks.json content, or the inline `hooks` object of plugin.json
 * @param {string} definedIn
 * @param {Map<string, number>} names per-plugin name counter for the -2, -3 suffixes
 * @returns {any[]}
 */
export function extractHooks(c, obj, definedIn, names) {
  const wrapped = isObj(obj.hooks);
  const events = wrapped ? obj.hooks : obj;
  const top = typeof obj.description === 'string' ? obj.description : '';
  /** @type {any[]} */
  const out = [];
  const unknown = () => c.diag.warn(definedIn, 'hook: unknown shape');
  for (const [event, groups] of Object.entries(events)) {
    if (!wrapped && event === 'description') continue;
    if (!Array.isArray(groups)) {
      unknown();
      continue;
    }
    let n = 0;
    for (const g of groups) {
      if (!isObj(g) || !Array.isArray(g.hooks)) {
        unknown();
        continue;
      }
      for (const h of g.hooks) {
        n++;
        if (!isObj(h) || typeof h.type !== 'string' || (h.type === 'command' && typeof h.command !== 'string')) {
          unknown();
          continue;
        }
        const command = typeof h.command === 'string' ? h.command : null;
        const stripped = (command ?? '').replaceAll('${CLAUDE_PLUGIN_ROOT}/', '');
        // shortcut: plain substring match, not a shell parse; upgrade if a path prefix produces false hits
        const refs = c.files
          .map((f) => ({ f, rel: f.slice(c.path.length + 1) }))
          .map((r) => ({ ...r, at: stripped.indexOf(r.rel) }))
          .filter((r) => r.at >= 0);
        const first = [...refs].sort((a, b) => a.at - b.at || b.rel.length - a.rel.length)[0];
        const base0 = first ? posix.basename(first.rel, posix.extname(first.rel)) : `${event}-${n}`;
        const seen = (names.get(base0) ?? 0) + 1;
        names.set(base0, seen);
        const name = seen === 1 ? base0 : `${base0}-${seen}`;
        const description = readmeDescription(c, name) ?? top;
        add(c, {
          ...base(c, { kind: 'hook', name, description, path: definedIn, invokeAs: null }),
          event,
          matcher: typeof g.matcher === 'string' ? g.matcher : null,
          type: h.type,
          command,
          timeout: typeof h.timeout === 'number' ? h.timeout : null,
          scripts: refs.map((r) => r.f).sort(),
          definedIn,
        }, out);
      }
    }
  }
  return out;
}

/**
 * One McpServer per key (X-8).
 * @param {Ctx} c
 * @param {Record<string, any>} obj `.mcp.json` content (wrapped or bare) or the inline `mcpServers` object
 * @param {string} definedIn
 * @returns {any[]}
 */
export function extractMcp(c, obj, definedIn) {
  const servers = isObj(obj.mcpServers) ? obj.mcpServers : obj;
  /** @type {any[]} */
  const out = [];
  for (const [name, cfg] of Object.entries(servers)) {
    if (!isObj(cfg)) {
      c.diag.warn(definedIn, 'mcp: unknown shape');
      continue;
    }
    const command = typeof cfg.command === 'string' ? cfg.command : null;
    const url = typeof cfg.url === 'string' ? cfg.url : null;
    const transport = typeof cfg.type === 'string' ? cfg.type : command !== null ? 'stdio' : null;
    if (transport === null && url !== null) c.diag.warn(definedIn, 'mcp: url only, transport unknown');
    add(c, {
      ...base(c, { kind: 'mcp', name, description: readmeDescription(c, name) ?? '', path: definedIn, invokeAs: null }),
      transport,
      command,
      args: Array.isArray(cfg.args) ? cfg.args.filter((/** @type {unknown} */ a) => typeof a === 'string') : [],
      url,
      envVars: isObj(cfg.env) ? Object.keys(cfg.env) : [], // names only, never values (AC-11)
      definedIn,
    }, out);
  }
  return out;
}
