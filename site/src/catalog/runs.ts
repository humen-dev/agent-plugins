import { t } from '../i18n/en.ts';
import { KIND_ORDER } from '../search/config.ts';
import type { Plugin } from './types.ts';

/** One label per run reason, in `reasons` order; `shell` becomes one label per distinct kind (Decision 7). */
export function runsLabels(p: Plugin): string[] {
  return p.runs.reasons.flatMap((r) => {
    if (r === 'hooks') return [t('card.runs.hooks')];
    if (r === 'mcp') return [t('card.runs.mcp')];
    if (r === 'scripts') return [t('card.runs.scripts')];
    const kinds = new Set(p.runs.shellArtifacts.map((id) => id.split(':')[0]));
    return KIND_ORDER.filter((k) => kinds.has(k)).map((kind) => t('card.runs.shell', { kind }));
  });
}
