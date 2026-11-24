// Search tuning: SPEC-01 docs/specs/catalog-site.md:313-363. Golden queries (AC-14) tune only the synonyms and BOOSTS here.
import type { Kind } from '../catalog/types.ts';

export const KIND_ORDER: readonly Kind[] = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];

export const BOOSTS = { name: 5, tagsOwn: 3, tagsInherited: 1, description: 2, headings: 1.5, body: 1 };

export const STOP_WORDS: ReadonlySet<string> = new Set(
  ('a about an and any are as at be been but by can could do does for from get help how i if in into is it its me ' +
    'my need of on or our please some something that the these this those to tool use using want was we what which ' +
    'who will with would you your').split(' '),
);

export const KIND_WORDS: Readonly<Record<string, Kind>> = {
  plugin: 'plugin', plugins: 'plugin',
  skill: 'skill', skills: 'skill',
  agent: 'agent', agents: 'agent', subagent: 'agent', subagents: 'agent',
  command: 'command', commands: 'command',
  hook: 'hook', hooks: 'hook',
  mcp: 'mcp', server: 'mcp', servers: 'mcp',
};

// Each group is [key, ...values]: the key expands to every value, and each value expands back to the key.
export const SYNONYMS: readonly (readonly string[])[] = [
  ['migration', 'schema change', 'alter table'],
  ['review', 'audit', 'reviewer', 'code review'],
  ['spec', 'specification', 'requirement', 'sdd'],
  ['plan', 'planning'],
  ['test', 'testing'],
  ['async', 'background task', 'celery', 'queue'],
  ['api', 'rest', 'drf', 'endpoint'],
  ['onboarding', 'codebase overview', 'explain codebase'],
  ['research', 'investigate', 'find'],
  ['security', 'vulnerability', 'auth', 'authorization'],
  ['performance', 'slow', 'optimize'],
  ['diagram', 'mermaid'],
  ['guard', 'block', 'restrict'],
];

export const SYNONYM_WEIGHT = 0.5;
