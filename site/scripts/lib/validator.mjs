// X-17 step 1: run the repo's own validator as a subprocess (Decision 2).
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const VALIDATOR = resolve(import.meta.dirname, '../../../scripts/validate-marketplace.mjs');

/**
 * @param {string} root repo to validate
 * @returns {{ ok: boolean, output: string, warnings: string[] }} output = stdout + stderr verbatim
 */
export function runValidator(root) {
  const r = spawnSync(process.execPath, [VALIDATOR, root], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.error) throw r.error;
  const output = `${r.stdout}${r.stderr}`;
  const warnings = output.split(/\r?\n/).filter((l) => l.startsWith('warning: ')).map((l) => l.slice('warning: '.length));
  return { ok: r.status === 0, output, warnings };
}
