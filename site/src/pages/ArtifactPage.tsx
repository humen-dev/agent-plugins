import { Fragment, type ReactNode } from 'react';
import type { Artifact, Catalog, Plugin } from '../catalog/types.ts';
import { t } from '../i18n/en.ts';
import { pluginHash } from '../links/hash.ts';
import { blobUrl } from '../links/source-url.ts';
import { MarkdownBlock } from '../markdown/MarkdownBlock.tsx';
import { kindLabel } from '../ui/Card.tsx';
import { Collapsible } from '../ui/Collapsible.tsx';
import { CommandBox } from '../ui/CommandBox.tsx';
import { Icon } from '../ui/Icon.tsx';
import { GhLink } from '../ui/WhatItRuns.tsx';

type Row = readonly [label: string, value: ReactNode];

const muted = (text: string) => <span className="muted">{text}</span>;
const code = (text: string) => <code>{text}</code>;
const pills = (list: string[], cls = 'pill') =>
  list.length === 0 ? muted(t('runs.none')) : <span className="vlist">{list.map((x) => <span key={x} className={cls}>{x}</span>)}</span>;
const orNotSet = (v: string | null) => (v === null ? muted(t('runs.notSet')) : code(v));

function kindPlural(k: Artifact['kind']) {
  switch (k) {
    case 'skill': return t('artifact.kindPlural.skill');
    case 'agent': return t('artifact.kindPlural.agent');
    case 'command': return t('artifact.kindPlural.command');
    case 'hook': return t('artifact.kindPlural.hook');
    case 'mcp': return t('artifact.kindPlural.mcp');
  }
}

function bodyTitle(k: Artifact['kind']) {
  return k === 'skill' ? t('artifact.bodySkill') : k === 'agent' ? t('artifact.bodyAgent') : t('artifact.bodyCommand');
}

export function ArtifactPage({ catalog, plugin, artifact: a }: { catalog: Catalog; plugin: Plugin; artifact: Artifact }) {
  const gh = (path: string) => (
    <GhLink href={blobUrl(catalog, path)} note={t('artifact.opensOnGithub')}><code>{path}</code></GhLink>
  );
  const tools = (list: string[] | null) => (list === null ? muted(t('runs.toolsNotDeclared')) : pills(list));
  const preloaded = (list: string[]) => (
    <span className="vlist">
      {list.map((s) => {
        const [p, name] = s.split(':');
        const hit = name !== undefined && catalog.artifacts.some((x) => x.kind === 'skill' && x.plugin === p && x.name === name);
        return hit ? <a key={s} className="pill" href={`${pluginHash(p)}/skill/${encodeURIComponent(name)}`}>{s}</a> : <span key={s} className="pill">{s}</span>;
      })}
    </span>
  );

  const rows: (Row | null)[] = [
    [t('artifact.plugin'), <><a href={pluginHash(plugin.name)}>{plugin.name}</a>{plugin.version !== null && <> {code(plugin.version)}</>}</>],
    [t('artifact.kind'), kindLabel(a.kind)],
  ];
  const push = (...r: (Row | null)[]) => rows.push(...r);
  const opt = (label: string, v: ReactNode | null): Row | null => (v === null ? null : [label, v]);
  const nonEmpty = (label: string, list: string[], node: ReactNode): Row | null => (list.length === 0 ? null : [label, node]);
  const path: Row = [t('artifact.path'), code(a.path)];

  switch (a.kind) {
    case 'skill':
      push(
        opt(t('artifact.invokeAs'), a.invokeAs === null ? null : code(a.invokeAs)),
        opt(t('artifact.argHint'), a.argumentHint === null ? null : code(a.argumentHint)),
        [t('artifact.invocation'), a.userInvokedOnly ? t('artifact.userOnly') : t('artifact.byBoth')],
        opt(t('artifact.allowedTools'), a.allowedTools === null ? null : pills(a.allowedTools)),
        opt(t('artifact.model'), a.model === null ? null : code(a.model)),
        path,
      );
      break;
    case 'command':
      push(
        opt(t('artifact.invokeAs'), a.invokeAs === null ? null : code(a.invokeAs)),
        opt(t('artifact.argHint'), a.argumentHint === null ? null : code(a.argumentHint)),
        opt(t('artifact.allowedTools'), a.allowedTools === null ? null : pills(a.allowedTools)),
        opt(t('artifact.model'), a.model === null ? null : code(a.model)),
        path,
      );
      break;
    case 'agent':
      push(
        opt(t('artifact.invokeAs'), a.invokeAs === null ? null : code(a.invokeAs)),
        [t('artifact.model'), a.model === null ? muted(t('runs.notDeclared')) : code(a.model)],
        [t('artifact.tools'), tools(a.tools)],
        nonEmpty(t('artifact.disallowedTools'), a.disallowedTools, pills(a.disallowedTools, 'pill no')),
        nonEmpty(t('artifact.preloaded'), a.preloadedSkills, preloaded(a.preloadedSkills)),
        opt(t('artifact.maxTurns'), a.maxTurns === null ? null : String(a.maxTurns)),
        path,
      );
      break;
    case 'hook':
      push(
        [t('artifact.event'), a.event],
        [t('artifact.matcher'), orNotSet(a.matcher)],
        [t('artifact.type'), a.type],
        opt(t('artifact.command'), a.command === null ? null : <code className="cmd-block" tabIndex={0}>{a.command}</code>),
        [t('artifact.timeout'), a.timeout === null ? muted(t('runs.notSet')) : t('runs.seconds', { n: a.timeout })],
        nonEmpty(t('artifact.scripts'), a.scripts, <span className="vlist">{a.scripts.map((s) => <span key={s}>{gh(s)}</span>)}</span>),
        [t('artifact.definedIn'), gh(a.definedIn)],
      );
      break;
    case 'mcp':
      push(
        [t('artifact.transport'), orNotSet(a.transport)],
        opt(t('artifact.command'), a.command === null ? null : code(a.command)),
        nonEmpty(t('artifact.args'), a.args, pills(a.args)),
        opt(t('artifact.url'), a.url === null ? null : code(a.url)),
        nonEmpty(t('artifact.envVars'), a.envVars, pills(a.envVars)),
        [t('artifact.definedIn'), gh(a.definedIn)],
      );
      break;
  }

  const dir = a.path.slice(0, a.path.lastIndexOf('/') + 1);
  const rel = (p: string) => (p.startsWith(dir) ? p.slice(dir.length) : p);
  const fm = Object.entries(a.frontmatter);
  const hasBody = a.kind !== 'hook' && a.kind !== 'mcp' && a.body !== null;

  return (
    <div className="wrap page">
      <nav className="crumbs" aria-label={t('artifact.breadcrumb')}>
        <ol>
          <li><a href={pluginHash(plugin.name)}>{plugin.name}</a></li>
          <li><a href={`#/?kind=${a.kind}`}>{kindPlural(a.kind)}</a></li>
          <li><span aria-current="page">{a.name}</span></li>
        </ol>
      </nav>
      <header className="ph">
        <div className="row">
          <span className="badge" data-kind={a.kind}><Icon name={a.kind} size="sm" />{kindLabel(a.kind)}</span>
          {a.kind === 'skill' && a.userInvokedOnly && <span className="cat-label">{t('card.userOnly')}</span>}
        </div>
        <h1>{a.name}</h1>
        {a.description !== '' && <p className="lead">{a.description}</p>}
        {a.invokeAs !== null && (
          <div className="invoke">
            <span className="muted">{t('artifact.invokeAs')}</span><code>{a.invokeAs}</code>
            {'argumentHint' in a && a.argumentHint !== null && <span className="arghint">{a.argumentHint}</span>}
          </div>
        )}
        {plugin.runs.shellArtifacts.includes(a.id) && (
          <span className="runs lg self-start"><Icon name="warn" />{t('runs.badge')}<span className="reasons">· {t('runs.shell', { kind: a.kind })}</span></span>
        )}
      </header>

      <div className="cols">
        <div className="stack wide-gap">
          <section className="sec" aria-labelledby="art-facts">
            <h2 id="art-facts">{t('artifact.facts')}</h2>
            <dl className="facts">
              {rows.filter((r): r is Row => r !== null).map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>)}
            </dl>
          </section>

          {a.files.length > 0 && (
            <section className="sec" aria-labelledby="art-files">
              <h2 id="art-files">{t('artifact.files')} <span className="muted">{a.files.length}</span></h2>
              <div className="stack tight">
                {a.files.map((f) => (
                  <Collapsible key={f.path} title={f.title} sub={rel(f.path)}>
                    <MarkdownBlock doc={f.body} catalog={catalog} />
                    <GhLink href={blobUrl(catalog, f.path)} note={t('artifact.opensOnGithub')}>{t('artifact.openFile', { name: rel(f.path) })}</GhLink>
                  </Collapsible>
                ))}
              </div>
            </section>
          )}

          {hasBody && a.body !== null && (
            <section className="sec" aria-labelledby="art-body">
              <h2 id="art-body">{bodyTitle(a.kind)}</h2>
              <div className="panel-box"><MarkdownBlock doc={a.body} catalog={catalog} /></div>
            </section>
          )}

          {fm.length > 0 && (
            <section className="sec" aria-labelledby="art-fm">
              <h2 id="art-fm">{t('artifact.frontmatter')} <span className="muted">{t('artifact.fmCount', { n: fm.length })}</span></h2>
              <div className="tbl-wrap">
                <div className="tbl t-fm" role="table" aria-labelledby="art-fm">
                  <div className="tr head" role="row">
                    <div className="th" role="columnheader">{t('artifact.fmKey')}</div>
                    <div className="th" role="columnheader">{t('artifact.fmValue')}</div>
                  </div>
                  {fm.map(([k, v]) => (
                    <div key={k} className="tr" role="row">
                      <div className="td" role="cell" data-label={t('artifact.fmKey')}><code>{k}</code></div>
                      <div className="td mono fm-val" role="cell" data-label={t('artifact.fmValue')}>{Array.isArray(v) ? v.map((x) => `- ${x}`).join('\n') : String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="side" aria-label={t('artifact.install')}>
          <div className="panel-box">
            <h2 className="side-h">{t('artifact.installHeading')}</h2>
            <p className="small t2">{t('artifact.shipsBefore', { name: a.name })}<a href={pluginHash(plugin.name)}>{plugin.name}</a>.</p>
            <CommandBox text={plugin.installCommand} label={t('plugin.installBoxLabel')} />
            <GhLink href={a.sourceUrl} note={t('artifact.opensOnGithub')}>{t('artifact.sourceLabel')}<code>{a.path}</code></GhLink>
          </div>
        </aside>
      </div>
    </div>
  );
}
