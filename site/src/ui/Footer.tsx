import type { Catalog } from '../catalog/types.ts';
import { shortSha, utcDay } from '../format.ts';
import { t } from '../i18n/en.ts';
import { requestUrl } from '../links/request-url.ts';

export function Footer({ catalog, query = '' }: { catalog: Catalog; query?: string }) {
  const { marketplace: m, build } = catalog;
  const day = utcDay(build.commitDate);
  return (
    <footer className="ftr">
      <div className="wrap">
        <span><strong>{m.name}</strong> {t('footer.marketplace')}{m.version !== null && <> <code>{m.version}</code></>}</span>
        <span>
          {t('footer.builtFrom')}{' '}
          <a href={`${m.repoUrl}/commit/${build.commit}`} target="_blank" rel="noopener noreferrer">
            <code>{shortSha(build.commit)}</code><span className="sr-only">{t('footer.commit')}</span>
          </a>{' '}
          {t('footer.on')} <time dateTime={day}>{day}</time>
        </span>
        <a href={m.repoUrl} target="_blank" rel="noopener noreferrer">{t('footer.repository')}<span className="sr-only">{t('footer.opensOnGithub')}</span></a>
        <a href={requestUrl(m.repoUrl, query)} target="_blank" rel="noopener noreferrer">{t('footer.request')}<span className="sr-only">{t('footer.opensOnGithub')}</span></a>
      </div>
    </footer>
  );
}
