import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'prototype/',
      'src/generated/',
      'test/fixtures/',
      'playwright-report/',
      'test-results/',
    ],
  },
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
  { files: ['src/**', 'public/**'], languageOptions: { globals: globals.browser } },
  { files: ['**/*.{ts,tsx}'], extends: [tseslint.configs.recommended] },
);
