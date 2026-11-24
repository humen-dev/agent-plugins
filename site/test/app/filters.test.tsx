// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchState } from '../../src/search/search.ts';
import { Filters } from '../../src/ui/Filters.tsx';
import { artifact, catalogOf, plugin } from '../search/fixture-catalog.ts';

afterEach(cleanup);

const cat = catalogOf(
  [plugin('fixture-a', { category: 'backend' }), plugin('fixture-b', { category: 'docs' })],
  [artifact('skill', 'fixture-a', 'fixture-s')],
);
const empty: SearchState = { q: '', kinds: [], cats: [] };
const counts = { kindCounts: { plugin: 2, skill: 1 }, catCounts: { backend: 2, docs: 0 } };

const view = (state = empty, open = false, fns: Partial<Record<'onKind' | 'onCat' | 'onClear' | 'onOpen', () => void>> = {}) =>
  render(<Filters catalog={cat} state={state} counts={counts} open={open} onOpen={vi.fn()} onKind={vi.fn()} onCat={vi.fn()} onClear={vi.fn()} {...fns} />);

describe('Filters', () => {
  it('renders chips only for catalog kinds: no Command or MCP chip, no empty section', () => {
    const { container } = view();
    expect(screen.getByRole('button', { name: /^Plugin/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Skill/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^(Command|MCP)/ })).toBeNull();
    expect(container.querySelectorAll('.fgroup')).toHaveLength(2);
  });

  it('omits the category group when the catalog has no categories', () => {
    const { container } = render(
      <Filters catalog={catalogOf([plugin('fixture-a')])} state={empty} counts={counts} open={false} onOpen={vi.fn()} onKind={vi.fn()} onCat={vi.fn()} onClear={vi.fn()} />,
    );
    expect(container.querySelectorAll('.fgroup')).toHaveLength(1);
  });

  it('sets aria-pressed, shows counts and disables a zero count unless pressed', () => {
    view();
    expect(screen.getByRole('button', { name: /^docs/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /^backend/ }).textContent).toContain('2');
    cleanup();
    view({ q: '', kinds: [], cats: ['docs'] });
    const docs = screen.getByRole('button', { name: /^docs/ });
    expect(docs.getAttribute('aria-pressed')).toBe('true');
    expect(docs.hasAttribute('disabled')).toBe(false);
  });

  it('offers Clear filters only while a filter is active', () => {
    view();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    cleanup();
    const onClear = vi.fn();
    view({ q: '', kinds: ['skill'], cats: [] }, false, { onClear });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('keeps the filters behind a toggle (open state class) with the active count', () => {
    const onOpen = vi.fn();
    const { container, rerender } = view({ q: '', kinds: ['skill'], cats: ['backend'] }, false, { onOpen });
    const toggle = screen.getByRole('button', { name: /^Filters/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('.count-pill')?.textContent).toBe('2');
    expect(container.querySelector('.filters.open')).toBeNull();
    fireEvent.click(toggle);
    expect(onOpen).toHaveBeenCalledWith(true);
    rerender(<Filters catalog={cat} state={empty} counts={counts} open onOpen={onOpen} onKind={vi.fn()} onCat={vi.fn()} onClear={vi.fn()} />);
    expect(container.querySelector('.filters.open')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onOpen).toHaveBeenLastCalledWith(false);
  });
});
