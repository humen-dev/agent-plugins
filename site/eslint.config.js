import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules/', 'dist/', 'prototype/', 'src/generated/', 'test/fixtures/'] },
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
  { files: ['**/*.ts'], extends: [tseslint.configs.recommended] },
);
