// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Change } from '../../src/catalog/types.ts';
import { NewPage } from '../../src/pages/NewPage.tsx';
import { catalogOf, plugin } from '../search/fixture-catalog.ts';

afterEach(cleanup);
beforeEach(() => { location.hash = '#/new'; });

const ch = (commit: string, date: string, pluginName: string, o: Partial<Change> = {}): Change => ({
  commit, date, subject: `s-${commit}`, plugin: pluginName, type: 'change', version: null, url: `https://github.com/o/r/commit/${commit}`, ...o,
});
const changes: Change[] = [
  ch('a1', '2026-03-03T10:00:00Z', 'a', { type: 'version', version: { from: '1.0.0', to: '1.1.0' } }),
  ch('b2', '2026-03-02T23:30:00-02:00', 'b'), // 01:30Z on 03-03 → same UTC day as a1
  ch('c3', '2026-03-02T10:00:00Z', 'a'),
  ch('d4', '2026-03-01T10:00:00Z', 'spec-creator', { type: 'added', version: { from: null, to: '0.1.0' } }),
  ch('e5', '2026-02-28T10:00:00Z', 'a', { subject: '<img src=x onerror=1>' }),
];
const catalog = () => ({ ...catalogOf([plugin('a'), plugin('b')]), changes });
const view = () => render(<NewPage catalog={catalog()} />).container;
const days = (c: HTMLElement) => [...c.querySelectorAll('h2.day-h time')].map((x) => x.textContent);

describe('NewPage', () => {
  it('groups by UTC day in catalog order (AC-42)', () => {
    const c = view();
    expect(days(c)).toEqual(['2026-03-03', '2026-03-02', '2026-03-01', '2026-02-28']);
    const rows = c.querySelectorAll('.chg');
    expect(rows[0].querySelector('.ctype')?.textContent).toContain('1.0.0 → 1.1.0');
    expect(rows[0].querySelector('a[href="https://github.com/o/r/commit/a1"]')).toBeTruthy();
    expect(rows[0].querySelector('a.nm')?.textContent).toBe('a');
  });

  it('filters by ?plugin= and by chip, ignores an unknown name (AC-43)', () => {
    location.hash = '#/new?plugin=ghost';
    expect(view().querySelectorAll('.chg').length).toBe(5);
    cleanup();
    location.hash = '#/new?plugin=a';
    const c = view();
    expect(c.querySelectorAll('.chg').length).toBe(3);
    fireEvent.click([...c.querySelectorAll('button.chip')].find((b) => b.textContent?.startsWith('b'))!);
    expect(c.querySelectorAll('.chg').length).toBe(1);
    expect(location.hash).toBe('#/new?plugin=b');
    fireEvent.click(c.querySelector('button.chip')!);
    expect(c.querySelectorAll('.chg').length).toBe(5);
    expect(location.hash).toBe('#/new');
    expect(c.querySelector('[role="status"]')?.textContent).toBe('5 changes on 4 days');
  });

  it('shows a name outside the catalog as text with a suffix (AC-69)', () => {
    const old = view().querySelector('.chg .old')!;
    expect(old.textContent).toBe('spec-creator (old name)');
    expect(old.closest('a')).toBeNull();
  });

  it('renders a hostile subject as text (UT-3)', () => {
    const c = view();
    expect(c.querySelector('img')).toBeNull();
    expect(c.textContent).toContain('<img src=x onerror=1>');
  });
});
