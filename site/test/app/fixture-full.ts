import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { generate } from '../../scripts/generate.mjs';
import type { Catalog, Plugin } from '../../src/catalog/types.ts';
import { cleanup, commit, copyFixture, tempRepo } from '../helpers/fixture-repo.mjs';

const FIXTURE = resolve(import.meta.dirname, '../fixtures/repo');

let catalog: Catalog | undefined;
const dirs: string[] = [];

/** Generates the catalog of the fixture repo once per test file (30 s budget for the git work). */
export function useFullCatalog(): { catalog: () => Catalog; plugin: (name: string) => Plugin } {
  beforeAll(async () => {
    const repo = tempRepo();
    dirs.push(repo, mkdtempSync(join(tmpdir(), 'fixture-full-')));
    copyFixture(FIXTURE, repo);
    commit(repo, { message: 'fixture', date: '2024-01-01T12:00:00Z' });
    commit(repo, { message: 'second', date: '2024-01-02T12:00:00Z' });
    catalog = (await generate({ root: repo, repo: 'o/r' })).catalog as Catalog;
  }, 30_000);
  afterAll(() => dirs.splice(0).forEach(cleanup));
  const get = () => {
    if (!catalog) throw new Error('catalog not generated');
    return catalog;
  };
  return {
    catalog: get,
    plugin: (name) => {
      const p = get().plugins.find((x) => x.name === name);
      if (!p) throw new Error(`no plugin ${name}`);
      return p;
    },
  };
}
