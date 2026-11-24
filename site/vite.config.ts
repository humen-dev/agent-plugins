import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/agent-plugins/',
  plugins: [react()],
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
