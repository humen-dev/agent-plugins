import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const BASE = '/agent-plugins/';

export const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Build only: CSP meta right after <meta charset>, theme-init.js before the first stylesheet (NFR-12, AC-60c). */
export function htmlPlugin(): Plugin {
  const themeInit = `<script src="${BASE}theme-init.js"></script>`;
  return {
    name: 'catalog-html',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const csp = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
        // Move our own tag (exact string Vite emits from %BASE_URL%theme-init.js); never skip silently.
        if (!html.includes(themeInit)) throw new Error(`catalog-html: ${themeInit} not found in index.html`);
        const out = html
          .replace(themeInit, '')
          .replace(/<meta\s+charset=[^>]*>/i, (m) => `${m}\n    ${csp}`);
        const link = /<link\b[^>]*rel=["']stylesheet["']/i.exec(out);
        const at = link ? link.index : out.indexOf('</head>');
        return `${out.slice(0, at)}${themeInit}\n    ${out.slice(at)}`;
      },
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), htmlPlugin()],
  resolve: {
    alias: {
      '@generated/catalog': fileURLToPath(new URL('./src/generated/catalog.json', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: { chunkFileNames: 'assets/[name]-[hash].js' },
    },
  },
});
