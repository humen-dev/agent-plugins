import { runsLabels } from '../catalog/runs.ts';
import type { Artifact, Catalog, Change, Plugin } from '../catalog/types.ts';
import { shortSha, utcDay } from '../format.ts';
import { t } from '../i18n/en.ts';
import { artifactHash, pluginHash } from '../links/hash.ts';
import { treeUrl } from '../links/source-url.ts';
import { MarkdownBlock } from '../markdown/MarkdownBlock.tsx';
import { cut } from '../search/highlight.ts';
import { KIND_ORDER } from '../search/config.ts';
import { kindLabel } from '../ui/Card.tsx';
import { Collapsible } from '../ui/Collapsible.tsx';
import { CommandBox } from '../ui/CommandBox.tsx';
import { Icon } from '../ui/Icon.tsx';
import { GhLink, WhatItRuns } from '../ui/WhatItRuns.tsx';

const kindRank = (a: Artifact) => KIND_ORDER.indexOf(a.kind);
const byKindThenName = (a: Artifact, b: Artifact) => kindRank(a) - kindRank(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const isWeb = (u: string) => /^https?:\/\//i.test(u);
const shortUrl = (u: string) => u.replace(/^https?:\/\//i, '').replace(/\/$/, '');

type CountKind = 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
const COUNT = (k: CountKind, n: number) => {
  switch (k) {
    case 'skill': return t('plugin.count.skill', { n });
    case 'agent': return t('plugin.count.agent', { n });
    case 'command': return t('plugin.count.command', { n });
    case 'hook': return t('plugin.count.hook', { n });
    case 'mcp': return t('plugin.count.mcp', { n });
  }
};

function ChangeRow({ c }: { c: Change }) {
  const v = c.version;
  const label = c.type === 'version' ? '' : c.type === 'added' ? t('plugin.changeAdded') : t('plugin.changeChange');
  const vText = v === null ? '' : c.type === 'version' ? `${v.from ?? ''} → ${v.to}` : v.to;
  return (
    <li className="chg">
      <span className="ctype" data-type={c.type}>
        <Icon name={c.type === 'version' ? 'refresh' : c.type === 'added' ? 'plus' : 'code'} size="sm" />
        {label}{vText && <span className="v">{vText}</span>}
      </span>
      <time className="small muted mono" dateTime={c.date}>{utcDay(c.date)}</time>
      <span className="subj">{c.subject}</span>
      <GhLink href={c.url} note={t('plugin.commit')}><span className="sha">{shortSha(c.commit)}</span></GhLink>
    </li>
  );
}

export function PluginPage({ catalog, plugin: p }: { catalog: Catalog; plugin: Plugin }) {
  const byId = new Map(catalog.artifacts.map((a) => [a.id, a] as const));
  const arts = p.artifactIds.map((id) => byId.get(id)).filter((a): a is Artifact => a !== undefined).sort(byKindThenName);
  const counts = KIND_ORDER.filter((k): k is CountKind => k !== 'plugin')
    .map((k) => [k, arts.filter((a) => a.kind === k).length] as const)
    .filter(([, n]) => n > 0);
  const labels = p.runs.runsCode ? runsLabels(p, 'runs') : [];
  const inCatalog = new Set(catalog.plugins.map((x) => x.name));
  const missing = p.dependencies.some((d) => !d.inCatalog);
  const authorUrl = p.author?.url && isWeb(p.author.url) ? p.author.url : null;
  const toRuns = () => document.getElementById('what-it-runs')?.focus();

  return (
    <div className="wrap page">
      <header className="ph">
        <div className="row">
          <span className="badge" data-kind="plugin"><Icon name="pkg" size="sm" />{t('plugin.badge')}</span>
          {p.category !== null && <span className="cat-label">{p.category}</span>}
        </div>
        <h1>{p.name}</h1>
        {(p.version !== null || p.author !== null || p.license !== null || p.updated !== null) && <div className="facts-line">
          {p.version !== null && <span><span className="k">{t('plugin.version')}</span><code>{p.version}</code></span>}
          {p.author !== null && (
            <span>
              <span className="k">{t('plugin.author')}</span>
              {authorUrl !== null ? <GhLink href={authorUrl} note={t('plugin.external')}>{p.author.name}</GhLink> : <span>{p.author.name}</span>}
            </span>
          )}
          {p.license !== null && <span><span className="k">{t('plugin.license')}</span>{p.license}</span>}
          {p.updated !== null && <span><span className="k">{t('plugin.updated')}</span><time dateTime={p.updated}>{utcDay(p.updated)}</time></span>}
        </div>}
        {labels.length > 0 && (
          <span className="runs lg self-start">
            <Icon name="warn" />{t('runs.badge')}<span className="reasons">· {labels.join(', ')}</span>
            <button type="button" className="link-btn" onClick={toRuns}>{t('runs.seeRuns')}</button>
          </span>
        )}
      </header>

      <div className="cols">
        <div className="stack wide-gap">
          {p.summary !== '' && (
            <section className="sec" aria-labelledby="plugin-sum">
              <h2 id="plugin-sum" className="sr-only">{t('plugin.summary')}</h2>
              <p className="lead">{p.summary}</p>
            </section>
          )}

          <section className="sec" aria-labelledby="plugin-arts">
            <h2 id="plugin-arts">
              {t('plugin.adds')}
              {arts.length > 0 && (
                <span className="muted">{t('plugin.items', { n: arts.length })}: {counts.map(([k, n]) => COUNT(k, n)).join(' · ')}</span>
              )}
            </h2>
            {arts.length === 0 ? (
              <p className="plain-sentence">{t('plugin.noArtifacts')}</p>
            ) : (
              <div className="tbl-wrap">
                <div className="tbl t-arts" role="table" aria-labelledby="plugin-arts">
                  <div className="tr head" role="row">
                    {[t('plugin.colKind'), t('plugin.colName'), t('plugin.colInvoke'), t('plugin.colDescription'), t('plugin.colSource')].map((h) => (
                      <div key={h} className="th" role="columnheader">{h}</div>
                    ))}
                  </div>
                  {arts.map((a) => (
                    <div key={a.id} className="tr" role="row">
                      <div className="td" role="cell" data-label={t('plugin.colKind')}>
                        <span className="badge" data-kind={a.kind}><Icon name={a.kind} size="sm" />{kindLabel(a.kind)}</span>
                      </div>
                      <div className="td" role="cell" data-label={t('plugin.colName')}><a href={artifactHash(a)}>{a.name}</a></div>
                      <div className="td" role="cell" data-label={t('plugin.colInvoke')}>
                        {a.invokeAs !== null ? <code>{a.invokeAs}</code> : a.kind === 'hook' ? <span className="muted">{t('plugin.runsOn', { event: a.event })}</span> : null}
                      </div>
                      <div className="td t2" role="cell" data-label={t('plugin.colDescription')}>{cut(a.description, 160)}</div>
                      <div className="td" role="cell" data-label={t('plugin.colSource')}>
                        <GhLink href={a.sourceUrl} note={t('plugin.forName', { name: a.name })}>{t('plugin.file')}</GhLink>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {p.dependencies.length > 0 && (
            <section className="sec" aria-labelledby="plugin-deps">
              <h2 id="plugin-deps">{t('plugin.dependencies')} <span className="muted">{t('plugin.installedWith')}</span></h2>
              <ul className="cb-list">
                {p.dependencies.map((d) => (
                  <li key={d.name} className="cb-row">
                    <Icon name="pkg" />
                    {d.inCatalog && inCatalog.has(d.name) ? (
                      <a href={pluginHash(d.name)} className="nm">{d.name}</a>
                    ) : (
                      <>
                        <span className="nm">{d.name}</span>
                        <span className="runs">{t('plugin.notInMarketplace')}</span>
                      </>
                    )}
                    {d.version !== null && <code className="pill">{d.version}</code>}
                  </li>
                ))}
              </ul>
              {missing && (
                <div className="notice warn" role="note">
                  <Icon name="warn" />
                  <div>
                    <p className="notice-title">{t('plugin.missingTitle')}</p>
                    <p>{t('plugin.missingBody')}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          <WhatItRuns catalog={catalog} plugin={p} />

          {p.readme !== null && (
            <section className="sec" aria-labelledby="plugin-readme">
              <h2 id="plugin-readme">{t('plugin.readme')}</h2>
              <div className="panel-box"><MarkdownBlock doc={p.readme} catalog={catalog} /></div>
            </section>
          )}

          {p.thirdPartyNotices !== null && (
            <section className="sec" aria-labelledby="plugin-notices">
              <h2 id="plugin-notices">{t('plugin.notices')}</h2>
              <Collapsible title={t('plugin.noticesFile')} sub={p.thirdPartyNotices.path}>
                <MarkdownBlock doc={p.thirdPartyNotices} catalog={catalog} />
              </Collapsible>
            </section>
          )}

          {p.recentChanges.length > 0 && (
            <section className="sec" aria-labelledby="plugin-changes">
              <h2 id="plugin-changes">
                {t('plugin.changes')}{' '}
                <span className="muted">
                  {p.recentChanges.length === 10 ? t('plugin.changesLatest', { n: 10 }) : t('plugin.changesCount', { n: p.recentChanges.length })}
                </span>
              </h2>
              <ol className="chg-list">{p.recentChanges.map((c) => <ChangeRow key={c.commit} c={c} />)}</ol>
              <a href={`#/new?plugin=${encodeURIComponent(p.name)}`} className="small">{t('plugin.allChanges', { name: p.name })}</a>
            </section>
          )}
        </div>

        <aside className="side" aria-label={t('plugin.install')}>
          <div className="panel-box">
            <h2 className="side-h">{t('plugin.install')}</h2>
            <p className="small t2">{t('plugin.stepAdd')}</p>
            <CommandBox text={catalog.marketplace.addCommand} label={t('plugin.addLabel')} />
            <p className="small t2">{t('plugin.stepInstall')}</p>
            <CommandBox text={p.installCommand} label={t('plugin.installBoxLabel')} />
          </div>
          <div className="panel-box">
            <h2 className="side-h">{t('plugin.links')}</h2>
            <ul className="plain-list small">
              <li><GhLink href={treeUrl(catalog, p.path)} note={t('plugin.opensOnGithub')}>{t('plugin.sourceOnGithub')}</GhLink></li>
              {p.homepage !== null && (
                <li><GhLink href={p.homepage} note={t('plugin.external')}>{t('plugin.homepage')}</GhLink> <span className="muted wrap-any">{shortUrl(p.homepage)}</span></li>
              )}
              {p.repository !== null && (
                <li><GhLink href={p.repository} note={t('plugin.external')}>{t('plugin.repository')}</GhLink> <span className="muted wrap-any">{shortUrl(p.repository)}</span></li>
              )}
            </ul>
          </div>
          {p.tags.length > 0 && (
            <div className="panel-box">
              <h2 className="side-h">{t('plugin.tags')}</h2>
              <div className="row">{p.tags.map((tag) => <a key={tag} className="tag" href={`#/?q=${encodeURIComponent(tag)}`}>{tag}</a>)}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
