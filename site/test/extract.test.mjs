import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createDiagnostics } from '../scripts/lib/diagnostics.mjs';
import { extractCatalogParts } from '../scripts/lib/plugin.mjs';
import { createReader } from '../scripts/lib/safe-fs.mjs';
import { copyFixture } from './helpers/fixture-repo.mjs';

const FIXTURE = resolve(import.meta.dirname, 'fixtures/repo');
const VALIDATOR = resolve(import.meta.dirname, '../../scripts/validate-marketplace.mjs');
const REPO_URL = 'https://github.com/o/r';
const SENTINEL = 'SENTINEL-MUST-NOT-LEAK';
const MKT = '.claude-plugin/marketplace.json';

// Hostile files are written at test time, not committed (Decision 6).
const root = mkdtempSync(join(tmpdir(), 'extract-'));
copyFixture(FIXTURE, root);
const full = join(root, 'plugins/fixture-full');
writeFileSync(join(root, '.env'), `TOKEN=${SENTINEL}-env`);
writeFileSync(join(full, 'secrets.txt'), `${SENTINEL}-secrets`);
writeFileSync(join(full, 'agents/big.md'), `---\ndescription: ${SENTINEL}-big\n---\n${'a'.repeat(1_048_577)}`);
writeFileSync(join(full, 'agents/badutf.md'), Buffer.concat([Buffer.from(`---\ndescription: ${SENTINEL}-utf\n---\n`), Buffer.from([0xff, 0xfe])]));
writeFileSync(join(root, 'outside.md'), `---\ndescription: ${SENTINEL}-link\n---\n`);
let linkOk = true;
try {
  symlinkSync(join(root, 'outside.md'), join(full, 'agents/linked.md'));
} catch {
  linkOk = false; // EPERM on Windows without developer mode; always runs on ubuntu-latest
}
mkdirSync(join(root, 'plugins/fixture-minimal/skills/nodesc'), { recursive: true });
writeFileSync(join(root, 'plugins/fixture-minimal/skills/nodesc/SKILL.md'), '---\nname: nodesc\n---\nBody.\n');

const diag = createDiagnostics();
const parts = extractCatalogParts(createReader(root, diag), diag, {
  root, repoUrl: REPO_URL, commit: 'c0ffee', marketplaceName: 'fixture-market',
});
const warnings = diag.list();
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** @param {string} id */
const art = (id) => parts.artifacts.find((a) => a.id === id);
/** @param {string} name */
const plugin = (name) => parts.plugins.find((p) => p.name === name);
/** @param {string} path @param {string} prefix */
const warned = (path, prefix) => warnings.filter((w) => w.path === path && w.message.startsWith(prefix));

describe('fixture repo', () => {
  it('passes the repo validator', () => {
    const out = execFileSync(process.execPath, [VALIDATOR, FIXTURE], { encoding: 'utf8' });
    expect(out).toContain('marketplace OK');
  });
});

describe('plugins (X-1, X-2, X-9..X-11)', () => {
  it('one Plugin per relative entry, sorted; the github entry is skipped with a warning', () => {
    expect(parts.plugins.map((p) => p.name)).toEqual([
      'fixture-full', 'fixture-hostile', 'fixture-inline', 'fixture-minimal', 'fixture-paths',
    ]);
    expect(warned(MKT, 'source: not a relative path, skipped')).toHaveLength(1);
  });

  it('fixture-full carries every field', () => {
    const p = plugin('fixture-full');
    expect(p).toMatchObject({
      id: 'fixture-full',
      description: 'Entry description of the full plugin.',
      category: 'tools',
      tags: ['alpha', 'beta', 'gamma'],
      version: '1.2.0',
      author: { name: 'Full Author', url: 'https://example.com/author' },
      license: 'MIT',
      homepage: 'https://example.com/home',
      repository: 'https://github.com/example/full',
      dependencies: [
        { name: 'fixture-minimal', version: null, inCatalog: true },
        { name: 'outside-dep', version: '^1.0.0', inCatalog: false },
      ],
      installCommand: 'claude plugin install fixture-full@fixture-market',
      path: 'plugins/fixture-full',
      sourceUrl: `${REPO_URL}/tree/c0ffee/plugins/fixture-full`,
      summary: 'This is the summary paragraph with a link and code.',
      readme: { path: 'plugins/fixture-full/README.md' },
      thirdPartyNotices: { path: 'plugins/fixture-full/THIRD_PARTY_NOTICES.md', source: '# Notices\n\nBundled thing, MIT.\n' },
    });
    expect(p?.runs.whatItRuns.map((w) => w.heading)).toEqual(['guard', 'guard-2', 'fixture-server', 'Other']);
    expect(p?.runs.whatItRuns[0].text.source).toBe('Blocks risky shell commands before they run.\n\nMore text about guard.');
    expect(p?.artifactIds).toEqual([...(p?.artifactIds ?? [])].sort());
  });

  it('fixture-minimal has every optional field absent', () => {
    expect(plugin('fixture-minimal')).toMatchObject({
      description: 'Minimal plugin.',
      category: null,
      tags: [],
      version: '0.1.0',
      author: null,
      license: null,
      homepage: null,
      repository: null,
      dependencies: [],
      summary: 'Minimal plugin.',
      thirdPartyNotices: null,
    });
  });

  it('marketplace block', () => {
    expect(parts.marketplace).toEqual({
      name: 'fixture-market',
      description: 'Fixture marketplace for the catalog generator tests.',
      version: '2.0.0',
      owner: 'Fixture Owner',
      repo: 'o/r',
      repoUrl: REPO_URL,
      addCommand: 'claude plugin marketplace add o/r',
    });
  });

  it('truncates a long summary at a word boundary to at most 300 chars', () => {
    const d = createDiagnostics();
    const r = { readJson: () => null, readText: () => `# T\n\n${'word '.repeat(100)}`, list: () => [] };
    const q = extractCatalogParts({ ...r, readJson: (/** @type {string} */ p) => (p === MKT
      ? { name: 'm', plugins: [{ name: 'p', source: './plugins/p' }] } : null) }, d, {
      root, repoUrl: REPO_URL, commit: 'c', marketplaceName: 'm',
    });
    const s = q.plugins[0].summary;
    expect(s.length).toBeLessThanOrEqual(300);
    expect(s.endsWith('word…')).toBe(true);
  });
});

describe('artifacts (X-3..X-8)', () => {
  it('fixture-full has one artifact per source item', () => {
    expect(plugin('fixture-full')?.artifactIds).toEqual([
      'agent:fixture-full/reviewer',
      'command:fixture-full/deploy:prod',
      'command:fixture-full/hello',
      'hook:fixture-full/guard',
      'hook:fixture-full/guard-2',
      'mcp:fixture-full/fixture-server',
      'skill:fixture-full/alpha',
      'skill:fixture-full/beta',
    ]);
  });

  it('skills: folded description, supporting files, headings, tools', () => {
    expect(art('skill:fixture-full/alpha')).toMatchObject({
      description: 'Use when: you need alpha. Second folded line.',
      argumentHint: '[target]',
      allowedTools: ['Read', 'Bash'],
      model: 'sonnet',
      userInvokedOnly: false,
      path: 'plugins/fixture-full/skills/alpha/SKILL.md',
      sourceUrl: `${REPO_URL}/blob/c0ffee/plugins/fixture-full/skills/alpha/SKILL.md`,
      headings: ['Alpha skill', 'Steps', 'Details', 'Alpha reference', 'Table'],
    });
    const alpha = /** @type {any} */ (art('skill:fixture-full/alpha'));
    expect(alpha.files.map((/** @type {any} */ f) => [f.path, f.title])).toEqual([
      ['plugins/fixture-full/skills/alpha/notes/extra.md', 'extra.md'],
      ['plugins/fixture-full/skills/alpha/reference.md', 'Alpha reference'],
    ]);
    expect(alpha.body.source).not.toContain('---');
    expect(alpha.frontmatter.model).toBe('sonnet');
    expect(art('skill:fixture-full/beta')).toMatchObject({ userInvokedOnly: true, allowedTools: ['Read', 'Grep'] });
  });

  it('agents: list-or-string fields, preloaded skills, maxTurns', () => {
    expect(art('agent:fixture-full/reviewer')).toMatchObject({
      model: 'opus',
      tools: ['Read', 'Grep'],
      disallowedTools: ['Write', 'Edit'],
      preloadedSkills: ['fixture-full:alpha'],
      maxTurns: 7,
    });
  });

  it('commands: nested name and first-line description', () => {
    expect(art('command:fixture-full/deploy:prod')).toMatchObject({ name: 'deploy:prod', description: 'Deploy to production.', argumentHint: '[tag]' });
    expect(art('command:fixture-full/hello')).toMatchObject({ description: 'Say hello to the user.', argumentHint: null });
  });

  it('hooks: names, scripts, README description, definedIn', () => {
    expect(art('hook:fixture-full/guard')).toMatchObject({
      event: 'PreToolUse',
      matcher: 'Bash',
      type: 'command',
      command: '${CLAUDE_PLUGIN_ROOT}/scripts/guard.sh',
      timeout: 5,
      scripts: ['plugins/fixture-full/scripts/guard.sh'],
      description: 'Blocks risky shell commands before they run.',
      definedIn: 'plugins/fixture-full/hooks/hooks.json',
      body: null,
    });
    expect(art('hook:fixture-full/guard-2')).toMatchObject({ event: 'PostToolUse', matcher: null, timeout: null });
  });

  it('mcp: transport, env names only', () => {
    expect(art('mcp:fixture-full/fixture-server')).toMatchObject({
      transport: 'stdio',
      command: 'node',
      args: ['${CLAUDE_PLUGIN_ROOT}/scripts/helper.mjs'],
      url: null,
      envVars: ['API_TOKEN', 'REGION'],
      description: 'Starts the fixture MCP server.',
    });
  });

  it('inline definitions in plugin.json', () => {
    expect(art('hook:fixture-inline/PreToolUse-1')).toMatchObject({
      definedIn: 'plugins/fixture-inline/.claude-plugin/plugin.json',
      command: 'echo checking',
      description: 'Echoes before a write.',
    });
    expect(art('mcp:fixture-inline/inline-server')).toMatchObject({ transport: 'http', url: 'https://example.com/mcp' });
  });

  it('definitions referenced by path', () => {
    expect(art('hook:fixture-paths/start')).toMatchObject({ definedIn: 'plugins/fixture-paths/config/hooks.json' });
    expect(art('mcp:fixture-paths/paths-server')).toMatchObject({ definedIn: 'plugins/fixture-paths/config/mcp.json', transport: 'stdio' });
  });

  it.each([
    ['skill:fixture-full/alpha', '/fixture-full:alpha'],
    ['command:fixture-full/deploy:prod', '/fixture-full:deploy:prod'],
    ['agent:fixture-full/reviewer', 'fixture-full:reviewer'],
    ['hook:fixture-full/guard', null],
    ['mcp:fixture-full/fixture-server', null],
  ])('invokeAs of %s', (id, expected) => {
    expect(art(id)?.invokeAs).toBe(expected);
  });
});

describe('descriptions (AC-10)', () => {
  it('a skill without a source description gets "" and a warning', () => {
    const p = 'plugins/fixture-minimal/skills/nodesc/SKILL.md';
    expect(art('skill:fixture-minimal/nodesc')?.description).toBe('');
    expect(warned(p, 'description: missing')).toHaveLength(1);
  });

  it('agents, commands and hooks without one give ""', () => {
    expect(art('agent:fixture-hostile/notools')?.description).toBe('');
    expect(art('command:fixture-hostile/bare')?.description).toBe('');
    expect(art('hook:fixture-hostile/nohead')?.description).toBe('');
    expect(warned('plugins/fixture-hostile/agents/notools.md', 'description: missing')).toHaveLength(1);
    expect(warned('plugins/fixture-hostile/commands/bare.md', 'description: missing')).toHaveLength(1);
  });
});

describe('run profile (EC-8, EC-18)', () => {
  const runs = plugin('fixture-full')?.runs;

  it('both hook ids reference the shared script', () => {
    const guard = runs?.scripts.find((s) => s.path.endsWith('guard.sh'));
    expect(guard?.referencedBy).toEqual(['hook:fixture-full/guard', 'hook:fixture-full/guard-2']);
  });

  it('scripts exclude tests and evals', () => {
    expect(runs?.scripts.map((s) => s.path)).toEqual([
      'plugins/fixture-full/scripts/guard.sh',
      'plugins/fixture-full/scripts/helper.mjs',
    ]);
  });

  it('reasons are ordered and runsCode follows', () => {
    expect(runs).toMatchObject({
      runsCode: true,
      reasons: ['hooks', 'mcp', 'scripts', 'shell'],
      shellArtifacts: ['skill:fixture-full/alpha'],
      hooks: ['hook:fixture-full/guard', 'hook:fixture-full/guard-2'],
      mcpServers: ['mcp:fixture-full/fixture-server'],
    });
    expect(plugin('fixture-minimal')?.runs).toMatchObject({ runsCode: false, reasons: [] });
  });

  it('agent with tools: Bash and agent without tools give shell', () => {
    const h = plugin('fixture-hostile')?.runs;
    expect(h?.reasons).toContain('shell');
    expect(h?.shellArtifacts).toEqual(expect.arrayContaining(['agent:fixture-hostile/shelly', 'agent:fixture-hostile/notools']));
    expect(h?.shellArtifacts).not.toContain('agent:fixture-hostile/twin');
    expect(art('agent:fixture-hostile/notools')).toMatchObject({ tools: null });
    expect(h?.agentTools.find((a) => a.agent === 'agent:fixture-hostile/notools')?.tools).toBeNull();
  });
});

describe('hostile input', () => {
  it('javascript: and data: manifest URLs become null (UT-2b)', () => {
    expect(plugin('fixture-hostile')).toMatchObject({ homepage: null, repository: null, author: { name: 'Hostile', url: null } });
  });

  it('billion-laughs and custom-tag agents are read line by line with one warning each', () => {
    for (const f of ['bomb', 'custom']) {
      const path = `plugins/fixture-hostile/agents/${f}.md`;
      expect(warned(path, 'frontmatter: YAML rejected (')).toHaveLength(1);
      expect(art(`agent:fixture-hostile/${f}`)).toBeDefined();
    }
    expect(JSON.stringify(art('agent:fixture-hostile/bomb')).length).toBeLessThan(5000);
  });

  it('duplicates keep the first by path', () => {
    expect(art('agent:fixture-hostile/twin')?.path).toBe('plugins/fixture-hostile/agents/twin-a.md');
    expect(warned('plugins/fixture-hostile/agents/twin-b.md', 'duplicate: agent "twin" already defined by plugins/fixture-hostile/agents/twin-a.md')).toHaveLength(1);
  });

  it('one warning per X-17 example on the problem path', () => {
    expect(warned('plugins/fixture-hostile/hooks/hooks.json', 'hook: unknown shape')).toHaveLength(1);
    expect(warned('plugins/fixture-hostile/.mcp.json', 'mcp: url only, transport unknown')).toHaveLength(1);
    expect(art('mcp:fixture-hostile/url-only')).toMatchObject({ transport: null, url: 'https://example.com/sse' });
    expect(warned('plugins/fixture-hostile/README.md', 'readme: no "### nohead" under "## What it runs"')).toHaveLength(1);
  });

  it('symlink, > 1 MB and invalid UTF-8 agents: absent, one warning each, siblings kept', () => {
    const ids = parts.artifacts.map((a) => a.id);
    expect(ids).toContain('agent:fixture-full/reviewer');
    expect(ids).not.toContain('agent:fixture-full/big');
    expect(ids).not.toContain('agent:fixture-full/badutf');
    expect(warned('plugins/fixture-full/agents/big.md', 'file: larger than 1 MB, skipped')).toHaveLength(1);
    expect(warned('plugins/fixture-full/agents/badutf.md', 'file: not valid UTF-8, skipped')).toHaveLength(1);
    if (linkOk) {
      expect(ids).not.toContain('agent:fixture-full/linked');
      expect(warned('plugins/fixture-full/agents/linked.md', 'file: symlink, skipped')).toHaveLength(1);
    }
  });

  it('no sentinel, MCP env value or e-mail reaches the output (UT-9a, AC-11, AC-12)', () => {
    const out = JSON.stringify({ ...parts, warnings });
    expect(out).not.toContain(SENTINEL);
    expect(out).not.toContain('SECRET-ENV-VALUE');
    expect(out).not.toContain('author@example.com');
    expect(out).not.toMatch(/"email"/);
  });
});
