// Scripted git repos for tests (§3.7).
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const IDENT = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com'];

/** @param {string} repo @param {...string} args @returns {string} stdout */
export function git(repo, ...args) {
  return execFileSync('git', [...IDENT, ...args], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** @returns {string} */
export function tempRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'catalog-repo-'));
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'config', 'commit.gpgsign', 'false');
  return repo;
}

/** @param {string} srcDir @param {string} dest */
export function copyFixture(srcDir, dest) {
  cpSync(srcDir, dest, { recursive: true });
}

/**
 * @param {string} repo
 * @param {{ files?: Record<string, string | Buffer | null>, message: string, date: string }} opts null = delete
 * @returns {string} sha
 */
export function commit(repo, { files = {}, message, date }) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(repo, rel);
    if (content === null) {
      rmSync(abs, { recursive: true, force: true });
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
  }
  git(repo, 'add', '-A');
  execFileSync('git', [...IDENT, 'commit', '-q', '--allow-empty', '-m', message], {
    cwd: repo,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return git(repo, 'rev-parse', 'HEAD').trim();
}

/** @param {string} repo @returns {string} path of a depth-1 clone */
export function shallowClone(repo) {
  const dest = mkdtempSync(join(tmpdir(), 'catalog-shallow-'));
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${repo.replaceAll('\\', '/')}`, dest], { stdio: ['ignore', 'pipe', 'pipe'] });
  return dest;
}

/** @param {string} dir */
export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}
