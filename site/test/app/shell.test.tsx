// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import type { Catalog } from '../../src/catalog/types.ts';
import { Footer } from '../../src/ui/Footer.tsx';
import { Header } from '../../src/ui/Header.tsx';
import { catalogOf, plugin } from '../search/fixture-catalog.ts';

const catalog = (): Catalog => ({
  ...catalogOf([plugin('alpha')]),
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = 'dark';
  window.location.hash = '';
});
afterEach(cleanup);

describe('theme toggle', () => {
  it('flips data-theme, stores the choice and exposes aria-pressed only in light', () => {
    render(<Header route="home" repoUrl={null} />);
    const btn = screen.getByRole('button', { name: 'Light theme' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('catalog.theme')).toBe('light');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('still flips when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<Header route="home" repoUrl={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    vi.restoreAllMocks();
  });

  it('has no external links before the catalog is there', () => {
    render(<Header route="home" repoUrl={null} />);
    expect(screen.queryByText(/GitHub/)).toBeNull();
  });
});

describe('footer', () => {
  it('shows name, version, short sha and the UTC day, whatever the commit offset', () => {
    const c = catalog();
    c.marketplace.name = 'humen-dev';
    c.marketplace.version = '1.2.3';
    c.build = { commit: 'abcdef0123456789', commitDate: '2026-03-05T01:30:00+09:00' };
    render(<Footer catalog={c} />);
    const f = screen.getByRole('contentinfo');
    expect(f.textContent).toContain('humen-dev marketplace 1.2.3');
    expect(f.textContent).toContain('abcdef0');
    expect(f.textContent).not.toContain('abcdef01');
    expect(screen.getByText('2026-03-04').tagName).toBe('TIME');
    expect(screen.getByText('abcdef0').closest('a')?.getAttribute('href')).toBe('https://github.com/o/r/commit/abcdef0123456789');
  });
});

describe('App states', () => {
  it('shows skeleton cards while the catalog is pending', () => {
    render(<App load={() => new Promise(() => {})} />);
    expect(screen.getByLabelText('Loading results').querySelectorAll('.skel')).toHaveLength(6);
  });

  it('shows the error with Retry that calls reload', async () => {
    const reload = vi.fn();
    render(<App load={() => Promise.reject(new Error('x'))} reload={reload} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('renders the home heading, placeholders and not-found by hash', async () => {
    const c = catalog();
    render(<App load={() => Promise.resolve(c)} />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Find a plugin, skill, agent or hook');
    await act(async () => { window.location.hash = '#/plugins/alpha'; });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('alpha'));
    await act(async () => { window.location.hash = '#/plugins/ghost'; });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Page not found'));
    expect(screen.getByRole('link', { name: 'Back to search' }).getAttribute('href')).toBe('#/');
    await act(async () => { window.location.hash = '#/install'; });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Install set'));
  });

  it('renders no img and no foreign URL', async () => {
    const { container } = render(<App load={() => Promise.resolve(catalog())} />);
    await screen.findByRole('contentinfo');
    expect(container.querySelector('img')).toBeNull();
    for (const el of container.querySelectorAll('[src]')) expect(el.getAttribute('src')).toMatch(/^(\/|data:)/);
  });
});
