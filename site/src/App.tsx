import { useEffect, useId, useRef, useState } from 'react';
import type { Catalog } from './catalog/types.ts';
import { t } from './i18n/en.ts';
import { ArtifactPage } from './pages/ArtifactPage.tsx';
import { Placeholder } from './pages/Placeholders.tsx';
import { PluginPage } from './pages/PluginPage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { parseHash } from './router.ts';
import { Footer } from './ui/Footer.tsx';
import { Header } from './ui/Header.tsx';
import { CatalogError, NotFound, Skeletons } from './ui/states.tsx';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; catalog: Catalog };

export function App({ load, reload = () => location.reload() }: { load: () => Promise<Catalog>; reload?: () => void }) {
  const mainId = useId();
  const main = useRef<HTMLElement>(null);
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [hash, setHash] = useState(() => location.hash);

  useEffect(() => {
    let live = true;
    load().then(
      (catalog) => live && setState({ status: 'ready', catalog }),
      () => live && setState({ status: 'error' }),
    );
    return () => { live = false; };
  }, [load]);

  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const route = parseHash(hash);
  const ready = state.status === 'ready';
  // Query-only changes on the home route keep the focus where it is.
  const routeId = route.name === 'home' ? 'home' : JSON.stringify(route);
  const first = useRef(true);
  const wantSearchFocus = useRef(false);
  useEffect(() => {
    if (first.current) first.current = false;
    else if (wantSearchFocus.current) wantSearchFocus.current = false; // the search page focuses its box
    else main.current?.focus();
  }, [routeId]);

  // "/" on other routes goes to the search page and focuses the box (AC-25a); the page handles it on `#/`.
  useEffect(() => {
    if (!ready || route.name === 'home') return;
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      e.preventDefault();
      wantSearchFocus.current = true;
      location.hash = '#/';
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [ready, route.name]);

  const [query, setQuery] = useState('');
  const committed = route.name === 'home' ? query : '';

  let body;
  if (state.status === 'loading') body = <Skeletons />;
  else if (state.status === 'error') body = <CatalogError onRetry={reload} />;
  else if (route.name === 'home') body = <SearchPage catalog={state.catalog} onQuery={setQuery} focusOnMount={wantSearchFocus.current} />;
  else if (route.name === 'notfound') body = <NotFound url={hash || '#/'} />;
  else if (route.name === 'plugin') {
    const plugin = state.catalog.plugins.find((p) => p.name === route.plugin);
    body = plugin ? <PluginPage catalog={state.catalog} plugin={plugin} /> : <NotFound url={hash} />;
  } else if (route.name === 'artifact') {
    const plugin = state.catalog.plugins.find((p) => p.name === route.plugin);
    const artifact = state.catalog.artifacts.find((a) => a.plugin === route.plugin && a.kind === route.kind && a.name === route.artifact);
    body = plugin && artifact ? <ArtifactPage catalog={state.catalog} plugin={plugin} artifact={artifact} /> : <NotFound url={hash} />;
  } else body = <Placeholder route={route} />;

  return (
    <div className="app">
      <a className="skip" href={`#${mainId}`} onClick={(e) => { e.preventDefault(); main.current?.focus(); }}>{t('app.skip')}</a>
      <p className="sr-only" aria-live="polite">{state.status === 'loading' ? t('states.loadingResults') : ''}</p>
      <Header route={route.name} repoUrl={state.status === 'ready' ? state.catalog.marketplace.repoUrl : null} query={committed} />
      <main id={mainId} className="main" tabIndex={-1} ref={main}>{body}</main>
      {state.status === 'ready' && <Footer catalog={state.catalog} query={committed} />}
    </div>
  );
}
