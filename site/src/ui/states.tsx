import { t } from '../i18n/en.ts';
import { Icon } from './Icon.tsx';

export function Skeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="wrap">
      <div className="results" aria-busy="true" aria-label={t('states.loadingResults')}>
        {Array.from({ length: count }, (_, i) => (
          <div className="skel" aria-hidden="true" key={i}><i className="b" /><i className="h" /><i className="s" /><i /><i className="s" /><i className="c" /></div>
        ))}
      </div>
    </div>
  );
}

export function CatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="wrap state-wrap">
      <div className="state-panel err-p" role="alert">
        <Icon name="err" size="lg" />
        <h1>{t('states.errorTitle')}</h1>
        <p className="t2">{t('states.errorBody')}</p>
        <button type="button" className="btn primary" onClick={onRetry}><Icon name="refresh" />{t('states.retry')}</button>
      </div>
    </div>
  );
}

export function NotFound({ url }: { url: string }) {
  return (
    <div className="wrap state-wrap">
      <div className="state-panel">
        <Icon name="compass" size="lg" />
        <h1>{t('states.notFoundTitle')}</h1>
        <p className="t2">{t('states.notFoundBefore')}<code>{url}</code>{t('states.notFoundAfter')}</p>
        <a className="btn primary" href="#/"><Icon name="arrowL" />{t('states.backToSearch')}</a>
      </div>
    </div>
  );
}
