// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ArtifactPage } from '../../src/pages/ArtifactPage.tsx';
import { PluginPage } from '../../src/pages/PluginPage.tsx';
import { SearchPage } from '../../src/pages/SearchPage.tsx';
import { EmptyState } from '../../src/ui/EmptyState.tsx';
import { Footer } from '../../src/ui/Footer.tsx';
import { Header } from '../../src/ui/Header.tsx';
import { artifact, catalogOf, plugin } from '../search/fixture-catalog.ts';
import { useFullCatalog } from './fixture-full.ts';

afterEach(cleanup);

const cat = catalogOf([plugin('fixture-alpha', { description: 'Alpha' })], [artifact('skill', 'fixture-alpha', 'fixture-s')]);
const repo = 'https://github.com/o/r';

const crossOrigin = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((a) => new URL(a.href, location.href).origin !== location.origin);

// NFR-14: every rendered link to another origin carries rel="noopener noreferrer"
describe('external links', () => {
  const cases: [string, () => React.ReactElement][] = [
    ['Header', () => <Header route="home" repoUrl={repo} />],
    ['Footer', () => <Footer catalog={cat} />],
    ['result list', () => <SearchPage catalog={cat} onQuery={() => {}} />],
    ['EmptyState', () => <EmptyState query="zzz" hasFilters={false} tags={['a']} repoUrl={repo} onClear={() => {}} />],
  ];
  for (const [name, el] of cases) {
    it(`${name}: cross-origin links have rel noopener noreferrer`, () => {
      const { container } = render(el());
      const links = crossOrigin(container);
      if (name !== 'result list') expect(links.length).toBeGreaterThan(0);
      for (const a of links) {
        const rel = (a.getAttribute('rel') ?? '').split(/\s+/);
        expect(rel, a.href).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
      }
    });
  }
});

describe('external links on the plugin and artifact pages', () => {
  const full = useFullCatalog();
  it('every cross-origin link has rel noopener noreferrer', () => {
    const catalog = full.catalog();
    const p = full.plugin('fixture-full');
    const els = [
      <PluginPage catalog={catalog} plugin={p} />,
      ...catalog.artifacts.filter((a) => a.plugin === p.name).map((a) => <ArtifactPage catalog={catalog} plugin={p} artifact={a} />),
    ];
    for (const el of els) {
      const { container } = render(el);
      const links = crossOrigin(container);
      expect(links.length).toBeGreaterThan(0);
      for (const a of links) {
        expect((a.getAttribute('rel') ?? '').split(/\s+/), a.href).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
      }
      cleanup();
    }
  });
});
