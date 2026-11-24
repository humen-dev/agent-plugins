import { expect, it } from 'vitest';
import { blobUrl, treeUrl } from '../../src/links/source-url.ts';
import { catalogOf } from '../search/fixture-catalog.ts';

// AC-35
it('blobUrl and treeUrl pin the build commit', () => {
  const c = catalogOf([]);
  expect(blobUrl(c, 'plugins/p/x.md')).toBe('https://github.com/o/r/blob/c/plugins/p/x.md');
  expect(treeUrl(c, 'plugins/p')).toBe('https://github.com/o/r/tree/c/plugins/p');
  expect(blobUrl(c, '')).toBe('https://github.com/o/r/blob/c/');
});
