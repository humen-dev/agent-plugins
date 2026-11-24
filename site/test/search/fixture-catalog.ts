import type { Artifact, ArtifactKind, Catalog, Kind, Plugin } from '../../src/catalog/types.ts';

const KINDS: Kind[] = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];

export const md = (path: string, source: string) => ({ path, source });

export const plugin = (name: string, o: Partial<Plugin> = {}): Plugin => ({
  id: name, name, description: '', category: null, tags: [], version: null, author: null, license: null,
  homepage: null, repository: null, dependencies: [], installCommand: '', path: `plugins/${name}`, sourceUrl: '',
  summary: '', readme: null, thirdPartyNotices: null, updated: null, artifactIds: [],
  runs: { runsCode: false, reasons: [], shellArtifacts: [], hooks: [], mcpServers: [], scripts: [], agentTools: [], whatItRuns: [] },
  recentChanges: [], ...o,
});

export const artifact = (kind: ArtifactKind, pluginName: string, name: string, o: Record<string, unknown> = {}): Artifact =>
  ({
    id: `${kind}:${pluginName}/${name}`, kind, name, plugin: pluginName, description: '',
    path: `plugins/${pluginName}/${kind}s/${name}.md`, sourceUrl: '', invokeAs: null, headings: [], body: null,
    files: [], frontmatter: {}, ...o,
  }) as unknown as Artifact;

export const catalogOf = (plugins: Plugin[], artifacts: Artifact[] = []): Catalog => ({
  marketplace: { name: 'fixture', description: '', version: null, owner: '', repo: 'o/r', repoUrl: 'https://github.com/o/r', addCommand: '' },
  build: { commit: 'c', commitDate: '2026-01-01T00:00:00Z' },
  categories: [...new Set(plugins.map((p) => p.category).filter((c): c is string => c !== null))].sort(),
  kinds: KINDS.filter((k) => k === 'plugin' ? plugins.length > 0 : artifacts.some((a) => a.kind === k)),
  plugins, artifacts, changes: [], diagnostics: [],
});

/**
 * AC-15: one item per index field, each field one token long ('alpha' in exactly one field).
 * Plugins carry no README, so their headings and body are empty; both fields then have the same average length.
 */
export const fieldCatalog = (): Catalog =>
  catalogOf(
    [
      plugin('alpha', { tags: ['filler'], description: 'filler' }),
      plugin('beta', { tags: ['alpha'], description: 'filler' }),
      plugin('gamma', { tags: ['filler'], description: 'alpha' }),
      plugin('delta', { tags: ['filler'], description: 'filler' }),
    ],
    [
      artifact('skill', 'beta', 'zeta', { description: 'filler', headings: ['filler'], body: md('plugins/beta/skills/zeta.md', 'filler') }),
      artifact('skill', 'delta', 'eta', { description: 'filler', headings: ['alpha'], body: md('plugins/delta/skills/eta.md', 'filler') }),
      artifact('skill', 'delta', 'theta', { description: 'filler', headings: ['filler'], body: md('plugins/delta/skills/theta.md', 'alpha') }),
    ],
  );
