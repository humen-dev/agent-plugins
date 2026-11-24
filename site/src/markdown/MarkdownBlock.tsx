import { Fragment, type ReactNode, useMemo } from 'react';
import type { Catalog, Markdown } from '../catalog/types.ts';
import { t } from '../i18n/en.ts';
import { blobUrl } from '../links/source-url.ts';
import { Icon } from '../ui/Icon.tsx';
import { resolveTarget, type Target } from './links.ts';
import { parseMarkdown } from './parse.ts';
import type { Block, Inline, ListBlock } from './types.ts';

// Rendering cap only: the parser keeps every row.
export const TABLE_ROW_CAP = 200;
export const TABLE_COL_CAP = 20;

interface Ctx { file: string; root: string }

function Anchor({ target, children, after }: { target: NonNullable<Target>; children: ReactNode; after?: ReactNode }) {
  const web = /^https?:/.test(target.href);
  return (
    <a href={target.href} target="_blank" rel="noopener noreferrer">
      {children}
      {after}
      {target.github ? (
        <>
          <Icon name="ext" size="sm" />
          <span className="sr-only">{t('md.opensOnGithub')}</span>
        </>
      ) : (
        web && <span className="sr-only">{t('md.external')}</span>
      )}
    </a>
  );
}

// A plain function, not a component: a table cell is one call instead of one React element per cell.
function inlines(nodes: readonly Inline[], ctx: Ctx): ReactNode {
  if (nodes.length === 1 && nodes[0].t === 'text') return nodes[0].text;
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text': return n.text;
      case 'code': return <code key={i}>{n.text}</code>;
      case 'strong': return <strong key={i}>{n.text}</strong>;
      case 'em': return <em key={i}>{n.text}</em>;
      case 'link': {
        const target = resolveTarget(n.href, ctx.file, ctx.root, 'link');
        const kids = inlines(n.children, ctx);
        return target ? <Anchor key={i} target={target}>{kids}</Anchor> : <span key={i}>{kids}</span>;
      }
      case 'image': {
        const target = resolveTarget(n.src, ctx.file, ctx.root, 'image');
        const alt = n.alt || t('md.image');
        return target ? (
          <Anchor key={i} target={target} after={<span className="sr-only">{t('md.imageNotLoaded')}</span>}>{alt}</Anchor>
        ) : (
          <span key={i}>{alt}</span>
        );
      }
    }
  });
}

function List({ list, ctx }: { list: ListBlock; ctx: Ctx }) {
  const Tag = list.ordered ? 'ol' : 'ul';
  return (
    <Tag>
      {list.items.map((it, i) => (
        <li key={i}>
          {inlines(it.children, ctx)}
          {it.sub && <List list={it.sub} ctx={ctx} />}
        </li>
      ))}
    </Tag>
  );
}

function Blocks({ blocks, ctx }: { blocks: readonly Block[]; ctx: Ctx }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'heading':
            return (
              <div key={i} role="heading" aria-level={b.level + 2} className={`md-h md-h${b.level}`}>
                {inlines(b.children, ctx)}
              </div>
            );
          case 'para': return <p key={i}>{inlines(b.children, ctx)}</p>;
          case 'list': return <List key={i} list={b} ctx={ctx} />;
          case 'quote': return <blockquote key={i}><Blocks blocks={b.children} ctx={ctx} /></blockquote>;
          case 'hr': return <hr key={i} />;
          case 'code': {
            const caption = b.lang === 'mermaid' ? t('md.mermaid') : b.lang || t('md.code');
            return (
              <figure key={i} className="md-code">
                <figcaption>{caption}</figcaption>
                <pre tabIndex={0} aria-label={caption}><code>{b.text}</code></pre>
              </figure>
            );
          }
          case 'table': {
            const rowCls = `md-tr md-cols-${Math.max(1, Math.min(6, b.head.length))}`;
            let width = b.head.length;
            for (const r of b.rows) if (r.length > width) width = r.length;
            const hiddenRows = Math.max(0, b.rows.length - TABLE_ROW_CAP);
            const hiddenCols = Math.max(0, width - TABLE_COL_CAP);
            const parts = [
              hiddenRows > 0 && t('md.rowsHidden', { n: hiddenRows }),
              hiddenCols > 0 && t('md.colsHidden', { n: hiddenCols }),
            ].filter(Boolean) as string[];
            return (
              <Fragment key={i}>
                <div className="md-scroll" tabIndex={0} role="region" aria-label={t('md.table')}>
                  <div role="table" aria-label={t('md.table')} className="md-table">
                    {b.head.some((c) => c.length > 0) && (
                      <div role="row" className={rowCls}>
                        {b.head.slice(0, TABLE_COL_CAP).map((c, j) => <div key={j} role="columnheader" className="md-th">{inlines(c, ctx)}</div>)}
                      </div>
                    )}
                    {b.rows.slice(0, TABLE_ROW_CAP).map((r, j) => (
                      <div key={j} role="row" className={rowCls}>
                        {r.slice(0, TABLE_COL_CAP).map((c, k) => <div key={k} role="cell" className="md-td">{inlines(c, ctx)}</div>)}
                      </div>
                    ))}
                  </div>
                </div>
                {parts.length > 0 && (
                  <p className="md-table-capped">
                    {t('md.tableCapped', { parts: parts.length === 2 ? t('md.tableCappedJoin', { a: parts[0], b: parts[1] }) : parts[0] })}{' '}
                    <Anchor target={{ href: ctx.file, github: true }}>{t('md.viewFullFile')}</Anchor>
                  </p>
                )}
              </Fragment>
            );
          }
        }
      })}
    </>
  );
}

export function MarkdownBlock({ doc, catalog }: { doc: Markdown; catalog: Catalog }) {
  const blocks = useMemo(() => parseMarkdown(doc.source), [doc.source]);
  const ctx = { file: blobUrl(catalog, doc.path), root: blobUrl(catalog, '') };
  return (
    <div className="md">
      <Blocks blocks={blocks} ctx={ctx} />
    </div>
  );
}
