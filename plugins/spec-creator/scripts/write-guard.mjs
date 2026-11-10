#!/usr/bin/env node
/**
 * spec-creator PreToolUse guard for Write|Edit — wired in hooks/hooks.json:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/write-guard.mjs"
 *
 * Acts only when the hook payload's `agent_type` is exactly
 * `spec-creator:spec-creator`; the main session and every other agent
 * (including an unprefixed `spec-creator` or another plugin's
 * `*:spec-creator`) pass through untouched.
 *
 *   spec-creator:spec-creator → only *.md under `specsDir` or a module's
 *                               `specsDir` (never the spec template, never
 *                               `_TEMPLATE.md`)
 *
 * Directories come from the project's `.claude/sdd.json` (default: `specs/`).
 * Paths are resolved against the hook's `cwd`; anything outside the project
 * (`..`, absolute paths elsewhere) is blocked. Fail-closed: a malformed
 * sdd.json, a missing file_path or unreadable input blocks the write.
 */
import { allow, agentType, block, isUnder, projectRelative, projectRoot, readPayload, samePath } from './lib/guard-io.mjs';
import { loadConfig, normalizeDir, specDirs } from './lib/sdd-config.mjs';

const GUARD = 'write-guard';
const SPEC = 'spec-creator:spec-creator';
const name = 'spec-creator';

const payload = readPayload(GUARD);
if (agentType(payload) !== SPEC) allow();

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
allow();
