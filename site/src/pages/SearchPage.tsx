import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Catalog, Kind } from '../catalog/types.ts';
import { t } from '../i18n/en.ts';
import { parseHash, sanitize, searchHash } from '../router.ts';
import { createSearch, type SearchState } from '../search/search.ts';
import { Card } from '../ui/Card.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { Filters } from '../ui/Filters.tsx';
import { Icon } from '../ui/Icon.tsx';

const DEBOUNCE_MS = 120;

interface Props { catalog: Catalog; onQuery: (q: string) => void; focusOnMount?: boolean }

export function SearchPage({ catalog, onQuery, focusOnMount = false }: Props) {
  const uid = useId();
  const search = useMemo(() => createSearch(catalog), [catalog]);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // EC-1: with no terms left, the hinted kinds join the kind filter once.
  const withHints = (s: SearchState): SearchState => {
    const { hintedKinds } = search.run(s);
    return hintedKinds.length ? { ...s, kinds: catalog.kinds.filter((k) => s.kinds.includes(k) || hintedKinds.includes(k)) } : s;
  };

  const [cur, setCur] = useState<SearchState>(() => {
    const r = parseHash(location.hash);
    return r.name === 'home' ? withHints(sanitize(r, catalog)) : { q: '', kinds: [], cats: [] };
  });
  const [text, setText] = useState(cur.q);
  const curRef = useRef(cur);

  const commit = (s: SearchState) => {
    curRef.current = s;
    setCur(s);
    history.replaceState(null, '', searchHash(s));
    onQuery(s.q);
  };
  const commitQuery = (q: string) => commit(withHints({ ...curRef.current, q }));
  const setFilters = (p: Partial<SearchState>) => commit({ ...curRef.current, ...p });

  useEffect(() => {
    // Normalise the hash on load (sanitised lists, EC-1 hints) and share the query with the header/footer.
    const h = searchHash(curRef.current);
    if (h !== (location.hash || '#/')) history.replaceState(null, '', h);
    onQuery(curRef.current.q);
    if (focusOnMount) input.current?.focus();
  }, []);

  useEffect(() => {
    const onHash = () => {
      const r = parseHash(location.hash);
      if (r.name !== 'home') return;
      clearTimeout(timer.current);
      const s = withHints(sanitize(r, catalog));
      curRef.current = s;
      setCur(s);
      setText(s.q);
      onQuery(s.q);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('keydown', onKey);
      clearTimeout(timer.current);
    };
  }, [catalog]);

  const out = useMemo(() => search.run(cur), [search, cur]);
  const hasFilters = cur.kinds.length + cur.cats.length > 0;
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const onText = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commitQuery(v), DEBOUNCE_MS);
  };
  const clearText = () => {
    clearTimeout(timer.current);
    setText('');
    commitQuery('');
  };

  const count = t('search.count', { n: out.cards.length }) + (out.hasTerms ? t('search.bestFirst') : t('search.sortedByName'));

  return (
    <div className="wrap">
      <section className="hero" aria-labelledby={`${uid}-h`}>
        <h1 id={`${uid}-h`}>{t('search.heading')}</h1>
        <p className="lede">{t('search.lede')}</p>
        <div className="search" role="search">
          <Icon name="search" />
          <label className="sr-only" htmlFor={`${uid}-q`}>{t('search.label')}</label>
          <input
            id={`${uid}-q`} ref={input} type="search" autoComplete="off" spellCheck={false} placeholder={t('search.placeholder')}
            value={text} aria-describedby={`${uid}-kh ${uid}-cnt`}
            onChange={(e) => onText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') clearText(); }}
          />
          {text !== '' && (
            <button type="button" className="icon-btn has-tip" aria-label={t('search.clear')} onClick={() => { clearText(); input.current?.focus(); }}>
              <Icon name="x" /><span className="tip" aria-hidden="true">{t('search.clearTip')}</span>
            </button>
          )}
          <span className="kbd-hint" id={`${uid}-kh`}><kbd>/</kbd>{t('search.hintSearch')}<kbd>{t('search.keyEsc')}</kbd>{t('search.hintClear')}</span>
        </div>
        <p className="count-line" id={`${uid}-cnt`} role="status" aria-live="polite">{count}</p>
      </section>

      <div className="home-grid">
        <Filters
          catalog={catalog} state={cur} counts={out} open={filtersOpen} onOpen={setFiltersOpen}
          onKind={(k: Kind) => setFilters({ kinds: catalog.kinds.filter((x) => toggle(cur.kinds, k).includes(x)) })}
          onCat={(c) => setFilters({ cats: catalog.categories.filter((x) => toggle(cur.cats, c).includes(x)) })}
          onClear={() => setFilters({ kinds: [], cats: [] })}
        />
        <div className="results-col">
          {out.cards.length > 0 ? (
            <div className="results">{out.cards.map((c) => <Card key={c.key} card={c} />)}</div>
          ) : (
            <EmptyState
              query={cur.q.trim()} hasFilters={hasFilters} tags={search.topTags} repoUrl={catalog.marketplace.repoUrl}
              onClear={() => setFilters({ kinds: [], cats: [] })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
