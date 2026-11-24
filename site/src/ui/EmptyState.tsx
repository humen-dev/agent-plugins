import { t } from '../i18n/en.ts';
import { requestUrl } from '../links/request-url.ts';
import { Icon } from './Icon.tsx';

interface Props { query: string; hasFilters: boolean; tags: string[]; repoUrl: string; onClear: () => void }

export function EmptyState({ query, hasFilters, tags, repoUrl, onClear }: Props) {
  return (
    <div className="state-panel">
      <Icon name="search" size="lg" />
      <h2>{query ? t('empty.titleQuery', { q: query }) : t('empty.titleFilters')}</h2>
      <p className="t2">{t('empty.hint')}</p>
      <div className="row">
        {tags.slice(0, 5).map((tag) => <a key={tag} className="tag" href={`#/?q=${encodeURIComponent(tag)}`}>{tag}</a>)}
      </div>
      <div className="row empty-actions">
        {hasFilters && <button type="button" className="btn" onClick={onClear}><Icon name="x" size="sm" />{t('filters.clear')}</button>}
        <a className="btn primary" href={requestUrl(repoUrl, query)} target="_blank" rel="noopener noreferrer">
          {t('empty.request')}<Icon name="ext" size="sm" /><span className="sr-only">{t('empty.opensOnGithub')}</span>
        </a>
      </div>
    </div>
  );
}
