## What changes

<!-- Plugin(s) touched and what was added / changed / removed. -->

## Checklist

- [ ] `node scripts/validate-marketplace.mjs` passes
- [ ] `node scripts/check-version-bump.mjs origin/main` passes
- [ ] `claude plugin validate . --strict` passes
- [ ] Installed from `./` (`claude plugin marketplace add ./`) and tried in a session
- [ ] `version` bumped in each touched plugin's `plugin.json` (SemVer; never in `marketplace.json`) — see `docs/RELEASES.md`
- [ ] Plugin `name` in `plugin.json` equals its `marketplace.json` entry
- [ ] Plugin is self-contained — no `../` or files outside its folder; cross-plugin needs in `dependencies`
- [ ] Agents declare `tools`/`disallowedTools`; reviewers stay read-only
- [ ] Plugin README and root README plugin table updated
- [ ] Copied content credited in the plugin's `THIRD_PARTY_NOTICES.md`
- [ ] Renamed/removed plugin is mapped in `renames`

### If hooks, scripts or `.mcp.json` changed

- [ ] Went through the checklist in `docs/SECURITY.md`
- [ ] No secrets; variables quoted; no unpinned downloads
- [ ] Scripts use LF and are invoked via `bash`/`node`
