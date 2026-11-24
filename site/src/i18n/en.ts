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
    lede: 'Describe a task in plain words. Every result shows what it adds, what it runs on your machine, and the command to install it.',
    label: 'Search plugins, skills, agents and hooks',
    placeholder: 'e.g. a skill for safe Django migrations',
    clear: 'Clear search',
    clearTip: 'Clear search (Esc)',
    hintSearch: ' to search · ',
    hintClear: ' to clear',
    keyEsc: 'Esc',
    count: { one: '{n} result', other: '{n} results' },
    bestFirst: ', best match first',
    sortedByName: ', sorted by name',
    loading: 'Loading results',
  },
  card: {
    kind: { plugin: 'Plugin', skill: 'Skill', agent: 'Agent', command: 'Command', hook: 'Hook', mcp: 'MCP server' },
    merged: '{kind} · plugin',
    userOnly: 'User-invoked only',
    inPlugin: 'in',
    inFile: 'in',
    runsCode: 'Runs code',
    runs: { hooks: 'hooks', mcp: 'MCP servers', scripts: 'scripts', shell: '{kind} with shell access' },
    install: 'Install command',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy didn’t work. The text is selected — press Ctrl/Cmd+C',
  },
  filters: {
    heading: 'Filters',
    done: 'Done',
    kind: 'Kind',
    category: 'Category',
    clear: 'Clear filters',
    active: ' active',
  },
  empty: {
    titleQuery: 'No results for “{q}”',
    titleFilters: 'No results for these filters',
    hint: 'Try fewer or different words, or start from a popular tag:',
    request: 'Request it',
    opensOnGithub: ' (opens on GitHub)',
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
  md: {
    code: 'Code',
    mermaid: 'Mermaid diagram (shown as code)',
    table: 'Table',
    image: 'image',
    opensOnGithub: ' (opens on GitHub)',
    external: ' (external link)',
    imageNotLoaded: ' (image, not loaded)',
    rowsHidden: { one: '{n} row', other: '{n} rows' },
    colsHidden: { one: '{n} column', other: '{n} columns' },
    tableCapped: 'Not shown: {parts}.',
    tableCappedJoin: '{a} and {b}',
    viewFullFile: 'View the full file on GitHub',
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
