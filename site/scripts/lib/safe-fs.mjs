import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const MAX_BYTES = 1_048_576;

/** @typedef {import('./diagnostics.mjs').Diagnostics} Diagnostics */

/** @param {string} a @param {string} b */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The only module that reads source files (UT-7, UT-8, UT-9a). Never follows a link.
 * @param {string} root
 * @param {Diagnostics} diag
 */
export function createReader(root, diag) {
  const rootAbs = resolve(root);
  const realRoot = realpathSync(rootAbs);

  /** @param {string} rel */
  const abs = (rel) => resolve(rootAbs, rel);

  /** Programming-error guard (X-14): only .claude-plugin/ and plugins/ may be read. */
  /** @param {string} rel */
  function assertAllowed(rel) {
    const a = abs(rel);
    const ok = ['.claude-plugin', 'plugins'].some((d) => {
      const base = resolve(rootAbs, d);
      return a === base || a.startsWith(base + sep);
    });
    if (!ok) throw new Error(`safe-fs: path outside .claude-plugin/ and plugins/: ${rel}`);
  }

  /** @param {string} rel @param {string} within @returns {string | null} */
  function readText(rel, within) {
    assertAllowed(rel);
    const file = abs(rel);
    let st;
    try {
      st = lstatSync(file);
    } catch {
      return null; // missing file is normal, not a diagnostic
    }
    if (st.isSymbolicLink()) return diag.warn(rel, 'file: symlink, skipped'), null;
    if (!st.isFile()) return null;
    let real;
    let realWithin;
    try {
      real = realpathSync(file);
      realWithin = realpathSync(abs(within));
    } catch {
      return null;
    }
    // A symlinked plugin folder must not move `within` itself outside the repo.
    if (!realWithin.startsWith(realRoot + sep) || !real.startsWith(realWithin + sep)) {
      return diag.warn(rel, 'file: outside the plugin folder, skipped'), null;
    }
    if (st.size > MAX_BYTES) return diag.warn(rel, 'file: larger than 1 MB, skipped'), null;
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(real));
    } catch {
      return diag.warn(rel, 'file: not valid UTF-8, skipped'), null;
    }
  }

  /** @param {string} rel @param {string} within @returns {unknown} */
  function readJson(rel, within) {
    const text = readText(rel, within);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      const reason = String(e instanceof Error ? e.message : e).split('\n')[0];
      return diag.warn(rel, `json: invalid (${reason})`), null;
    }
  }

  /** Recursive; repo-relative paths, sorted. Skips symlinks, node_modules/ and dot-entries (X-14). */
  /** @param {string} relDir @param {string} within @returns {string[]} */
  function list(relDir, within) {
    assertAllowed(relDir);
    assertAllowed(within);
    /** @type {string[]} */
    const out = [];
    /** @param {string} dir */
    const walk = (dir) => {
      let entries;
      try {
        entries = readdirSync(abs(dir), { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const rel = `${dir}/${e.name}`;
        if (e.isSymbolicLink()) diag.warn(rel, 'file: symlink, skipped');
        else if (e.isDirectory()) walk(rel);
        else if (e.isFile()) out.push(rel);
      }
    };
    walk(relDir.replace(/\/+$/, ''));
    return out.sort(cmp);
  }

  return { readText, readJson, list };
}
