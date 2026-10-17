#!/usr/bin/env node
// Fails when a plugin changed without a version bump. No dependencies.
//
// For every plugins/<name>/ with at least one file changed between
// `git merge-base <base-ref> HEAD` and HEAD, plugins/<name>/.claude-plugin/plugin.json
// must have a valid SemVer "version" strictly greater than the one at the
// merge-base. Plugins that did not exist at the merge-base pass; deleted
// plugins are skipped.
//
// Usage: node scripts/check-version-bump.mjs <base-ref>   (e.g. origin/main)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const baseRef = process.argv[2];
if (!baseRef) {
  console.error('usage: node scripts/check-version-bump.mjs <base-ref>');
  process.exit(2);
}

const root = resolve(join(import.meta.dirname, '..'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function parse(v) {
  const m = typeof v === 'string' ? SEMVER_RE.exec(v) : null;
  if (!m) return null;
  return { core: [m[1], m[2], m[3]].map(Number), pre: m[4] ? m[4].split('.') : [] };
}

// SemVer precedence: >0 if a > b, <0 if a < b, 0 if equal (build metadata ignored).
function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn && Number(x) !== Number(y)) return Number(x) - Number(y);
    if (xn !== yn) return xn ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

let base;
try {
  base = git('merge-base', baseRef, 'HEAD');
} catch {
  console.error(`error: cannot find merge-base of "${baseRef}" and HEAD (is the ref fetched? use fetch-depth: 0)`);
  process.exit(2);
}

const changed = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
const plugins = [...new Set(changed.map((f) => /^plugins\/([^/]+)\//.exec(f)?.[1]).filter(Boolean))].sort();

if (!plugins.length) {
  console.log(`✓ no plugin changed since ${baseRef} (${base.slice(0, 7)})`);
  process.exit(0);
}

let failures = 0;
for (const name of plugins) {
  const manifest = `plugins/${name}/.claude-plugin/plugin.json`;
  const headPath = join(root, manifest);
  if (!existsSync(headPath)) {
    if (!existsSync(join(root, 'plugins', name))) {
      console.log(`- ${name}: plugin removed, skipped`);
    } else {
      console.error(`✗ ${name}: files changed but ${manifest} is missing`);
      failures++;
    }
    continue;
  }

  let headVersion;
  try {
    headVersion = JSON.parse(readFileSync(headPath, 'utf8')).version;
  } catch (e) {
    console.error(`✗ ${name}: ${manifest} is not valid JSON (${e.message})`);
    failures++;
    continue;
  }
  const head = parse(headVersion);
  if (!head) {
    console.error(`✗ ${name}: version "${headVersion}" in ${manifest} is not valid SemVer`);
    failures++;
    continue;
  }

  let baseText;
  try {
    baseText = execFileSync('git', ['show', `${base}:${manifest}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    console.log(`✓ ${name}: new plugin (${headVersion})`);
    continue;
  }

  let baseVersion;
  try {
    baseVersion = JSON.parse(baseText).version;
  } catch {
    baseVersion = undefined;
  }
  const prev = parse(baseVersion);
  if (!prev) {
    console.log(`✓ ${name}: ${headVersion} (no valid SemVer version at base)`);
    continue;
  }

  if (compare(head, prev) > 0) {
    console.log(`✓ ${name}: ${baseVersion} -> ${headVersion}`);
  } else if (compare(head, prev) === 0) {
    console.error(`✗ ${name}: files changed but version ${headVersion} not bumped`);
    failures++;
  } else {
    console.error(`✗ ${name}: version ${headVersion} is lower than ${baseVersion} at base`);
    failures++;
  }
}

if (failures) {
  console.error(`\n${failures} plugin(s) need a version bump in .claude-plugin/plugin.json`);
  process.exit(1);
}
console.log('\n✓ all changed plugins have a version bump');
