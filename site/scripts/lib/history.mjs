// Git history for the catalog (X-13, Decision 8). Plain git, one `log` and one `cat-file --batch`.
import { execFileSync } from 'node:child_process';
import { GeneratorError } from './errors.mjs';

/** @typedef {import('../../src/catalog/types.ts').Change} Change */

const MARKETPLACE = '.claude-plugin/marketplace.json';

/** @param {string} root @param {string[]} args @param {string | Buffer} [input] */
function git(root, args, input) {
  return execFileSync('git', ['-c', 'core.quotepath=off', ...args], {
    cwd: root,
    env: { ...process.env, LC_ALL: 'C' },
    input,
    maxBuffer: 1 << 30,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/** @param {string} root */
export function assertFullHistory(root) {
  if (git(root, ['rev-parse', '--is-shallow-repository']).toString().trim() === 'true') {
    throw new GeneratorError('full git history required (shallow clone)');
  }
}

/** @param {string} root @returns {{ commit: string, commitDate: string }} */
export function readHead(root) {
  const [commit, commitDate] = git(root, ['log', '-1', '--format=%H%x02%cI']).toString().trim().split('\x02');
  return { commit, commitDate };
}

/** @typedef {{ sha: string, ct: number }} Keyed */
/** @param {Keyed} a @param {Keyed} b */
const shaAsc = (a, b) => (a.sha < b.sha ? -1 : a.sha > b.sha ? 1 : 0);
/** newest first by epoch, ties by sha ascending (code unit) @param {Keyed} a @param {Keyed} b */
const byNewest = (a, b) => b.ct - a.ct || shaAsc(a, b);
/** @param {Keyed} a @param {Keyed} b */
const byOldest = (a, b) => a.ct - b.ct || shaAsc(a, b);

/** @param {string} root @returns {{ sha: string, ct: number, date: string, subject: string, paths: string[] }[]} */
function logCommits(root) {
  const out = git(root, ['log', '--no-merges', '--no-renames', '-z', '--name-only', '--format=%x01%H%x02%ct%x02%cI%x02%s']).toString();
  const commits = [];
  for (const chunk of out.split('\x01').slice(1)) {
    const end = chunk.search(/[\n\0]/);
    const head = (end < 0 ? chunk : chunk.slice(0, end)).split('\x02');
    const paths = end < 0 ? [] : chunk.slice(end + 1).split('\0').map((p) => p.replace(/^\n/, '')).filter(Boolean);
    commits.push({ sha: head[0], ct: Number(head[1]), date: head[2], subject: head.slice(3).join('\x02'), paths });
  }
  return commits;
}

/** One `git cat-file --batch` for many `<rev>:<path>` specs. Missing object → null.
 * @param {string} root @param {string[]} specs @returns {(string | null)[]} */
function catBatch(root, specs) {
  if (specs.length === 0) return [];
  const buf = git(root, ['cat-file', '--batch'], specs.join('\n') + '\n');
  const res = [];
  let pos = 0;
  for (let i = 0; i < specs.length; i++) {
    const nl = buf.indexOf(0x0a, pos);
    const line = buf.subarray(pos, nl).toString();
    pos = nl + 1;
    if (line.endsWith(' missing')) {
      res.push(null);
      continue;
    }
    const size = Number(line.slice(line.lastIndexOf(' ') + 1));
    res.push(buf.subarray(pos, pos + size).toString('utf8'));
    pos += size + 1;
  }
  return res;
}

/** Historic files are not a current source: unparsable JSON counts as absent.
 * @param {string | null} text @returns {any} */
function parseJson(text) {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** @param {any} json @returns {string | null} */
const versionOf = (json) => (json && typeof json.version === 'string' ? json.version : null);

/** @param {string} root @param {string} repoUrl */
export function readHistory(root, repoUrl) {
  const commits = logCommits(root); // git order is not trusted: sort ourselves
  commits.sort(byNewest);

  /** @type {Map<string, string>} */
  const updated = new Map();
  /** candidate plugins per commit */
  /** @type {Map<string, Set<string>>} */
  const cands = new Map(commits.map((c) => [c.sha, new Set()]));
  /** @param {string} sha @returns {Set<string>} */
  const candsOf = (sha) => cands.get(sha) ?? new Set();
  for (const c of commits) {
    for (const p of c.paths) {
      const m = /^plugins\/([^/]+)\//.exec(p);
      if (!m) continue;
      candsOf(c.sha).add(m[1]);
      if (!updated.has(m[1])) updated.set(m[1], c.date);
    }
  }

  // (2) first commit (oldest first, ties sha asc) where a name is in marketplace.json
  const mpCommits = commits.filter((c) => c.paths.includes(MARKETPLACE)).reverse();
  const mpTexts = catBatch(root, mpCommits.map((c) => `${c.sha}:${MARKETPLACE}`));
  /** @type {Map<string, string>} plugin name → sha that added it */
  const addedBy = new Map();
  const order = mpCommits.map((c, i) => ({ c, text: mpTexts[i] })).sort((a, b) => byOldest(a.c, b.c));
  for (const { c, text } of order) {
    const list = parseJson(text)?.plugins;
    if (!Array.isArray(list)) continue;
    for (const pl of list) {
      if (typeof pl?.name !== 'string' || addedBy.has(pl.name)) continue;
      addedBy.set(pl.name, c.sha);
      candsOf(c.sha).add(pl.name);
    }
  }

  const pairs = [];
  for (const c of commits) for (const p of [...candsOf(c.sha)].sort()) pairs.push({ c, p });
  const specs = pairs.flatMap(({ c, p }) => {
    const f = `plugins/${p}/.claude-plugin/plugin.json`;
    return [`${c.sha}:${f}`, `${c.sha}^:${f}`];
  });
  const texts = catBatch(root, specs);

  /** @type {Change[]} */
  const changes = pairs.map(({ c, p }, i) => {
    const now = parseJson(texts[2 * i]);
    const before = parseJson(texts[2 * i + 1]);
    const to = versionOf(now);
    const from = versionOf(before);
    /** @type {Change['type']} */
    let type = 'change';
    /** @type {Change['version']} */
    let version = null;
    if (addedBy.get(p) === c.sha) {
      type = 'added';
      version = to === null ? null : { from: null, to };
    } else if (to !== null && from !== null && to !== from) {
      type = 'version';
      version = { from, to };
    }
    return { commit: c.sha, date: c.date, subject: c.subject, plugin: p, type, version, url: `${repoUrl}/commit/${c.sha}` };
  });
  return { changes, updated };
}
