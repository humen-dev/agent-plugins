// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Catalog, Plugin } from '../../src/catalog/types.ts';
import { WhatItRuns } from '../../src/ui/WhatItRuns.tsx';
import { artifact, catalogOf, plugin } from '../search/fixture-catalog.ts';
import { useFullCatalog } from './fixture-full.ts';

afterEach(cleanup);
const full = useFullCatalog();
const view = (cat: Catalog, p: Plugin) => render(<WhatItRuns catalog={cat} plugin={p} />).container;
const rows = (c: HTMLElement, table: string) => [...c.querySelectorAll(`.${table} .tr:not(.head)`)];
const cell = (row: Element, label: string) => row.querySelector(`[data-label="${label}"]`)?.textContent ?? '';

const hook = (name: string, o: Record<string, unknown> = {}) =>
  artifact('hook', 'p', name, { event: 'PreToolUse', matcher: null, type: 'command', command: 'x', timeout: null, scripts: [], definedIn: 'plugins/p/hooks/hooks.json', ...o });
const withHook = () => {
  const h = hook('h1');
  const p = plugin('p');
  return { cat: catalogOf([p], [h]), p: { ...p, artifactIds: [h.id], runs: { ...p.runs, hooks: [h.id] } } };
};

describe('WhatItRuns on fixture-full', () => {
  it('AC-29a: hook rows show event, matcher, type, verbatim command, timeout and description row', () => {
    const c = view(full.catalog(), full.plugin('fixture-full'));
    const rs = rows(c, 't-hooks');
    expect(rs).toHaveLength(2);
    const pre = rs.find((r) => cell(r, 'Event') === 'PreToolUse')!;
    expect(cell(pre, 'Matcher')).toBe('Bash');
    expect(cell(pre, 'Type')).toBe('command');
    expect(cell(pre, 'Command')).toBe('${CLAUDE_PLUGIN_ROOT}/scripts/guard.sh');
    expect(cell(pre, 'Timeout')).toBe('5 s');
    expect(pre.querySelector('.desc')?.textContent).toContain('plugins/fixture-full/hooks/hooks.json');
    expect(pre.querySelector('.desc a[href$="scripts/guard.sh"]')).not.toBeNull();
    const post = rs.find((r) => cell(r, 'Event') === 'PostToolUse')!;
    expect(cell(post, 'Matcher')).toBe('not set');
    expect(cell(post, 'Timeout')).toBe('not set');
    expect(c.querySelectorAll('.cmd-block')).toHaveLength(2); // EC-3b
  });

  it('AC-29b: the MCP row shows transport, command with args and env var names only', () => {
    const c = view(full.catalog(), full.plugin('fixture-full'));
    const [row] = rows(c, 't-mcp');
    expect(cell(row, 'Type')).toBe('stdio');
    expect(cell(row, 'Command or URL')).toBe('node ${CLAUDE_PLUGIN_ROOT}/scripts/helper.mjs');
    expect(cell(row, 'Env vars')).toBe('API_TOKENREGION');
    expect(c.textContent).not.toContain('SECRET-ENV-VALUE');
  });

  it('AC-29c: script rows show path, source link and referencing hooks', () => {
    const p = full.plugin('fixture-full');
    const c = view(full.catalog(), p);
    const rs = rows(c, 't-scripts');
    expect(rs).toHaveLength(p.runs.scripts.length);
    for (const s of p.runs.scripts) {
      const r = rs.find((x) => cell(x, 'Path') === s.path)!;
      expect(r.querySelector(`a[href="${s.sourceUrl}"]`)).not.toBeNull();
      if (s.referencedBy.length === 0) expect(cell(r, 'Named by hook')).toBe('not named in a hook command');
      else expect(r.querySelectorAll('[data-label="Named by hook"] a')).toHaveLength(s.referencedBy.length);
    }
  });

  it('AC-29d and AC-31: agent rows show model, tools and disallowed tools', () => {
    const p = full.plugin('fixture-full');
    const c = view(full.catalog(), p);
    const [row] = rows(c, 't-agents');
    expect(cell(row, 'Model')).toBe('opus');
    expect(cell(row, 'Tools')).toBe('ReadGrep');
    expect(cell(row, 'Disallowed tools')).toBe('WriteEdit');
  });

  it('AC-32a: whatItRuns entries sit under the Author’s description heading', () => {
    const p = full.plugin('fixture-full');
    const c = view(full.catalog(), p);
    const heads = [...c.querySelectorAll('h3')].map((h) => h.textContent);
    expect(heads).toContain('Author’s description');
    const entries = [...c.querySelectorAll('.author-entry')];
    expect(entries.map((e) => e.querySelector('h4')?.textContent)).toEqual(p.runs.whatItRuns.map((w) => w.heading));
    expect(entries[0].querySelector('.md')?.textContent).toContain('Blocks risky shell commands');
  });

  it('badge shows exactly when runsCode, with the reasons', () => {
    const p = full.plugin('fixture-full');
    expect(p.runs.runsCode).toBe(true);
    expect(view(full.catalog(), p).querySelector('.runs')?.textContent).toContain('Runs code');
    cleanup();
    const quiet = full.plugin('fixture-minimal');
    expect(view(full.catalog(), quiet).querySelector('.runs')).toBeNull();
  });
});

describe('WhatItRuns on synthetic plugins', () => {
  it('AC-30: the sentence shows with nothing to run and goes away with one hook', () => {
    const p = plugin('p');
    expect(view(catalogOf([p]), p).textContent).toContain('This plugin ships no hooks, MCP servers or scripts.');
    cleanup();
    const { cat, p: p2 } = withHook();
    expect(view(cat, p2).textContent).not.toContain('This plugin ships no hooks');
  });

  it('AC-31: tools null reads the inherit sentence; tools [] reads none; null model reads not declared', () => {
    const p = plugin('p');
    const agents = [
      { agent: 'agent:p/a', model: null, tools: null, disallowedTools: [] },
      { agent: 'agent:p/b', model: 'x', tools: [], disallowedTools: [] },
    ];
    const c = view(catalogOf([p]), { ...p, runs: { ...p.runs, agentTools: agents } });
    const [a, b] = rows(c, 't-agents');
    expect(cell(a, 'Tools')).toBe('not declared: inherits the session’s tools');
    expect(cell(a, 'Model')).toBe('not declared');
    expect(cell(b, 'Tools')).toBe('none');
  });

  it('shows the allowed-tools table only when a skill or command declares them', () => {
    const p = plugin('p');
    const s = artifact('skill', 'p', 's', { allowedTools: ['Bash'] });
    const n = artifact('skill', 'p', 'n', { allowedTools: null });
    const cat = catalogOf([p], [s, n]);
    const c = view(cat, { ...p, artifactIds: [s.id, n.id] });
    expect(rows(c, 't-tools')).toHaveLength(1);
    cleanup();
    expect(view(cat, { ...p, artifactIds: [n.id] }).querySelector('.t-tools')).toBeNull();
  });

  it('names shell artifacts, linked to their pages', () => {
    const p = plugin('p');
    const a = artifact('agent', 'p', 'sh');
    const c = view(catalogOf([p], [a]), { ...p, runs: { ...p.runs, runsCode: true, reasons: ['shell'], shellArtifacts: [a.id] } });
    expect(c.querySelector('.runs')?.textContent).toContain('agent with shell access');
    expect(c.querySelector('a[href="#/plugins/p/agent/sh"]')).not.toBeNull();
  });
});
