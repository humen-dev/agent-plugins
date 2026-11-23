// Catalog data model: SPEC-01 docs/specs/catalog-site.md:149-281, verbatim, with `export` added.

export type Kind = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
export type ArtifactKind = Exclude<Kind, 'plugin'>;

/** Raw Markdown plus its repo path. The site renders it safely (UT-1..UT-3). */
export interface Markdown { path: string; source: string; }

export interface Person { name: string; url: string | null; } // e-mail is never copied

export interface Catalog {
  marketplace: {
    name: string;              // "humen-dev"
    description: string;
    version: string | null;    // metadata.version
    owner: string;             // owner.name
    repo: string;              // "humen-dev/agent-plugins", from GITHUB_REPOSITORY, or a flag locally
    repoUrl: string;           // https://github.com/<repo>
    addCommand: string;        // "claude plugin marketplace add <repo>"
  };
  build: { commit: string; commitDate: string }; // HEAD sha and its committer date (ISO 8601)
  categories: string[];        // distinct marketplace categories, sorted
  kinds: Kind[];               // kinds with at least one item, in Kind order
  plugins: Plugin[];           // sorted by name
  artifacts: Artifact[];       // sorted by id
  changes: Change[];           // newest first, at most 100
  diagnostics: Diagnostic[];   // warnings only, sorted by path then message
}

/** A source problem that is not a validator error. It never fails the build (AC-65a..AC-65d). */
export interface Diagnostic { level: 'warning'; path: string; message: string; }

export interface Plugin {
  id: string;                  // = name
  name: string;
  description: string;         // marketplace entry; else plugin.json
  category: string | null;     // marketplace entry
  tags: string[];              // marketplace tags ∪ plugin.json keywords; lower-case, unique, sorted
  version: string | null;      // plugin.json
  author: Person | null;
  license: string | null;
  homepage: string | null;     // only http(s), else null
  repository: string | null;   // only http(s), else null
  dependencies: { name: string; version: string | null; inCatalog: boolean }[];
  installCommand: string;      // "claude plugin install <name>@<marketplace.name>"
  path: string;                // "plugins/<name>"
  sourceUrl: string;           // <repoUrl>/tree/<build.commit>/<path>
  summary: string;             // plain text, ≤ 300 chars (rule X-9)
  readme: Markdown | null;
  thirdPartyNotices: Markdown | null;
  updated: string | null;      // committer date of the last non-merge commit touching path
  artifactIds: string[];       // sorted
  runs: RunProfile;
  recentChanges: Change[];     // ≤ 10, newest first
}

export interface ArtifactBase {
  id: string;                  // `${kind}:${plugin}/${name}`
  kind: ArtifactKind;
  name: string;
  plugin: string;
  description: string;         // "" when the source has none (never invented)
  path: string;                // repo-relative file that defines it
  sourceUrl: string;           // <repoUrl>/blob/<build.commit>/<path>
  invokeAs: string | null;     // rule X-6
  headings: string[];          // H1–H3 text of body and files, in order
  body: Markdown | null;       // file content without frontmatter
  files: { path: string; title: string; body: Markdown }[]; // supporting .md, sorted by path
  frontmatter: Record<string, string | number | boolean | string[]>; // every key, verbatim
}

export interface Skill extends ArtifactBase {
  kind: 'skill';
  argumentHint: string | null;
  userInvokedOnly: boolean;    // disable-model-invocation: true
  allowedTools: string[] | null;
  model: string | null;
}
export interface Agent extends ArtifactBase {
  kind: 'agent';
  model: string | null;
  tools: string[] | null;      // null = not declared (inherits the session's tools)
  disallowedTools: string[];
  preloadedSkills: string[];   // frontmatter `skills`, as written ("plugin:skill")
  maxTurns: number | null;
}
export interface Command extends ArtifactBase {
  kind: 'command';
  argumentHint: string | null;
  allowedTools: string[] | null;
  model: string | null;
}
export interface Hook extends ArtifactBase {
  kind: 'hook';
  event: string;               // e.g. "PreToolUse"
  matcher: string | null;
  type: string;                // "command" | "prompt" | … verbatim
  command: string | null;      // verbatim, ${CLAUDE_PLUGIN_ROOT} kept as written
  timeout: number | null;      // seconds
  scripts: string[];           // repo paths of plugin files the command references
  definedIn: string;           // "plugins/x/hooks/hooks.json" or "plugins/x/.claude-plugin/plugin.json"
}
export interface McpServer extends ArtifactBase {
  kind: 'mcp';
  transport: string | null;    // type verbatim; "stdio" when only command is set; null (+ warning) when only url is set
  command: string | null;
  args: string[];
  url: string | null;
  envVars: string[];           // names of env keys only, never values
  definedIn: string;
}
export type Artifact = Skill | Agent | Command | Hook | McpServer;

export interface RunProfile {
  runsCode: boolean;           // reasons.length > 0
  reasons: ('hooks' | 'mcp' | 'scripts' | 'shell')[]; // in this order; 'shell' = rule X-18
  shellArtifacts: string[];    // ids of the agents, skills and commands that give 'shell'
  hooks: string[];             // artifact ids
  mcpServers: string[];        // artifact ids
  scripts: { path: string; sourceUrl: string; referencedBy: string[] }[]; // referencedBy = hook ids
  agentTools: { agent: string; model: string | null; tools: string[] | null; disallowedTools: string[] }[];
  whatItRuns: { heading: string; text: Markdown }[]; // README "## What it runs" → each "### heading"
}

export interface Change {
  commit: string;              // full sha
  date: string;                // committer date ISO 8601
  subject: string;             // first line of the commit message, verbatim
  plugin: string;              // the plugin folder name at that commit (an old name before a rename)
  type: 'added' | 'version' | 'change';
  version: { from: string | null; to: string } | null; // set for 'added' (from = null) and 'version'
  url: string;                 // <repoUrl>/commit/<sha>
}

export type FrontmatterValue = string | number | boolean | string[];
