// @vitest-environment jsdom
// The keydown is sent from a MutationObserver: after the DOM commit, before any later task.
import { render, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from '../../src/App.tsx';
import { catalogOf, plugin } from '../search/fixture-catalog.ts';
it('"/" pressed in the same task as the ready commit still goes to search (AC-25a)', async () => {
  history.replaceState(null, '', '#/install');
  const cat = catalogOf([plugin('a'), plugin('b')]);
  let sent = false;
  const mo = new MutationObserver(() => {
    if (!sent && document.querySelector('footer')) {
      sent = true;
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    }
  });
  mo.observe(document.body, { subtree: true, childList: true });
  render(<App load={() => Promise.resolve(cat)} />);
  await waitFor(() => expect(sent).toBe(true));
  mo.disconnect();
  await waitFor(() => expect(location.hash).toBe('#/'));
});
