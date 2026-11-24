import { useId } from 'react';
import type { Catalog, Kind } from '../catalog/types.ts';
import { t } from '../i18n/en.ts';
import type { SearchOutput, SearchState } from '../search/search.ts';
import { kindLabel } from './Card.tsx';
import { Icon } from './Icon.tsx';

interface Props {
  catalog: Catalog;
  state: SearchState;
  counts: Pick<SearchOutput, 'kindCounts' | 'catCounts'>;
  open: boolean;
  onOpen: (open: boolean) => void;
  onKind: (k: Kind) => void;
  onCat: (c: string) => void;
  onClear: () => void;
}

export function Filters({ catalog, state, counts, open, onOpen, onKind, onCat, onClear }: Props) {
  const id = useId();
  const active = state.kinds.length + state.cats.length;
  const chip = (key: string, label: string, pressed: boolean, count: number, toggle: () => void, kind?: Kind) => (
    <button key={key} type="button" className="chip" aria-pressed={pressed} disabled={count === 0 && !pressed} onClick={toggle}>
      <Icon name="check" size="sm" />
      {kind && <span className="kdot" data-kind={kind} aria-hidden="true" />}
      {label}<span className="n">{count}</span>
    </button>
  );

  return (
    <div className="stack">
      <button type="button" className="btn ftoggle" aria-expanded={open} aria-controls={id} onClick={() => onOpen(!open)}>
        <Icon name="filter" />{t('filters.heading')}
        {active > 0 && <><span className="count-pill on">{active}</span><span className="sr-only">{t('filters.active')}</span></>}
      </button>
      <div className={open ? 'filters open' : 'filters'} id={id}>
        <div className="sheet">
          <div className="sheet-head"><h2 className="sheet-title">{t('filters.heading')}</h2><button type="button" className="btn sm" onClick={() => onOpen(false)}>{t('filters.done')}</button></div>
          <div className="fgroup" role="group" aria-labelledby={`${id}-k`}>
            <span className="fgroup-title" id={`${id}-k`}>{t('filters.kind')}</span>
            <div className="chips">
              {catalog.kinds.map((k) => chip(k, kindLabel(k), state.kinds.includes(k), counts.kindCounts[k] ?? 0, () => onKind(k), k))}
            </div>
          </div>
          {catalog.categories.length > 0 && (
            <div className="fgroup" role="group" aria-labelledby={`${id}-c`}>
              <span className="fgroup-title" id={`${id}-c`}>{t('filters.category')}</span>
              <div className="chips">
                {catalog.categories.map((c) => chip(c, c, state.cats.includes(c), counts.catCounts[c] ?? 0, () => onCat(c)))}
              </div>
            </div>
          )}
          {active > 0 && <button type="button" className="btn sm ghost clear-filters" onClick={onClear}><Icon name="x" size="sm" />{t('filters.clear')}</button>}
        </div>
      </div>
    </div>
  );
}
