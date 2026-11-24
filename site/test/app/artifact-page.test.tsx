// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Agent, Artifact, Hook, McpServer, Plugin, Skill } from '../../src/catalog/types.ts';
import { blobUrl, treeUrl } from '../../src/links/source-url.ts';
import { ArtifactPage } from '../../src/pages/ArtifactPage.tsx';
import { useFullCatalog } from './fixture-full.ts';

afterEach(cleanup);
const full = useFullCatalog();
const plug = () => full.plugin('fixture-full');
const first = <T extends Artifact>(kind: T['kind']) => {
  const a = full.catalog().artifacts.find((x) => x.plugin === 'fixture-full' && x.kind === kind);
  if (!a) throw new Error(`no ${kind}`);
  return a as T;
};
const view = (a: Artifact, p: Plugin = plug()) => render(<ArtifactPage catalog={full.catalog()} plugin={p} artifact={a} />).container;
const facts = (c: HTMLElement) => Object.fromEntries([...c.querySelectorAll('.facts dt')].map((dt) => [dt.textContent, dt.nextElementSibling as HTMLElement]));

describe('ArtifactPage on fixture-full (AC-34a)', () => {
  for (const kind of ['skill', 'agent', 'command', 'hook', 'mcp'] as const) {
    it(`${kind}: breadcrumb, badge, facts, install command, source link`, () => {
      const a = first(kind);
      const c = view(a);
      const crumbs = [...c.querySelectorAll('.crumbs li')];
      expect(crumbs.map((l) => l.textContent)).toEqual(['fixture-full', expect.any(String), a.name]);
      expect(crumbs[0].querySelector('a')?.getAttribute('href')).toBe('#/plugins/fixture-full');
      expect(crumbs[1].querySelector('a')?.getAttribute('href')).toBe(`#/?kind=${kind}`);
      expect(crumbs[2].querySelector('[aria-current="page"]')).not.toBeNull();
      expect(c.querySelector('.ph .badge')?.getAttribute('data-kind')).toBe(kind);
      expect(c.querySelector('h1')?.textContent).toBe(a.name);
      if (a.description !== '') expect(c.querySelector('.lead')?.textContent).toBe(a.description);
      if (a.invokeAs !== null) expect(c.querySelector('.invoke code')?.textContent).toBe(a.invokeAs);
      expect(facts(c).Plugin.textContent).toBe('fixture-full 1.2.0');
      expect(c.querySelector('.side code.cmd-text')?.textContent).toBe(plug().installCommand);
      expect(c.querySelector('.side a[href]:not([href^="#"])')?.getAttribute('href')).toBe(a.sourceUrl);
      expect(c.querySelector('a[href="#/plugins/fixture-full"]')).not.toBeNull();
      const hasBody = kind === 'skill' || kind === 'agent' || kind === 'command';
      expect(!!c.querySelector('#art-body')).toBe(hasBody && a.body !== null);
    });
  }

  it('skill supporting files are closed details with rendered Markdown and a blob link', () => {
    const a = first<Skill>('skill');
    const withFiles = full.catalog().artifacts.find((x) => x.kind === 'skill' && x.files.length > 0)!;
    const c = view(withFiles);
    const colls = [...c.querySelectorAll('details.coll')];
    expect(colls).toHaveLength(withFiles.files.length);
    for (const [i, d] of colls.entries()) {
      expect(d.hasAttribute('open')).toBe(false);
      expect(d.querySelector('.coll-body')?.children.length).toBeGreaterThan(1);
      expect(d.querySelector('a[href^="https://github.com/"]')?.getAttribute('href')).toBe(blobUrl(full.catalog(), withFiles.files[i].path));
    }
    expect(a).toBeTruthy();
  });

  it('hook and MCP show Defined in, Scripts and Command per the facts table, no body', () => {
    const h = first<Hook>('hook');
    const ch = view(h);
    expect(facts(ch).Event.textContent).toBe(h.event);
    expect(facts(ch)['Defined in'].querySelector('a')?.getAttribute('href')).toBe(blobUrl(full.catalog(), h.definedIn));
    if (h.command !== null) expect(facts(ch).Command.querySelector('code.cmd-block')?.textContent).toBe(h.command);
    for (const [i, s] of h.scripts.entries()) {
      expect(facts(ch).Scripts.querySelectorAll('a')[i].getAttribute('href')).toBe(blobUrl(full.catalog(), s));
    }
    expect(ch.querySelector('#art-body')).toBeNull();
    cleanup();
    const m = first<McpServer>('mcp');
    const cm = view(m);
    expect(facts(cm).Transport).toBeTruthy();
    expect(facts(cm)['Defined in'].querySelector('a')?.getAttribute('href')).toBe(blobUrl(full.catalog(), m.definedIn));
    expect(cm.querySelector('#art-body')).toBeNull();
  });

  it('AC-34b: frontmatter has one row per key, values verbatim, arrays one "- x" line each', () => {
    const a = first<Agent>('agent');
    const c = view(a);
    const rows = [...c.querySelectorAll('.t-fm .tr:not(.head)')];
    expect(rows).toHaveLength(Object.keys(a.frontmatter).length);
    for (const r of rows) {
      const key = r.querySelector('code')!.textContent!;
      const v = a.frontmatter[key];
      expect(r.querySelector('.fm-val')?.textContent).toBe(Array.isArray(v) ? v.map((x) => `- ${x}`).join('\n') : String(v));
    }
  });

  it('AC-35: source and file links equal blobUrl; plugin source equals treeUrl', () => {
    const cat = full.catalog();
    expect(plug().sourceUrl).toBe(treeUrl(cat, plug().path));
    const s = first<Skill>('skill');
    expect(s.sourceUrl).toBe(blobUrl(cat, s.path));
  });

  it('AC-31 / Decision 10: tools null reads the inherit text; preloaded skills link only when in the catalog', () => {
    const a = first<Agent>('agent');
    const c = view({ ...a, tools: null, model: null, preloadedSkills: ['fixture-full:alpha', 'nobody:nothing'] });
    expect(facts(c).Tools.textContent).toBe('not declared: inherits the session’s tools');
    expect(facts(c).Model.textContent).toBe('not declared');
    const pre = facts(c)['Preloaded skills'];
    expect(pre.querySelector('a')?.getAttribute('href')).toBe('#/plugins/fixture-full/skill/alpha');
    expect(pre.querySelectorAll('a')).toHaveLength(1);
    expect(pre.textContent).toContain('nobody:nothing');
    cleanup();
    expect(facts(view({ ...a, tools: [] })).Tools.textContent).toBe('none');
  });

  it('Decision 7: the shell badge shows only for an id in shellArtifacts', () => {
    const [s1, s2] = full.catalog().artifacts.filter((x) => x.plugin === 'fixture-full' && x.kind === 'skill');
    const p = { ...plug(), runs: { ...plug().runs, shellArtifacts: [s1.id] } };
    expect(view(s1, p).querySelector('.ph .runs')?.textContent).toContain('Runs code');
    cleanup();
    expect(view(s2, p).querySelector('.ph .runs')).toBeNull();
  });
});
