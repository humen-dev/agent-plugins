// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { utcDay } from '../../src/format.ts';
import { PluginPage } from '../../src/pages/PluginPage.tsx';
import { artifactHash } from '../../src/links/hash.ts';
import { catalogOf, plugin } from '../search/fixture-catalog.ts';
import { useFullCatalog } from './fixture-full.ts';

afterEach(cleanup);
const full = useFullCatalog();
const view = (name = 'fixture-full') => render(<PluginPage catalog={full.catalog()} plugin={full.plugin(name)} />).container;
const h2s = (c: HTMLElement) => [...c.querySelectorAll('h2')].map((h) => h.textContent);

describe('PluginPage on fixture-full (AC-27a, AC-28)', () => {
  it('shows every element of the page', () => {
    const c = view();
    const p = full.plugin('fixture-full');
    expect(c.querySelector('h1')?.textContent).toBe('fixture-full');
    const facts = c.querySelector('.facts-line')?.textContent ?? '';
    expect(facts).toContain('1.2.0');
    expect(facts).toContain('Full Author');
    expect(facts).toContain('MIT');
    expect(facts).toContain(`Updated${utcDay(p.updated!)}`);
    expect(c.querySelector('.ph .runs')?.textContent).toContain('Runs code');
    expect(screen.getByRole('button', { name: 'See what it runs' })).toBeTruthy();
    expect(c.querySelector('.lead')?.textContent).toBe(p.summary);
    const boxes = [...c.querySelectorAll('.side code.cmd-text')];
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['Add marketplace command', 'Install plugin command']);
    expect(boxes.map((b) => b.textContent)).toEqual([full.catalog().marketplace.addCommand, p.installCommand]);
    for (const h of ['What it adds', 'Dependencies', 'What it runs', 'README', 'Third-party notices', 'Install', 'Links', 'Tags']) {
      expect(h2s(c).some((x) => x?.startsWith(h)), h).toBe(true);
    }
    expect(c.textContent).toContain('Recent changes');
    expect(c.querySelector('details.coll')?.hasAttribute('open')).toBe(false);
    expect(c.querySelector('.chg-list li')).not.toBeNull();
    const hrefs = [...c.querySelectorAll('.side a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining([p.sourceUrl, 'https://example.com/home', 'https://github.com/example/full']));
    expect(c.querySelector('a[href="#/new?plugin=fixture-full"]')).not.toBeNull();
    expect(c.querySelector('.side a.tag')?.getAttribute('href')).toMatch(/^#\/\?q=/);
  });

  it('links every artifact to its page, one row each', () => {
    const c = view();
    const p = full.plugin('fixture-full');
    const rows = [...c.querySelectorAll('.t-arts .tr:not(.head)')];
    expect(rows).toHaveLength(p.artifactIds.length);
    const links = rows.map((r) => r.querySelector('a[href^="#/plugins/"]')?.getAttribute('href'));
    const expected = p.artifactIds.map((id) => artifactHash(full.catalog().artifacts.find((a) => a.id === id)!));
    expect([...links].sort()).toEqual([...expected].sort());
    // Kind order: skills before agents before hooks
    const kinds = rows.map((r) => r.querySelector('.badge')?.getAttribute('data-kind'));
    expect(kinds).toEqual([...kinds].sort((a, b) => ['skill', 'agent', 'command', 'hook', 'mcp'].indexOf(a!) - ['skill', 'agent', 'command', 'hook', 'mcp'].indexOf(b!)));
  });

  it('EC-5: a dependency outside the catalog is plain text with a notice, one inside is a link', () => {
    const c = view();
    expect(c.querySelector('a.nm[href="#/plugins/fixture-minimal"]')).not.toBeNull();
    const out = [...c.querySelectorAll('.cb-row')].find((r) => r.textContent?.includes('outside-dep'))!;
    expect(out.querySelector('a')).toBeNull();
    expect(out.textContent).toContain('not in this marketplace');
    expect(c.querySelector('.notice')?.textContent).toContain('A dependency is not in this marketplace');
  });

  it('focuses the What it runs section from the badge control', () => {
    const c = view();
    fireEvent.click(screen.getByRole('button', { name: 'See what it runs' }));
    expect(document.activeElement).toBe(c.querySelector('#what-it-runs'));
  });
});

describe('PluginPage on a minimal plugin (AC-27b, EC-4)', () => {
  const bare = plugin('bare');
  const c = () => render(<PluginPage catalog={catalogOf([bare])} plugin={bare} />).container;

  it('omits every optional element and shows no empty heading', () => {
    const el = c();
    expect(h2s(el)).toEqual(['What it adds', 'What it runs', 'Install', 'Links']);
    for (const h of el.querySelectorAll('h1, h2, h3')) expect((h.textContent ?? '').trim()).not.toBe('');
    expect(el.querySelector('.facts-line')).toBeNull();
    expect(el.querySelector('.ph .runs')).toBeNull();
    expect(el.querySelector('.cat-label')).toBeNull();
    expect(el.querySelector('details')).toBeNull();
    expect(el.querySelector('.chg-list')).toBeNull();
    expect(el.querySelector('.notice')).toBeNull();
    expect(el.querySelector('a.tag')).toBeNull();
  });

  it('EC-4: zero artifacts give the sentence and no table', () => {
    const el = c();
    expect(el.textContent).toContain('This plugin adds no skills, agents, commands, hooks or MCP servers');
    expect(el.querySelector('.t-arts')).toBeNull();
  });
});
