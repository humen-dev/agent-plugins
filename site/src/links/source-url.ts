import type { Catalog } from '../catalog/types.ts';

// SPEC-01 AC-35: GitHub links pinned to the build commit.
export const blobUrl = (c: Catalog, path: string) => `${c.marketplace.repoUrl}/blob/${c.build.commit}/${path}`;
export const treeUrl = (c: Catalog, path: string) => `${c.marketplace.repoUrl}/tree/${c.build.commit}/${path}`;
