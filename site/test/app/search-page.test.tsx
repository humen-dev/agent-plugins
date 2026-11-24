// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import { SearchPage } from '../../src/pages/SearchPage.tsx';
import { artifact, catalogOf, plugin } from '../search/fixture-catalog.ts';

const cat = catalogOf(
  [
    plugin('fixture-celery', { description: 'Celery workers', category: 'backend', tags: ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'] }),
    plugin('fixture-docs', { description: 'Write documentation', category: 'docs' }),
  ],
  [artifact('skill', 'fixture-celery', 'fixture-planner', { description: 'Plan the queue' })],
);

const go = (hash: string) => history.replaceState(null, '', hash); // no hashchange event
const names = () => [...document.querySelectorAll('.card h3')].map((h) => h.textContent);
const box = () => screen.getByRole('searchbox') as HTMLInputElement;
const type = async (v: string) => {
  fireEvent.change(box(), { target: { value: v } });
  await act(async () => { vi.advanceTimersByTime(120); });
};

beforeEach(() => { vi.useFakeTimers(); go('#/'); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('SearchPage', () => {
  it('lists every plugin by name for an empty query, then ranks after the 120 ms debounce and writes the hash', async () => {
    render(<SearchPage catalog={cat} onQuery={vi.fn()} />);
    expect(names()).toEqual(['fixture-celery', 'fixture-docs']);
    expect(screen.getByRole('status').textContent).toBe('2 results, sorted by name');
    fireEvent.change(box(), { target: { value: 'documentation' } });
    act(() => { vi.advanceTimersByTime(119); });
    expect(names()).toHaveLength(2);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(names()).toEqual(['fixture-docs']);
    expect(screen.getByRole('status').textContent).toBe('1 result, best match first');
    expect(location.hash).toBe('#/?q=documentation');
  });

  it('restores q, kind and cat from the hash', () => {
    go('#/?q=celery&kind=plugin&cat=backend&kind=bogus');
    render(<SearchPage catalog={cat} onQuery={vi.fn()} />);
    expect(box().value).toBe('celery');
    expect(screen.getByRole('button', { name: /^Plugin/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^backend/ }).getAttribute('aria-pressed')).toBe('true');
    expect(names()).toEqual(['fixture-celery']);
  });

  it('EC-1: "I need a skill" selects the Skill chip once and keeps q', async () => {
    render(<SearchPage catalog={cat} onQuery={vi.fn()} />);
    await type('I need a skill');
    const chip = screen.getByRole('button', { name: /^Skill/ });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(location.hash).toBe('#/?q=I%20need%20a%20skill&kind=skill');
    fireEvent.click(chip);
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('button', { name: /^Skill/ }).getAttribute('aria-pressed')).toBe('false');
    expect(location.hash).toBe('#/?q=I%20need%20a%20skill');
  });

  const panel = () => document.querySelector('.state-panel') as HTMLElement;

  it('shows at most 5 tags and a prefilled request link when nothing matches, without Clear filters', async () => {
    const onQuery = vi.fn();
    render(<SearchPage catalog={cat} onQuery={onQuery} />);
    await type('zzzzqx');
    expect(onQuery).toHaveBeenLastCalledWith('zzzzqx');
    expect(panel().querySelectorAll('a.tag')).toHaveLength(5);
    expect(panel().querySelector('a.tag')?.getAttribute('href')).toBe('#/?q=a1');
    expect(panel().querySelector('a.btn.primary')?.getAttribute('href')).toContain('what=zzzzqx');
    expect(panel().textContent).not.toContain('Clear filters');
  });

  it('with filters the empty state offers Clear filters, which keeps q', () => {
    go('#/?q=zzzzqx&cat=docs');
    render(<SearchPage catalog={cat} onQuery={vi.fn()} />);
    expect(panel().querySelector('a.btn.primary')?.getAttribute('href')).toContain('what=zzzzqx');
    fireEvent.click(panel().querySelector('button.btn') as HTMLElement);
    expect(box().value).toBe('zzzzqx');
    expect(location.hash).toBe('#/?q=zzzzqx');
    expect(panel().textContent).not.toContain('Clear filters');
  });

  it('"/" focuses the box from outside a field and Esc in the box clears it', async () => {
    render(<SearchPage catalog={cat} onQuery={vi.fn()} />);
    await type('celery');
    document.body.focus();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(box());
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(box().value).toBe('');
    expect(names()).toEqual(['fixture-celery', 'fixture-docs']);
    expect(location.hash).toBe('#/');
  });

  it('follows a tag link (hashchange) and re-reads the query', async () => {
    render(<SearchPage catalog={cat} onQuery={vi.fn()} />);
    go('#/?q=documentation');
    await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(box().value).toBe('documentation');
    expect(names()).toEqual(['fixture-docs']);
  });
});

describe('App search wiring', () => {
  beforeEach(() => vi.useRealTimers());

  it('passes the committed query to the header and footer request links', async () => {
    render(<App load={() => Promise.resolve(cat)} />);
    await screen.findByRole('contentinfo');
    fireEvent.change(box(), { target: { value: 'zzzzqx' } });
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Request a skill/ }).every((a) => a.getAttribute('href')!.includes('what=zzzzqx'))).toBe(true));
  });

  it('"/" on another route goes to the search page and focuses the box', async () => {
    go('#/install');
    render(<App load={() => Promise.resolve(cat)} />);
    await screen.findByRole('contentinfo');
    fireEvent.keyDown(document.body, { key: '/' });
    await waitFor(() => expect(document.activeElement).toBe(box()));
    expect(location.hash).toBe('#/');
  });
});
