#!/usr/bin/env node
/**
 * spec-driven PreToolUse guard for Write|Edit — wired in hooks/hooks.json:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/write-guard.mjs"
 *
 * Acts only when the hook payload's `agent_type` is exactly a key of RULES;
 * the main session and every other agent (including an unprefixed
 * `spec-creator` or another plugin's `*:spec-creator`) pass through
 * untouched. Rules:
 *
 *   spec-driven:spec-creator → only *.md under `specsDir` or a module's
 *                               `specsDir` (never the spec template, never
 *                               `_TEMPLATE.md`)
 *   spec-driven:planner      → only *.md directly in `plansDir` (no
 *                               subfolders), never inside a spec folder
 *
 * Directories come from the project's `.claude/sdd.json` (defaults: `specs/`,
 * `docs/plans/`).
 * Paths are resolved against the hook's `cwd`; anything outside the project
 * (`..`, absolute paths elsewhere) is blocked. Fail-closed: a malformed
 * sdd.json, a missing file_path or unreadable input blocks the write.
 */
import { allow, agentType, block, isUnder, projectRelative, projectRoot, readPayload, samePath } from './lib/guard-io.mjs';
import { loadConfig, normalizeDir, specDirs } from './lib/sdd-config.mjs';

const GUARD = 'write-guard';

/** Full agent name → its write rule. Agents not listed here pass through untouched. */
const RULES = new Map([
  ['spec-driven:spec-creator', specsOnly],
  ['spec-driven:planner', plansOnly],
]);

const payload = readPayload(GUARD);
const agent = agentType(payload);
const rule = RULES.get(agent);
if (!rule) allow();
rule(payload, agent.split(':').pop());
allow();

/** Only *.md under `specsDir` or a module's `specsDir`; never the spec template. */
function specsOnly(payload, name) {
  const { config, error } = loadConfig(projectRoot(payload));
  if (error) block(GUARD, `${error} — fix the project config before ${name} writes anything.`);

  const filePath = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path;
  if (typeof filePath !== 'string' || !filePath.trim()) block(GUARD, `${name} may not write without a file_path — refusing the write.`);

  const rel = projectRelative(payload, filePath);
  const dirs = specDirs(config);
  const shown = dirs.map((d) => (d ? `${d}/` : './')).join(', ');
  const instead = `write only Markdown specs under ${shown}; put code, plan or test changes into the spec as requirements or open questions instead of making them.`;
  if (!rel) block(GUARD, `${name} may not write outside the project (${filePath}); ${instead}`);
  const template = config.specTemplate ? normalizeDir(config.specTemplate) : null;
  if (/(^|\/)_TEMPLATE\.md$/i.test(rel) || (template && samePath(rel, template))) {
    block(GUARD, `${name} may not edit the spec template (${rel}); ${instead}`);
  }
  if (!/\.md$/i.test(rel) || !dirs.some((d) => isUnder(rel, d))) block(GUARD, `${name} may not write ${rel}; ${instead}`);
}

/** Only *.md directly in `plansDir`; never inside a spec folder (even when the two overlap). */
function plansOnly(payload, name) {
  const { config, error } = loadConfig(projectRoot(payload));
  if (error) block(GUARD, `${error} — fix the project config before ${name} writes anything.`);

  const filePath = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path;
  if (typeof filePath !== 'string' || !filePath.trim()) block(GUARD, `${name} may not write without a file_path — refusing the write.`);

  const rel = projectRelative(payload, filePath);
  const plans = normalizeDir(config.plansDir);
  const instead = `write only the plan Markdown directly in ${plans ? `${plans}/` : './'}; put code, spec or test changes into the plan as work units or spec follow-ups instead of making them.`;
  if (!rel) block(GUARD, `${name} may not write outside the project (${filePath}); ${instead}`);
  if (specDirs(config).some((d) => isUnder(rel, d))) block(GUARD, `${name} may not write into a spec folder (${rel}); ${instead}`);
  const parent = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
  if (!/\.md$/i.test(rel) || !samePath(parent, plans)) block(GUARD, `${name} may not write ${rel}; ${instead}`);
}
