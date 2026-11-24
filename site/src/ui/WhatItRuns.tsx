import type { ReactNode } from 'react';
import { runsLabels } from '../catalog/runs.ts';
import type { Agent, Artifact, Catalog, Command, Hook, McpServer, Plugin, Skill } from '../catalog/types.ts';
import { shortSha } from '../format.ts';
import { t } from '../i18n/en.ts';
import { artifactHash } from '../links/hash.ts';
import { blobUrl } from '../links/source-url.ts';
import { MarkdownBlock } from '../markdown/MarkdownBlock.tsx';
import { kindLabel } from './Card.tsx';
import { Icon } from './Icon.tsx';

/** Anchor to another origin: new tab, rel, the ext icon and a screen-reader note (NFR-14). */
export function GhLink({ href, children, note }: { href: string; children: ReactNode; note: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}<Icon name="ext" size="sm" /><span className="sr-only">{note}</span>
    </a>
  );
}

const Cell = ({ label, cls = '', children }: { label: string; cls?: string; children?: ReactNode }) => (
  <div className={`td${cls}`} role="cell" data-label={label}>{children}</div>
);

function Table({ cls, label, heads, children }: { cls: string; label: string; heads: string[]; children: ReactNode }) {
  return (
    <div className="tbl-wrap">
      <div className={`tbl ${cls}`} role="table" aria-label={label}>
        <div className="tr head" role="row">{heads.map((h) => <div key={h} className="th" role="columnheader">{h}</div>)}</div>
        {children}
      </div>
    </div>
  );
}

const Pills = ({ list, cls = 'pill' }: { list: string[]; cls?: string }) =>
  list.length === 0 ? <span className="muted">{t('runs.none')}</span> : <span className="vlist">{list.map((x) => <span key={x} className={cls}>{x}</span>)}</span>;

const ArtifactLink = ({ a }: { a: Pick<Artifact, 'plugin' | 'kind' | 'name'> }) => <a href={artifactHash(a)}>{a.name}</a>;

type Tooled = Skill | Command;

export function WhatItRuns({ catalog, plugin }: { catalog: Catalog; plugin: Plugin }) {
  const { runs } = plugin;
  const byId = new Map(catalog.artifacts.map((a) => [a.id, a] as const));
  const hooks = runs.hooks.map((id) => byId.get(id)).filter((a): a is Hook => a?.kind === 'hook');
  const servers = runs.mcpServers.map((id) => byId.get(id)).filter((a): a is McpServer => a?.kind === 'mcp');
  const shell = runs.shellArtifacts.map((id) => byId.get(id)).filter((a): a is Artifact => a !== undefined);
  const tooled = plugin.artifactIds
    .map((id) => byId.get(id))
    .filter((a): a is Tooled => (a?.kind === 'skill' || a?.kind === 'command') && a.allowedTools !== null);
  const scriptSource = (path: string) => runs.scripts.find((s) => s.path === path)?.sourceUrl ?? blobUrl(catalog, path);
  const labels = runs.runsCode ? runsLabels(plugin, 'runs') : [];
  const opens = t('runs.commitOpens');
  const nothing = hooks.length === 0 && servers.length === 0 && runs.scripts.length === 0;

  return (
    <section className="sec" id="what-it-runs" aria-labelledby="what-it-runs-h" tabIndex={-1}>
      <h2 id="what-it-runs-h">{t('runs.heading')}</h2>
      <div className="panel-box">
        <p className="small t2">
          {t('runs.introBefore')}
          <GhLink href={`${catalog.marketplace.repoUrl}/commit/${catalog.build.commit}`} note={opens}><code>{shortSha(catalog.build.commit)}</code></GhLink>
          {t('runs.introAfter')}
        </p>
        {labels.length > 0 && (
          <span className="runs lg"><Icon name="warn" />{t('runs.badge')}<span className="reasons">· {labels.join(', ')}</span></span>
        )}
        {shell.length > 0 && (
          <p className="small t2">
            {t('runs.shellEntry')}{' '}
            {shell.map((a, i) => <span key={a.id}>{i > 0 && ', '}<ArtifactLink a={a} /></span>)}
          </p>
        )}
        {nothing && <p className="plain-sentence">{t('runs.nothing')}</p>}

        {hooks.length > 0 && (
          <>
            <h3>{t('runs.hooksTitle')} <span className="muted small">({hooks.length})</span></h3>
            <Table
              cls="t-hooks" label={t('runs.hooksTitle')}
              heads={[t('runs.colHook'), t('runs.colEvent'), t('runs.colMatcher'), t('runs.colType'), t('runs.colCommand'), t('runs.colTimeout')]}
            >
              {hooks.map((h) => (
                <div key={h.id} className="tr" role="row">
                  <Cell label={t('runs.colHook')}><ArtifactLink a={h} /></Cell>
                  <Cell label={t('runs.colEvent')}>{h.event}</Cell>
                  <Cell label={t('runs.colMatcher')}>{h.matcher === null ? <span className="muted">{t('runs.notSet')}</span> : <code>{h.matcher}</code>}</Cell>
                  <Cell label={t('runs.colType')}>{h.type}</Cell>
                  <Cell label={t('runs.colCommand')}>{h.command === null ? <span className="muted">{t('runs.notSet')}</span> : <code className="cmd-block" tabIndex={0}>{h.command}</code>}</Cell>
                  <Cell label={t('runs.colTimeout')}>{h.timeout === null ? <span className="muted">{t('runs.notSet')}</span> : t('runs.seconds', { n: h.timeout })}</Cell>
                  <div className="td desc small" role="cell">
                    {h.description}{h.description && ' '}
                    {t('runs.definedIn')} <GhLink href={blobUrl(catalog, h.definedIn)} note={t('runs.viewFor', { path: h.definedIn })}><code>{h.definedIn}</code></GhLink>
                    {h.scripts.map((s) => (
                      <span key={s}> · <GhLink href={scriptSource(s)} note={t('runs.viewFor', { path: s })}><code>{s}</code></GhLink></span>
                    ))}
                  </div>
                </div>
              ))}
            </Table>
          </>
        )}

        {runs.scripts.length > 0 && (
          <>
            <h3>{t('runs.scriptsTitle')} <span className="muted small">({runs.scripts.length})</span></h3>
            <Table cls="t-scripts" label={t('runs.scriptsTitle')} heads={[t('runs.colPath'), t('runs.colSource'), t('runs.colNamedBy')]}>
              {runs.scripts.map((s) => (
                <div key={s.path} className="tr" role="row">
                  <Cell label={t('runs.colPath')}><code>{s.path}</code></Cell>
                  <Cell label={t('runs.colSource')}><GhLink href={s.sourceUrl} note={t('runs.viewFor', { path: s.path })}>{t('runs.view')}</GhLink></Cell>
                  <Cell label={t('runs.colNamedBy')}>
                    {s.referencedBy.length === 0 ? (
                      <span className="muted">{t('runs.notNamed')}</span>
                    ) : (
                      <span className="row">
                        <Icon name="hook" size="sm" />
                        {s.referencedBy.map((id) => {
                          const a = byId.get(id);
                          return a ? <ArtifactLink key={id} a={a} /> : <span key={id}>{id}</span>;
                        })}
                      </span>
                    )}
                  </Cell>
                </div>
              ))}
            </Table>
          </>
        )}

        {servers.length > 0 && (
          <>
            <h3>{t('runs.mcpTitle')} <span className="muted small">({servers.length})</span></h3>
            <Table
              cls="t-mcp" label={t('runs.mcpTitle')}
              heads={[t('runs.colServer'), t('runs.colTransport'), t('runs.colCommandOrUrl'), t('runs.colEnv')]}
            >
              {servers.map((m) => (
                <div key={m.id} className="tr" role="row">
                  <Cell label={t('runs.colServer')}><ArtifactLink a={m} /></Cell>
                  <Cell label={t('runs.colTransport')}>{m.transport ?? <span className="muted">{t('runs.notSet')}</span>}</Cell>
                  <Cell label={t('runs.colCommandOrUrl')}>
                    <code>{m.url ?? [m.command, ...m.args].filter((x) => x !== null).join(' ')}</code>
                  </Cell>
                  <Cell label={t('runs.colEnv')}>{m.envVars.length === 0 ? <span className="muted">{t('runs.none')}</span> : <Pills list={m.envVars} />}</Cell>
                </div>
              ))}
            </Table>
          </>
        )}

        {runs.agentTools.length > 0 && (
          <>
            <h3>{t('runs.agentsTitle')} <span className="muted small">({runs.agentTools.length})</span></h3>
            <Table
              cls="t-agents" label={t('runs.agentsTitle')}
              heads={[t('runs.colAgent'), t('runs.colModel'), t('runs.colTools'), t('runs.colDisallowed')]}
            >
              {runs.agentTools.map((g) => {
                const a = byId.get(g.agent) as Agent | undefined;
                return (
                  <div key={g.agent} className="tr" role="row">
                    <Cell label={t('runs.colAgent')}>{a ? <ArtifactLink a={a} /> : g.agent}</Cell>
                    <Cell label={t('runs.colModel')}>{g.model === null ? <span className="muted">{t('runs.notDeclared')}</span> : <code>{g.model}</code>}</Cell>
                    <Cell label={t('runs.colTools')}>
                      {g.tools === null ? <span className="muted">{t('runs.toolsNotDeclared')}</span> : <Pills list={g.tools} />}
                    </Cell>
                    <Cell label={t('runs.colDisallowed')}>{g.disallowedTools.length === 0 ? <span className="muted">{t('runs.none')}</span> : <Pills list={g.disallowedTools} cls="pill no" />}</Cell>
                  </div>
                );
              })}
            </Table>
          </>
        )}

        {tooled.length > 0 && (
          <>
            <h3>{t('runs.toolsTitle')}</h3>
            <Table cls="t-tools" label={t('runs.toolsTitle')} heads={[t('runs.colName'), t('runs.colKind'), t('runs.colAllowed')]}>
              {tooled.map((a) => (
                <div key={a.id} className="tr" role="row">
                  <Cell label={t('runs.colName')}><ArtifactLink a={a} /></Cell>
                  <Cell label={t('runs.colKind')}>{kindLabel(a.kind)}</Cell>
                  <Cell label={t('runs.colAllowed')}><Pills list={a.allowedTools ?? []} /></Cell>
                </div>
              ))}
            </Table>
          </>
        )}

        {runs.whatItRuns.length > 0 && (
          <>
            <h3>{t('runs.authorTitle')}</h3>
            <p className="small muted">{t('runs.authorNote')}</p>
            {runs.whatItRuns.map((w, i) => (
              <div key={i} className="stack author-entry">
                <h4>{w.heading}</h4>
                <MarkdownBlock doc={w.text} catalog={catalog} />
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
