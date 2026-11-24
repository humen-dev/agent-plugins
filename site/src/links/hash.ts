import type { Artifact } from '../catalog/types.ts';

export const pluginHash = (name: string) => `#/plugins/${encodeURIComponent(name)}`;
export const artifactHash = (a: Pick<Artifact, 'plugin' | 'kind' | 'name'>) =>
  `${pluginHash(a.plugin)}/${a.kind}/${encodeURIComponent(a.name)}`;
