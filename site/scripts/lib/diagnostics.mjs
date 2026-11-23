/** @typedef {import('../../src/catalog/types.ts').Diagnostic} Diagnostic */

/** Compare by UTF-16 code unit, never by locale (Decision 11). */
const cmp = (/** @type {string} */ a, /** @type {string} */ b) => (a < b ? -1 : a > b ? 1 : 0);

export function createDiagnostics() {
  /** @type {Diagnostic[]} */
  const items = [];
  return {
    /** @param {string} path @param {string} message */
    warn(path, message) {
      items.push({ level: 'warning', path, message });
    },
    /** @returns {Diagnostic[]} sorted by path, then message */
    list() {
      return items.slice().sort((a, b) => cmp(a.path, b.path) || cmp(a.message, b.message));
    },
  };
}

/** @typedef {ReturnType<typeof createDiagnostics>} Diagnostics */

/** @param {string} s @param {boolean} [prop] */
const esc = (s, prop = false) => {
  const e = s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  return prop ? e.replaceAll(':', '%3A').replaceAll(',', '%2C') : e;
};

/** GitHub workflow command; diagnostic text is untrusted, so it is escaped (Decision 13). */
export function formatWarning(/** @type {Diagnostic} */ d) {
  return `::warning file=${esc(d.path, true)}::${esc(d.message)}`;
}
