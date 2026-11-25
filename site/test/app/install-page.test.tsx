// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import type { Catalog } from '../../src/catalog/types.ts';
import { InstallPage } from '../../src/pages/InstallPage.tsx';
import { installHash, parseP } from '../../src/install/link.ts';
import { cliText, settingsJson } from '../../src/install/resolve.ts';
import { installStore } from '../../src/install/store.ts';
import { STORAGE_KEY } from '../../src/install/types.ts';
import { catalogOf, plugin } from '../search/fixture-catalog.ts';

const dep = (name: string, inCatalog = true, version: string | null = null) => ({ name, version, inCatalog });
const cmd = (n: string) => `claude plugin install ${n}@fixture`;
const fixture = (): Catalog => {
  const c = catalogOf([
    plugin('a', { dependencies: [dep('b')], installCommand: cmd('a') }),
    plugin('b', { dependencies: [dep('c')], installCommand: cmd('b') }),
    plugin('c', { installCommand: cmd('c') }),
    plugin('d', { dependencies: [dep('outside', false, '^1.0')], installCommand: cmd('d') }),
  ]);
  c.marketplace.addCommand = 'claude plugin marketplace add o/r';
  return c;
};

beforeEach(() => {
  localStorage.clear();
  installStore.reset();
  history.replaceState(null, '', '#/install');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const view = (c = fixture()) => render(<InstallPage catalog={c} />).container;
const boxes = (c: HTMLElement) => [...c.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
const texts = (c: HTMLElement) => [...c.querySelectorAll('code.cmd-text')].map((x) => x.textContent);
const status = (c: HTMLElement) => c.querySelector('[role=status]');
const stored = () => localStorage.getItem(STORAGE_KEY);

describe('InstallPage', () => {
  it('ticking A checks B and C as dependencies and the header pill shows 3 (AC-38a)', async () => {
    history.replaceState(null, '', '#/install');
    const c0 = fixture();
    const { container } = render(<App load={() => Promise.resolve(c0)} />);
    await waitFor(() => expect(boxes(container)).toHaveLength(4));
    fireEvent.click(boxes(container)[0]);
    expect(boxes(container).map((b) => b.checked)).toEqual([true, true, true, false]);
    expect(boxes(container).map((b) => b.disabled)).toEqual([false, true, true, false]);
    const labels = [...container.querySelectorAll('.auto-label')].map((x) => x.textContent);
    expect(labels).toEqual(['added for a', 'added for b']);
    expect(container.querySelector('.hdr .count-pill.on')?.textContent).toBe('3');
  });

  it('warns about a dependency that is not in the catalog (AC-38b)', () => {
    const c = view();
    fireEvent.click(boxes(c)[3]);
    const warn = c.querySelector('.notice.warn');
    expect(warn?.textContent).toContain('outside ^1.0 — not in this marketplace');
    expect(warn?.textContent).toContain('d needs it');
  });

  it('shows the CLI and settings text from the library for both scopes (AC-39, AC-40)', () => {
    const cat = fixture();
    const c = view(cat);
    expect(c.querySelector('code.cmd-text')).toBeNull();
    fireEvent.click(boxes(c)[0]);
    expect(texts(c)).toEqual([cliText(cat, ['a', 'b', 'c'], 'user'), settingsJson(cat, ['a', 'b', 'c'])]);
    expect(texts(c)[0]).not.toContain('--scope');
    fireEvent.click(screen.getByRole('button', { name: 'Project' }));
    expect(texts(c)[0]).toBe(cliText(cat, ['a', 'b', 'c'], 'project'));
    expect(texts(c)[0]!.split('\n').every((l) => l.endsWith(' --scope project'))).toBe(true);
    expect(screen.getByRole('button', { name: 'Project' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a checkbox edit writes storage and replaces the hash (AC-41a, AC-41b)', () => {
    const c = view();
    fireEvent.click(boxes(c)[2]);
    expect(stored()).toBe('["c"]');
    expect(location.hash).toBe(installHash(['c']));
    fireEvent.click(boxes(c)[0]);
    expect(location.hash).toBe('#/install?p=a,c');
  });

  it('?p= previews without touching storage until the first tick (AC-41c)', () => {
    localStorage.setItem(STORAGE_KEY, '["a"]');
    installStore.reset();
    history.replaceState(null, '', '#/install?p=c');
    const c = view();
    expect(boxes(c).map((b) => b.checked)).toEqual([false, false, true, false]);
    expect(stored()).toBe('["a"]');
    fireEvent.click(boxes(c)[3]);
    expect(stored()).toBe('["c","d"]');
  });

  it('leaving #/install drops an unedited ?p= preview, so an edit elsewhere keeps the stored set (Decision 3)', async () => {
    localStorage.setItem(STORAGE_KEY, '["a"]');
    installStore.reset();
    history.replaceState(null, '', '#/install?p=c');
    const { container } = render(<App load={() => Promise.resolve(fixture())} />);
    await waitFor(() => expect(boxes(container)).toHaveLength(4));
    expect(container.querySelector('.hdr .count-pill')?.textContent).toBe('1');
    location.hash = '#/plugins/d';
    await waitFor(() => expect(container.querySelector('.hdr .count-pill')?.textContent).toBe('3'));
    expect(stored()).toBe('["a"]');
    fireEvent.click(screen.getByRole('button', { name: /Add to install set/ }));
    expect(JSON.parse(stored()!)).toEqual(['a', 'd']);
  });

  it('the header never shows the stored set before a ?p= preview (AC-41c, no flash)', async () => {
    localStorage.setItem(STORAGE_KEY, '["a"]');
    installStore.reset();
    history.replaceState(null, '', '#/install?p=c');
    const seen: string[] = [];
    const mo = new MutationObserver(() => {
      if (document.querySelectorAll('input[type=checkbox]').length === 4) seen.push(document.querySelector('.hdr .count-pill')?.textContent ?? '');
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    const { container } = render(<App load={() => Promise.resolve(fixture())} />);
    await waitFor(() => expect(boxes(container)).toHaveLength(4));
    mo.disconnect();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v === '1')).toBe(true);
  });

  it('names dropped names in one status line, bounded (EC-6)', () => {
    history.replaceState(null, '', '#/install?p=a,ghost');
    const c = view();
    expect(c.querySelectorAll('[role=status]')).toHaveLength(1);
    expect(status(c)?.textContent).toContain('ghost');
    cleanup();

    installStore.reset();
    const long = (i: number) => `${'x'.repeat(50)}${i}`;
    const hash = `#/install?p=${[long(1), long(2), long(3), ...Array.from({ length: 1000 }, (_, i) => `g${i}`)].join(',')}`;
    const parsed = parseP(hash)!;
    expect(parsed.names).toHaveLength(200);
    history.replaceState(null, '', hash);
    const c2 = view();
    const text = status(c2)?.textContent ?? '';
    expect(c2.querySelectorAll('[role=status]')).toHaveLength(1);
    expect(text).toContain(` and ${200 - 5 + parsed.ignored} more.`);
    const named = text.replace(/^[^:]*: /, '').replace(/ and \d+ more\.$/, '').split(', ');
    expect(named).toHaveLength(5);
    expect(named.every((n) => n.length <= 40)).toBe(true);
    fireEvent.click(boxes(c2)[0]);
    expect(status(c2)).toBeNull();
  });

  it('shows the same notice for a stored name that left the catalog (EC-6)', () => {
    localStorage.setItem(STORAGE_KEY, '["ghost"]');
    installStore.reset();
    history.replaceState(null, '', '#/install');
    expect(status(view())?.textContent).toContain('ghost');
  });

  it('keeps working when storage throws (EC-7)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    installStore.reset();
    const cat = fixture();
    const { container: c, rerender } = render(<InstallPage catalog={cat} />);
    fireEvent.click(boxes(c)[0]);
    rerender(<InstallPage catalog={cat} />);
    expect(boxes(c)[0].checked).toBe(true);
    expect(c.querySelector('[role=alert]')).toBeNull();
  });
});
