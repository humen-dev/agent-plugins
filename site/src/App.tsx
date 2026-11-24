import { useEffect, useId, useRef, useState } from 'react';
import type { Catalog } from './catalog/types.ts';
import { t } from './i18n/en.ts';
import { Placeholder } from './pages/Placeholders.tsx';
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
  // Query-only changes on the home route keep the focus where it is.
  const routeId = route.name === 'home' ? 'home' : JSON.stringify(route);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else main.current?.focus();
  }, [routeId]);

  let body;
  if (state.status === 'loading') body = <Skeletons />;
  else if (state.status === 'error') body = <CatalogError onRetry={reload} />;
  else if (route.name === 'home') body = <div className="wrap"><section className="hero"><h1>{t('search.heading')}</h1></section></div>;
  else if (route.name === 'notfound') body = <NotFound url={hash || '#/'} />;
  else body = <Placeholder route={route} catalog={state.catalog} url={hash} />;

  return (
    <div className="app">
      <a className="skip" href={`#${mainId}`} onClick={(e) => { e.preventDefault(); main.current?.focus(); }}>{t('app.skip')}</a>
      <p className="sr-only" aria-live="polite">{state.status === 'loading' ? t('states.loadingResults') : ''}</p>
      <Header route={route.name} repoUrl={state.status === 'ready' ? state.catalog.marketplace.repoUrl : null} />
      <main id={mainId} className="main" tabIndex={-1} ref={main}>{body}</main>
      {state.status === 'ready' && <Footer catalog={state.catalog} />}
    </div>
  );
}
