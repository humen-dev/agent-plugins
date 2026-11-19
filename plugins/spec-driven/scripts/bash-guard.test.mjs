/**
 * Tests for bash-guard.mjs — run from the repository root:
 *   node --test plugins/spec-driven/scripts/bash-guard.test.mjs
 * Each case spawns the real hook with a PreToolUse payload on stdin, in a
 * temporary project with (or without) a `.claude/sdd.json`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GUARD = path.join(HERE, 'bash-guard.mjs');
const AGENTS = path.join(HERE, '..', 'agents');

const IMPLEMENTER = 'spec-driven:implementer';

function project(config) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'spec-driven-bg-'));
  if (config !== undefined) {
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, '.claude', 'sdd.json'), typeof config === 'string' ? config : JSON.stringify(config));
  }
  return dir;
}

const DEFAULT_PROJECT = project();
const CHECK = 'node scripts/check.mjs';
const CONFIGURED = project({
  checkCommand: CHECK,
  modules: [
    { name: 'api', path: 'services/api' },
    { name: 'web', path: './apps/web/' },
  ],
});
const FILES_ONLY = project({ checkCommand: 'pnpm test {files}' });
const CHAINED = project({ checkCommand: 'make lint && cargo test --workspace' });
const TEMPLATED = project({
  checkCommand: 'node scripts/check.mjs {module} {files} && node scripts/arch-check.mjs {module}/src --strict',
  modules: [
    { name: 'root', path: '.' },
    { name: 'api', path: 'services/api' },
  ],
});

function run(input, root) {
  const { CLAUDE_PROJECT_DIR: _drop, ...base } = process.env;
  return spawnSync(process.execPath, [GUARD], { input, encoding: 'utf8', cwd: root, env: base });
}

const payload = (agent, command, root) =>
  JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: root, ...(agent ? { agent_type: agent } : {}) });

function assertAllowed(agent, command, root = CONFIGURED) {
  const res = run(payload(agent, command, root), root);
  assert.equal(res.status, 0, `expected ${agent} to be allowed: ${command}\ngot ${res.status}: ${res.stderr}`);
  assert.equal(res.stderr, '');
}

function assertBlocked(agent, command, root = CONFIGURED, raw = false) {
  const res = run(raw ? command : payload(agent, command, root), root);
  assert.equal(res.status, 2, `expected a block for ${agent}: ${command}`);
  assert.match(res.stderr, /^spec-driven bash-guard: /);
  return res.stderr;
}

/** The comma-separated tool list of one frontmatter key in an agent file. */
function frontmatterTools(file, key) {
  const text = readFileSync(path.join(AGENTS, file), 'utf8');
  const fm = text.split(/^---$/m)[1] ?? '';
  const line = fm.split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
  return line ? line.slice(key.length + 1).split(',').map((s) => s.trim()) : [];
}

test('main session, other agents and look-alike names are never touched', () => {
  for (const agent of [
    undefined,
    'general-purpose',
    'Explore',
    'implementer',
    'other-plugin:implementer',
    'spec-driven:implementer-extra',
    'spec-driven:planner',
    'spec-driven:spec-creator',
  ]) {
    for (const cmd of ['git commit -m x', 'make install', 'rm -rf build', 'echo $HOME > x']) assertAllowed(agent, cmd);
  }
});

test('spec-creator and planner have no Bash at all (frontmatter)', () => {
  for (const file of ['spec-creator.md', 'planner.md']) {
    assert.ok(frontmatterTools(file, 'disallowedTools').includes('Bash'), `${file}: Bash must be in disallowedTools`);
    assert.ok(!frontmatterTools(file, 'tools').includes('Bash'), `${file}: Bash must not be in tools`);
  }
});

test('implementer frontmatter: Bash allowed, PowerShell and Skill disallowed', () => {
  assert.deepEqual(frontmatterTools('implementer.md', 'tools'), ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash']);
  assert.deepEqual(frontmatterTools('implementer.md', 'disallowedTools'), ['Agent', 'Skill', 'NotebookEdit', 'WebSearch', 'WebFetch', 'PowerShell']);
});

test('fail-closed: empty stdin, invalid JSON, no command', () => {
  assertBlocked(IMPLEMENTER, '', CONFIGURED, true);
  assertBlocked(IMPLEMENTER, '{not json', CONFIGURED, true);
  assertBlocked(IMPLEMENTER, JSON.stringify({ tool_name: 'Bash', tool_input: {}, cwd: CONFIGURED, agent_type: IMPLEMENTER }), CONFIGURED, true);
});

test('fail-closed on a malformed sdd.json for the implementer only', () => {
  const broken = project('{');
  assert.match(assertBlocked(IMPLEMENTER, 'git status', broken), /sdd\.json is not valid JSON/);
  assertAllowed(undefined, 'git status', broken);
  const badCheck = project({ checkCommand: 5 });
  assert.match(assertBlocked(IMPLEMENTER, 'git status', badCheck), /"checkCommand" must be a string or null/);
});

test('read-only git allowed', () => {
  for (const cmd of [
    'git status',
    'git diff main...HEAD',
    'git log --oneline -5',
    'git show HEAD:README.md',
    'git merge-base main HEAD',
    'git rev-parse HEAD',
    'git ls-files services/api',
    'git blame src/a.py',
    'git grep -n TODO',
    'git diff --stat main...HEAD | git log -1',
  ]) assertAllowed(IMPLEMENTER, cmd);
});

test('git state changes, installs, writes, substitution and escapes blocked', () => {
  for (const cmd of [
    'git add .',
    'git commit -m x',
    'git checkout -- src/x.py',
    'git switch -c x',
    'git reset --hard',
    'git rebase main',
    'git push',
    'git stash',
    'git merge main',
    'git restore src/x.py',
    'git rm src/x.py',
    'git mv a b',
    'git -c core.pager=sh log',
    'git diff --output=x',
    'git diff --output x',
    'git log -o x',
    'git diff main...HEAD > out.txt',
    'git log < in.txt',
    'pip install x',
    'cargo add x',
    'go get example.com/x',
    'gem install x',
    'apt-get install x',
    'brew install x',
    'make install',
    'rm -rf x',
    'mv a b',
    'echo $(id)',
    'echo ${HOME}',
    'git log `id`',
    'echo x | tee y',
    'git status & rm -rf x',
    'FOO=1 git status',
    'cd ..',
    'cd /tmp',
    'cd src',
    'cd services/api',
    'cd services/api && git status',
    'cat src/a.py',
    'ls src',
    'grep -r x src',
    'head -5 src/a.py',
    'gh pr create',
    'curl https://example.com',
    'docker compose down -v',
    'powershell -c "git commit"',
  ]) {
    const reason = assertBlocked(IMPLEMENTER, cmd);
    assert.match(reason, /implementer may not/);
    assert.match(reason, /allowed commands:/, 'reason must say what to do instead');
  }
});

test('no built-in test runners: only the configured commands run checks', () => {
  for (const cmd of ['make test', 'cargo test', 'go test ./...', 'node --test scripts/', 'tox']) {
    const reason = assertBlocked(IMPLEMENTER, cmd);
    assert.match(reason, /allowed commands: read-only git .*the check command "node scripts\/check\.mjs"/);
    assert.doesNotMatch(reason, /architecture/);
  }
});

test('checkCommand without placeholders: prefix match with extra arguments', () => {
  for (const cmd of [
    CHECK,
    `${CHECK} services/api/src/a.py services/api/test/test_a.py`,
    `${CHECK} --full`,
  ]) assertAllowed(IMPLEMENTER, cmd);
  for (const cmd of [
    'node scripts/check.mjs ../../etc/passwd',
    'node scripts/other.mjs',
    'node scripts',
    'node scripts/arch-check.mjs lib',
  ]) assertBlocked(IMPLEMENTER, cmd);
});

test('a stack runner is allowed only through a configured {files} template', () => {
  assertAllowed(IMPLEMENTER, 'pnpm test src/a.ts', FILES_ONLY);
  assertAllowed(IMPLEMENTER, 'pnpm test src/a.ts src/b.test.ts', FILES_ONLY);
  assertBlocked(IMPLEMENTER, 'pnpm test src/a.ts --update', FILES_ONLY);
  assertBlocked(IMPLEMENTER, 'pnpm test ../outside.ts', FILES_ONLY);
  assertBlocked(IMPLEMENTER, 'pnpm install', FILES_ONLY);
  for (const root of [CONFIGURED, DEFAULT_PROJECT]) {
    assertBlocked(IMPLEMENTER, 'pnpm test', root);
    assertBlocked(IMPLEMENTER, 'pnpm test src/a.ts', root);
  }
});

test('a chained checkCommand allows each of its segments', () => {
  assertAllowed(IMPLEMENTER, 'make lint && cargo test --workspace', CHAINED);
  assertAllowed(IMPLEMENTER, 'cargo test --workspace -p api', CHAINED);
  assertBlocked(IMPLEMENTER, 'cargo build', CHAINED);
});

test('placeholders (an architecture check chained into checkCommand): {module} = a configured module path, {files} = 0+ project-relative paths', () => {
  for (const cmd of [
    'node scripts/check.mjs services/api',
    'node scripts/check.mjs services/api services/api/src/a.py services/api/test/test_a.py',
    'node scripts/check.mjs . src/a.py',
    'node scripts/check.mjs ./services/api/ services/api/src/a.py',
    'node scripts/arch-check.mjs services/api/src --strict',
    'node scripts/arch-check.mjs ./src --strict',
  ]) assertAllowed(IMPLEMENTER, cmd, TEMPLATED);
  for (const cmd of [
    'node scripts/check.mjs',
    'node scripts/check.mjs apps/web src/a.py',
    'node scripts/check.mjs services/api --watch',
    'node scripts/check.mjs services/api ../../etc/passwd',
    'node scripts/check.mjs services/api src/a.py --fix',
    'node scripts/arch-check.mjs services/api/src --strict --output-to x',
    'node scripts/arch-check.mjs lib/src --strict',
  ]) assertBlocked(IMPLEMENTER, cmd, TEMPLATED);
});

test('missing sdd.json → defaults: only read-only git; the reason says checkCommand is not configured', () => {
  assertAllowed(IMPLEMENTER, 'git status', DEFAULT_PROJECT);
  const reason = assertBlocked(IMPLEMENTER, CHECK, DEFAULT_PROJECT);
  assert.match(reason, /no checkCommand is configured/);
  assert.match(reason, /NOT RUN/);
  assertBlocked(IMPLEMENTER, 'make test', DEFAULT_PROJECT);
});
