import { useId, useLayoutEffect, useMemo, useState } from 'react';
import type { Catalog } from '../catalog/types.ts';
import { t } from '../i18n/en.ts';
import { installHash, parseP } from '../install/link.ts';
import { cliText, resolveSet, settingsJson } from '../install/resolve.ts';
import { installStore, useInstallSelection } from '../install/store.ts';
import { NOTICE_LIMITS, type Scope } from '../install/types.ts';
import { pluginHash } from '../links/hash.ts';
import { cut } from '../search/highlight.ts';
import { CommandBox } from '../ui/CommandBox.tsx';
import { Icon } from '../ui/Icon.tsx';

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function InstallPage({ catalog }: { catalog: Catalog }) {
  const uid = useId();
  const selection = useInstallSelection();
  const [ignored, setIgnored] = useState(0);
  const [scope, setScope] = useState<Scope>('user');

  // AC-41c: a `p` param previews that selection; storage stays untouched until the first edit.
  // Layout effect: the preview must be in the store before paint, or the stored set shows for one commit.
  useLayoutEffect(() => {
    const read = () => {
      const p = parseP(location.hash);
      if (p === null) return;
      installStore.preview(p.names);
      setIgnored(p.ignored);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => {
      window.removeEventListener('hashchange', read);
      installStore.clearPreview(); // leaving the page drops an unedited shared selection (Decision 3)
    };
  }, []);

  const r = useMemo(() => resolveSet(catalog, selection), [catalog, selection]);
  const finalSet = new Set(r.final);
  const rows = [...catalog.plugins].sort((a, b) => byName(a.name, b.name));
  const shown = r.dropped.slice(0, NOTICE_LIMITS.names);
  const more = r.dropped.length - shown.length + ignored;

  const toggle = (name: string) => {
    const next = r.selected.includes(name) ? r.selected.filter((x) => x !== name) : [...r.selected, name];
    installStore.edit(next);
    setIgnored(0);
    history.replaceState(null, '', installHash(next));
  };

  return (
    <div className="wrap page">
      <header className="ph">
        <h1>{t('pages.installTitle')}</h1>
        <p className="lead">{t('install.lead')}</p>
      </header>
      {shown.length + ignored > 0 && (
        <div className="notice info" role="status">
          <Icon name="info" />
          <p>
            {t('install.noticeBefore')}
            {shown.map((n) => cut(n, NOTICE_LIMITS.nameChars)).join(', ')}
            {more > 0 && t('install.noticeMore', { n: more })}
            {t('install.noticeAfter')}
          </p>
        </div>
      )}
      {r.missing.map((m) => (
        <div className="notice warn" role="note" key={`${m.forName}/${m.dep}`}>
          <Icon name="warn" />
          <div>
            <p className="notice-title">
              {m.version === null ? t('install.missingTitleNoVersion', { dep: m.dep }) : t('install.missingTitle', { dep: m.dep, version: m.version })}
            </p>
            <p>{t('install.missingBody', { name: m.forName })}</p>
          </div>
        </div>
      ))}

      <div className="cols">
        <section className="sec" aria-labelledby={`pick-${uid}`}>
          <h2 id={`pick-${uid}`}>{t('install.plugins')} <span className="muted">{t('install.selectedCount', { n: r.final.length })}</span></h2>
          <ul className="cb-list">
            {rows.map((p) => {
              const auto = finalSet.has(p.name) && !r.selected.includes(p.name);
              const id = `${uid}-${p.name}`;
              return (
                <li className="cb-row" key={p.name}>
                  <input type="checkbox" id={id} checked={finalSet.has(p.name)} disabled={auto} onChange={() => toggle(p.name)} />
                  <label htmlFor={id}>
                    <span className="nm">{p.name}</span>
                    {p.category !== null && <span className="cat-label">{p.category}</span>}
                    {auto && <span className="auto-label">{t('install.autoLabel', { names: (r.addedFor[p.name] ?? []).join(', ') })}</span>}
                    {p.runs.runsCode && <span className="runs">{t('card.runsCode')}</span>}
                  </label>
                  <a href={pluginHash(p.name)} className="small">{t('install.details')}<span className="sr-only">{t('install.detailsFor', { name: p.name })}</span></a>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="side" aria-label={t('install.output')}>
          <div className="panel-box">
            <h2 className="side-h" id={`scope-${uid}`}>{t('install.scope')}</h2>
            <div className="seg" role="group" aria-labelledby={`scope-${uid}`}>
              <button type="button" aria-pressed={scope === 'user'} onClick={() => setScope('user')}>{t('install.scopeUser')}</button>
              <button type="button" aria-pressed={scope === 'project'} onClick={() => setScope('project')}>{t('install.scopeProject')}</button>
            </div>
            <p className="small muted">{scope === 'user' ? t('install.scopeHelpUser') : t('install.scopeHelpProject')}</p>
          </div>
        </aside>
      </div>

      {r.final.length === 0 ? (
        <div className="state-panel">
          <Icon name="list" size="lg" />
          <h2>{t('install.emptyTitle')}</h2>
          <p className="t2">{t('install.emptyBody')}</p>
        </div>
      ) : (
        <>
          <div className="out-grid">
            <section className="sec" aria-labelledby={`oa-${uid}`}>
              <h2 id={`oa-${uid}`}>{t('install.cliHeading')} <span className="muted">{t('install.lines', { n: r.final.length + 1 })}</span></h2>
              <div className="out-cmd"><CommandBox text={cliText(catalog, r.final, scope)} label={t('install.cliLabel')} /></div>
            </section>
            <section className="sec" aria-labelledby={`ob-${uid}`}>
              <h2 id={`ob-${uid}`}>
                {t('install.settingsHeading')}{' '}
                <span className="muted"><code>{scope === 'user' ? t('install.settingsPathUser') : t('install.settingsPathProject')}</code></span>
              </h2>
              <div className="out-cmd"><CommandBox text={settingsJson(catalog, r.final)} label={t('install.jsonLabel')} /></div>
            </section>
          </div>
          <p className="small muted">{t('install.share')}<a href={installHash(r.selected)}><code>{installHash(r.selected)}</code></a></p>
        </>
      )}
    </div>
  );
}
