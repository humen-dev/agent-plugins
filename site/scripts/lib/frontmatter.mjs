import { isMap, parseDocument } from 'yaml';

/** @typedef {import('../../src/catalog/types.ts').FrontmatterValue} FrontmatterValue */
/** @typedef {import('./diagnostics.mjs').Diagnostics} Diagnostics */

const FENCE = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
const INT = /^[-+]?[0-9]+$/;
const FLOAT = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;

/** Typed like the YAML core schema; quoted values stay strings. @param {string} raw @returns {unknown} */
function scalar(raw) {
  const v = raw.trim();
  const q = /^(["'])([\s\S]*)\1$/.exec(v);
  if (q) return q[2];
  if (v === '' || v === '~' || v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (INT.test(v)) return Number(v);
  if (FLOAT.test(v)) return Number(v);
  return v;
}

/** Line reader (X-16): top-level `key: value`, split at the first `: `. @param {string} block @returns {Record<string, unknown>} */
function readLines(block) {
  const lines = block.split(/\r?\n/);
  /** @type {Record<string, unknown>} */
  const out = {};
  const skip = (/** @type {string} */ l) => l.trim() === '' || l.trimStart().startsWith('#');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (skip(line) || /^\s/.test(line)) continue;
    const m = /^([^:]+?):(?: (.*)|)$/.exec(line);
    if (!m) {
      out[line.trim()] = undefined; // unreadable key; dropped with a warning later
      continue;
    }
    const key = m[1].trim();
    const rest = (m[2] ?? '').trim();
    const block = /^([>|])[+-]?$/.exec(rest);
    if (block || rest === '') {
      const body = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        // a list may sit at column 0; a block scalar may not
        if (!(/^\s/.test(lines[j]) || skip(lines[j]) || (!block && /^-(\s|$)/.test(lines[j])))) break;
        body.push(lines[j]);
      }
      i = j - 1;
      if (block) {
        const real = body.filter((l) => l.trim() !== '');
        const indent = Math.min(...real.map((l) => /^\s*/.exec(l)?.[0].length ?? 0));
        const text = body.map((l) => l.slice(indent).trimEnd());
        out[key] = (block[1] === '|' ? text.join('\n') : foldLines(text)).replace(/\n+$/, '');
      } else {
        const items = body.filter((l) => !skip(l)).map((l) => /^\s*-(?:\s+(.*))?$/.exec(l));
        out[key] = items.length > 0 && items.every(Boolean)
          ? items.map((x) => scalar(x?.[1] ?? ''))
          : null;
      }
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      const inner = rest.slice(1, -1).trim();
      out[key] = inner === '' ? [] : inner.split(',').map(scalar);
    } else {
      out[key] = scalar(rest);
    }
  }
  return out;
}

/** Folded block: single newlines become spaces, blank lines stay newlines (X-3). @param {string[]} lines */
function foldLines(lines) {
  let s = '';
  for (const [i, l] of lines.entries()) {
    if (l === '') s += '\n';
    else s += i > 0 && lines[i - 1] !== '' ? ` ${l}` : l;
  }
  return s;
}

/** Decision 10: only strings, numbers, booleans and string lists survive. @param {unknown} v @returns {FrontmatterValue | undefined} */
function supported(v) {
  if (typeof v === 'string') return v.replace(/\n+$/, '');
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return /** @type {string[]} */ (v);
  return undefined;
}

/**
 * @param {string} text
 * @param {string} path
 * @param {Diagnostics} diag
 * @returns {{ data: Record<string, FrontmatterValue>, body: string }}
 */
export function parseFrontmatter(text, path, diag) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // drop BOM
  const m = FENCE.exec(src);
  if (!m) return { data: {}, body: text };
  const block = m[1] ?? '';
  const body = src.slice(m[0].length);

  /** @type {Record<string, unknown>} */
  let raw;
  const doc = parseDocument(block, { schema: 'core', uniqueKeys: true });
  const rejected = doc.warnings.concat(doc.errors).find((e) => e.code === 'TAG_RESOLVE_FAILED');
  /** @type {string | null} */
  let reason = rejected ? rejected.message : null;
  /** @type {Record<string, unknown> | null} */
  let parsed = null;
  if (!reason && doc.errors.length === 0 && isMap(doc.contents)) {
    try {
      parsed = doc.toJS({ maxAliasCount: 100 });
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }
  }
  if (reason !== null) {
    diag.warn(path, `frontmatter: YAML rejected (${reason.split('\n')[0].slice(0, 200)}); read line by line`);
  }
  raw = parsed ?? readLines(block);

  /** @type {Record<string, FrontmatterValue>} */
  const data = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) {
      diag.warn(path, `frontmatter: key "${k}" could not be read`);
      continue;
    }
    const s = supported(v);
    if (s === undefined) diag.warn(path, `frontmatter: key "${k}" has an unsupported value`);
    else data[k] = s;
  }
  return { data, body };
}
