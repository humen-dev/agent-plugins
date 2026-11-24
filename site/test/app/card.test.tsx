// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card } from '../../src/ui/Card.tsx';
import { createSearch } from '../../src/search/search.ts';
import { artifact, catalogOf, md, plugin } from '../search/fixture-catalog.ts';

afterEach(cleanup);

const p = plugin('fixture-alpha', {
  description: 'Handles migrations safely', category: 'backend', installCommand: 'claude plugin install fixture-alpha@fixture',
});
const skill = artifact('skill', 'fixture-alpha', 'fixture-migrate', {
  description: 'Run migrations', invokeAs: '/fixture-alpha:fixture-migrate', argumentHint: '[app]', userInvokedOnly: true,
  files: [{ path: 'plugins/fixture-alpha/skills/fixture-migrate/notes.md', title: 'n', body: md('plugins/fixture-alpha/skills/fixture-migrate/notes.md', 'only here: zebrafish') }],
});
const hook = artifact('hook', 'fixture-alpha', 'fixture-guard', { description: 'Guards', event: 'PreToolUse' });
const cat = catalogOf([p], [skill, hook]);
const cards = (q: string) => createSearch(cat).run({ q, kinds: [], cats: [] }).cards;

describe('Card', () => {
  it('shows badge, name link, plugin link on artifact cards only, category, description and install copy button', () => {
    const [c] = cards(''); // empty query + no filter: plugin cards only
    const { container, unmount } = render(<Card card={c} />);
    expect(container.querySelector('.badge')?.textContent).toBe('Plugin');
    expect(screen.getByRole('link', { name: 'fixture-alpha' }).getAttribute('href')).toBe('#/plugins/fixture-alpha');
    expect(container.querySelector('.meta a')).toBeNull();
    expect(container.querySelector('.meta')?.textContent).toBe('backend');
    expect(container.querySelector('.desc')?.textContent).toBe('Handles migrations safely');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(container.querySelector('.cmd-text')?.textContent).toBe(p.installCommand);
    unmount();

    render(<Card card={createSearch(cat).run({ q: '', kinds: ['skill'], cats: [] }).cards[0]} />);
    expect(screen.getByRole('link', { name: 'fixture-migrate' }).getAttribute('href')).toBe('#/plugins/fixture-alpha/skill/fixture-migrate');
    expect(screen.getByRole('link', { name: 'fixture-alpha' }).getAttribute('href')).toBe('#/plugins/fixture-alpha');
  });

  it('truncates the description to 160 chars', () => {
    const long = plugin('fixture-long', { description: 'word '.repeat(80) });
    const [c] = createSearch(catalogOf([long])).run({ q: '', kinds: [], cats: [] }).cards;
    const { container } = render(<Card card={c} />);
    expect(container.querySelector('.desc')!.textContent!.length).toBeLessThanOrEqual(160);
  });

  it('marks matched words in name and description only', () => {
    const c = cards('migrations').find((x) => x.kind === 'skill')!;
    const { container } = render(<Card card={c} />);
    const marks = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    expect(marks).toEqual(['migrations']);
    expect(container.querySelector('h3')!.querySelector('mark')).toBeNull();
  });

  it('shows invokeAs, argumentHint and the user-only label on a skill, nothing on a hook', () => {
    const sk = createSearch(cat).run({ q: '', kinds: ['skill'], cats: [] }).cards[0];
    const a = render(<Card card={sk} />);
    expect(a.container.querySelector('.invoke code')?.textContent).toBe('/fixture-alpha:fixture-migrate');
    expect(a.container.querySelector('.arghint')?.textContent).toBe('[app]');
    expect(screen.getByText('User-invoked only')).toBeTruthy();
    a.unmount();
    const hk = createSearch(cat).run({ q: '', kinds: ['hook'], cats: [] }).cards[0];
    const b = render(<Card card={hk} />);
    expect(b.container.querySelector('.invoke')).toBeNull();
    expect(b.container.querySelector('.cat-label')).toBeNull();
  });

  it('shows the snippet with its file label for a body-only match', () => {
    const c = cards('zebrafish').find((x) => x.kind === 'skill')!;
    const { container } = render(<Card card={c} />);
    expect(container.querySelector('.desc')?.textContent).toContain('zebrafish');
    expect(container.querySelector('.src code')?.textContent).toBe('skills/fixture-migrate/notes.md');
  });

  it('renders hostile text as text, with no img element', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const h = plugin('fixture-evil', { description: evil, tags: [evil], category: evil });
    const [c] = createSearch(catalogOf([h])).run({ q: '', kinds: [], cats: [] }).cards;
    const { container } = render(<Card card={c} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.desc')?.textContent).toBe(evil);
    expect(container.querySelector('.meta')?.textContent).toBe(evil);
  });

  it('lists the runs labels when the plugin runs code', () => {
    const r = plugin('fixture-runs', { runs: { ...plugin('x').runs, runsCode: true, reasons: ['hooks', 'shell'], shellArtifacts: ['agent:fixture-runs/a'] } });
    const [c] = createSearch(catalogOf([r])).run({ q: '', kinds: [], cats: [] }).cards;
    const { container } = render(<Card card={c} />);
    expect(container.querySelector('.runs')?.textContent).toBe('Runs code· hooks, agent with shell access');
  });
});
