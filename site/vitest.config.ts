import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['test/**/*.test.{mjs,ts,tsx}'],
      exclude: ['test/fixtures/**', 'test/e2e/**', 'node_modules/**'],
    },
  }),
);
