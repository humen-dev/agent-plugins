import { resolve } from 'node:path';
import { Ajv } from 'ajv';
import { createGenerator } from 'ts-json-schema-generator';
import { afterAll, describe, expect, it } from 'vitest';
import { generate } from '../scripts/generate.mjs';
import { cleanup, commit, copyFixture, tempRepo } from './helpers/fixture-repo.mjs';

const SITE = resolve(import.meta.dirname, '..');
const schema = createGenerator({
  path: resolve(SITE, 'src/catalog/types.ts'),
  tsconfig: resolve(SITE, 'tsconfig.json'),
  type: 'Catalog',
  skipTypeCheck: true,
}).createSchema('Catalog');
const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);

const fixture = tempRepo();
afterAll(() => cleanup(fixture));

/** @param {unknown} catalog */
const check = (catalog) => {
  validate(catalog);
  expect(validate.errors ?? []).toEqual([]);
};

describe('catalog schema derived from types.ts (AC-1)', () => {
  it('rejects a wrong shape', () => {
    expect(validate({ marketplace: {} })).toBe(false);
  });

  it('accepts the fixture output', async () => {
    copyFixture(resolve(SITE, 'test/fixtures/repo'), fixture);
    commit(fixture, { message: 'fixture', date: '2024-01-01T12:00:00Z' });
    check((await generate({ root: fixture, repo: 'o/r' })).catalog);
  });

  it('accepts the real repo output', async () => {
    check((await generate({ root: resolve(SITE, '..'), repo: 'o/r' })).catalog);
  }, 30_000);
});
