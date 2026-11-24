import type { Kind } from '../catalog/types.ts';
import { runsLabels } from '../catalog/runs.ts';
import { t } from '../i18n/en.ts';
import { cut, segments } from '../search/highlight.ts';
import type { ResultCard } from '../search/search.ts';
import { CommandBox } from './CommandBox.tsx';
import { Icon } from './Icon.tsx';

const KIND_LABEL: Record<Kind, () => string> = {
  plugin: () => t('card.kind.plugin'),
  skill: () => t('card.kind.skill'),
  agent: () => t('card.kind.agent'),
  command: () => t('card.kind.command'),
  hook: () => t('card.kind.hook'),
  mcp: () => t('card.kind.mcp'),
};
export const kindLabel = (k: Kind) => KIND_LABEL[k]();

/** Text nodes only: matched words become <mark>, everything else stays plain text. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  return <>{segments(text, terms).map((s, i) => (s.mark ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</>;
}

export function Card({ card }: { card: ResultCard }) {
  const { plugin, artifact, merged, matchedTerms, snippet } = card;
  const own = artifact !== null && !merged; // a plain artifact card, not merged with its plugin
  const name = artifact?.name ?? plugin.name;
  const pluginHref = `#/plugins/${encodeURIComponent(plugin.name)}`;
  const href = own ? `${pluginHref}/${artifact.kind}/${encodeURIComponent(artifact.name)}` : pluginHref;
  const desc = cut(own ? artifact.description : plugin.description, 160);
  const hint = artifact && 'argumentHint' in artifact ? artifact.argumentHint : null;
  const labels = plugin.runs.runsCode ? runsLabels(plugin) : [];
  const label = kindLabel(card.kind);
  const hid = `card-${card.key}`;

  return (
    <article className="card" aria-labelledby={hid}>
      <div className="card-top">
        <span className="badge" data-kind={card.kind}>
          <Icon name={card.kind === 'plugin' ? 'pkg' : card.kind} size="sm" />{merged ? t('card.merged', { kind: label }) : label}
        </span>
        {artifact?.kind === 'skill' && artifact.userInvokedOnly && <span className="cat-label">{t('card.userOnly')}</span>}
      </div>
      <h3 id={hid} className="card-name"><a href={href}><Marked text={name} terms={matchedTerms} /></a></h3>
      <div className="meta">
        {own && <span>{t('card.inPlugin')} <a href={pluginHref}>{plugin.name}</a></span>}
        {plugin.category !== null && <span>{plugin.category}</span>}
      </div>
      <div>
        <p className="desc">{snippet ? <Marked text={snippet.text} terms={matchedTerms} /> : <Marked text={desc} terms={matchedTerms} />}</p>
        {snippet && <p className="src">{t('card.inFile')} <code>{snippet.file}</code></p>}
      </div>
      {labels.length > 0 && (
        <span className="runs"><Icon name="warn" size="sm" />{t('card.runsCode')}<span className="reasons">· {labels.join(', ')}</span></span>
      )}
      {artifact?.invokeAs && (
        <div className="invoke"><code>{artifact.invokeAs}</code>{hint && <span className="arghint">{hint}</span>}</div>
      )}
      <span className="spacer" />
      <CommandBox text={plugin.installCommand} />
    </article>
  );
}
