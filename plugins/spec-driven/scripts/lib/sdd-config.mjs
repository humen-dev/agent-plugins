/**
 * Loader for the project's optional `.claude/sdd.json` — the one place where a
 * project tells the spec-driven plugin where its specs live, which template
 * to copy, which modules it has and which agent docs to read. Used by the
 * guard hook (`scripts/write-guard.mjs`).
 *
 * Every key is optional; a missing file means "all defaults". Keys this plugin
 * does not read are ignored, so the file can be shared with other tools. A file
 * that exists but cannot be parsed, or a known key with a wrong type, is an
 * error — the guard fails closed on it.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const CONFIG_FILE = '.claude/sdd.json';

export const DEFAULTS = Object.freeze({
  specsDir: 'specs/',
  specTemplate: null,
  modules: [{ name: 'root', path: '.', specsDir: null }],
  agentDocs: ['AGENTS.md', 'CLAUDE.md'],
});

/**
 * Project-relative directory in canonical form: forward slashes, no leading
 * `./`, no trailing `/`; the project root itself is `''`. Returns `null` for an
 * absolute path or one that escapes the project root (`..`).
 */
export function normalizeDir(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim().replaceAll('\\', '/');
  if (!raw) return null;
  if (path.posix.isAbsolute(raw) || /^[A-Za-z]:/.test(raw)) return null;
  const norm = path.posix.normalize(raw).replace(/\/+$/, '');
  if (norm === '.' || norm === '') return '';
  if (norm === '..' || norm.startsWith('../')) return null;
  return norm.replace(/^\.\//, '');
}

const isStr = (v) => typeof v === 'string' && v.trim() !== '';

function validate(cfg) {
  const errors = [];
  if (cfg.specsDir !== undefined && normalizeDir(cfg.specsDir) === null) errors.push('"specsDir" must be a project-relative directory');
  if (cfg.specTemplate !== undefined && cfg.specTemplate !== null && !isStr(cfg.specTemplate)) errors.push('"specTemplate" must be a string or null');
  if (cfg.agentDocs !== undefined && !(Array.isArray(cfg.agentDocs) && cfg.agentDocs.every(isStr))) {
    errors.push('"agentDocs" must be an array of file names');
  }
  if (cfg.modules !== undefined) {
    if (!Array.isArray(cfg.modules) || !cfg.modules.length) errors.push('"modules" must be a non-empty array');
    else {
      cfg.modules.forEach((m, i) => {
        if (!m || typeof m !== 'object') { errors.push(`modules[${i}] must be an object`); return; }
        if (!isStr(m.name)) errors.push(`modules[${i}].name must be a string`);
        if (normalizeDir(m.path ?? '.') === null) errors.push(`modules[${i}].path must be a project-relative directory`);
        if (m.specsDir !== undefined && m.specsDir !== null && normalizeDir(m.specsDir) === null) {
          errors.push(`modules[${i}].specsDir must be a project-relative directory or null`);
        }
      });
    }
  }
  return errors;
}

/**
 * Load `<root>/.claude/sdd.json` merged over the defaults.
 * Returns `{ config, file, error }`: `file` is the path read (or `null` when the
 * file is absent), `error` a one-line reason when it is malformed (then `config`
 * holds the defaults).
 */
export function loadConfig(root) {
  const file = path.join(root, CONFIG_FILE);
  if (!existsSync(file)) return { config: structuredClone(DEFAULTS), file: null, error: null };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    return { config: structuredClone(DEFAULTS), file, error: `${CONFIG_FILE} is not valid JSON (${e.message})` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { config: structuredClone(DEFAULTS), file, error: `${CONFIG_FILE} must hold a JSON object` };
  }
  const errors = validate(parsed);
  if (errors.length) return { config: structuredClone(DEFAULTS), file, error: `${CONFIG_FILE}: ${errors.join('; ')}` };
  const config = { ...structuredClone(DEFAULTS), ...parsed };
  config.modules = config.modules.map((m) => ({ name: m.name, path: m.path ?? '.', specsDir: m.specsDir ?? null }));
  return { config, file, error: null };
}

/** Every directory spec-creator may write into: `specsDir` plus each module's `specsDir` (all project-relative). */
export function specDirs(config) {
  const dirs = [normalizeDir(config.specsDir), ...config.modules.map((m) => (m.specsDir == null ? null : normalizeDir(m.specsDir)))];
  return [...new Set(dirs.filter((d) => d !== null))];
}
