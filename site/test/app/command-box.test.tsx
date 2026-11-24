// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandBox } from '../../src/ui/CommandBox.tsx';

const TEXT = 'claude plugin install fixture-alpha@fixture';
const HINT = /Ctrl\/Cmd\+C/;

const setClipboard = (c: unknown) => Object.defineProperty(navigator, 'clipboard', { value: c, configurable: true });
const click = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.getSelection()?.removeAllRanges();
});

describe('CommandBox', () => {
  it('writes the exact text and shows Copied for exactly 2 s', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<CommandBox text={TEXT} />);
    await click();
    expect(writeText).toHaveBeenCalledWith(TEXT);
    expect(screen.getByText('Copied')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByText('Copied')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Copied')).toBeNull();
  });

  const selectsAndHints = () => {
    // jsdom's Selection/Range toString() are empty and the range ends collapsed after focus(), so assert anchoring only
    const code = screen.getByText(TEXT);
    const sel = window.getSelection();
    expect(sel?.rangeCount).toBe(1);
    expect(sel?.getRangeAt(0).startContainer).toBe(code);
    expect(document.activeElement).toBe(code);
    expect(screen.getByText(HINT)).toBeTruthy();
  };

  it('selects the text and shows the hint when the write is rejected', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    render(<CommandBox text={TEXT} />);
    await click();
    selectsAndHints();
  });

  it('does the same with no Clipboard API', async () => {
    setClipboard(undefined);
    render(<CommandBox text={TEXT} />);
    await click();
    selectsAndHints();
  });
});
