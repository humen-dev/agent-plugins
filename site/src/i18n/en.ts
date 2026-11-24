export const en = {
  app: {
    skip: 'Skip to content',
  },
  header: {
    brand: 'humen-dev',
    brandSuffix: 'plugins',
    nav: 'Main',
    search: 'Search',
    install: 'Install set',
    whatsNew: 'What’s new',
    request: 'Request a skill',
    github: 'GitHub',
    opensOnGithub: ' (opens on GitHub)',
    githubRepo: ' repository (opens on GitHub)',
    menu: 'Menu',
  },
  footer: {
    marketplace: 'marketplace',
    builtFrom: 'built from',
    on: 'on',
    commit: ' commit (opens on GitHub)',
    repository: 'Repository',
    opensOnGithub: ' (opens on GitHub)',
    request: 'Request a skill',
  },
  theme: {
    light: 'Light theme',
  },
  search: {
    heading: 'Find a plugin, skill, agent or hook',
  },
  states: {
    loadingResults: 'Loading results',
    errorTitle: 'The catalog didn’t load',
    errorBody: 'The plugin list couldn’t be read, so there is nothing to show yet. Check your connection and try again.',
    retry: 'Retry',
    notFoundTitle: 'Page not found',
    notFoundBefore: 'Nothing in the catalog lives at ',
    notFoundAfter: '. The plugin or item may have been renamed or removed.',
    backToSearch: 'Back to search',
  },
  pages: {
    installTitle: 'Install set',
    newTitle: 'What’s new',
  },
} as const;

type Plural = { readonly one: string; readonly other: string };
type Leaf = string | Plural;
type Paths<T> = { [K in keyof T & string]: T[K] extends Leaf ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type Key = Paths<typeof en>;

const plural = new Intl.PluralRules('en');

export function t(key: Key, vars?: Record<string, string | number>): string {
  let v: unknown = en;
  for (const part of key.split('.')) v = (v as Record<string, unknown>)[part];
  const s = typeof v === 'string' ? v : (v as Plural)[plural.select(Number(vars?.n)) === 'one' ? 'one' : 'other'];
  return s.replace(/\{(\w+)\}/g, (m, name: string) => (vars && name in vars ? String(vars[name]) : m));
}
