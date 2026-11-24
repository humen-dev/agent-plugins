import type { Catalog, Change } from '../catalog/types.ts';
import { shortSha, utcDay } from '../format.ts';
import { t } from '../i18n/en.ts';
import { pluginHash } from '../links/hash.ts';
import { Icon } from './Icon.tsx';
import { GhLink } from './WhatItRuns.tsx';

export function ChangeRow({ c, catalog, second }: { c: Change; catalog: Catalog; second: 'date' | 'plugin' }) {
  const v = c.version;
  const label = c.type === 'version' ? '' : c.type === 'added' ? t('plugin.changeAdded') : t('plugin.changeChange');
  const vText = v === null ? '' : c.type === 'version' ? `${v.from ?? ''} → ${v.to}` : v.to;
  const inCatalog = catalog.plugins.some((p) => p.name === c.plugin);
  return (
    <li className="chg">
      <span className="ctype" data-type={c.type}>
        <Icon name={c.type === 'version' ? 'refresh' : c.type === 'added' ? 'plus' : 'code'} size="sm" />
        {label}{vText && <span className="v">{vText}</span>}
      </span>
      {second === 'date' ? (
        <time className="small muted mono" dateTime={c.date}>{utcDay(c.date)}</time>
      ) : inCatalog ? (
        <a href={pluginHash(c.plugin)} className="nm">{c.plugin}</a>
      ) : (
        <span className="old">{c.plugin}<span>{t('new.oldName')}</span></span>
      )}
      <span className="subj">{c.subject}</span>
      <GhLink href={c.url} note={t('plugin.commit')}><span className="sha">{shortSha(c.commit)}</span></GhLink>
    </li>
  );
}
