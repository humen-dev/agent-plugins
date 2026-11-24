import { describe, expect, it } from 'vitest';
import { runsLabels } from '../../src/catalog/runs.ts';
import type { Plugin } from '../../src/catalog/types.ts';
import { plugin } from '../search/fixture-catalog.ts';

const withRuns = (reasons: Plugin['runs']['reasons'], shellArtifacts: string[] = []): Plugin => {
  const p = plugin('p');
  return { ...p, runs: { ...p.runs, runsCode: reasons.length > 0, reasons, shellArtifacts } };
};

describe('runsLabels', () => {
  it('follows the reasons order', () => {
    expect(runsLabels(withRuns(['hooks', 'mcp', 'scripts']))).toEqual(['hooks', 'MCP servers', 'scripts']);
    expect(runsLabels(withRuns(['scripts', 'hooks']))).toEqual(['scripts', 'hooks']);
  });

  it('expands shell to one label per distinct kind, in Kind order', () => {
    expect(runsLabels(withRuns(['shell'], ['agent:p/a']))).toEqual(['agent with shell access']);
    expect(runsLabels(withRuns(['hooks', 'shell'], ['agent:p/a', 'agent:p/b', 'skill:p/s']))).toEqual([
      'hooks', 'skill with shell access', 'agent with shell access',
    ]);
  });

  it('gives no label when nothing runs', () => {
    expect(runsLabels(withRuns([]))).toEqual([]);
  });
});
