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
  {
    // UT-3: catalog strings must reach the DOM as text nodes only
    files: ['src/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'UT-3: no raw HTML sinks.' },
        { selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]', message: 'UT-3: no raw HTML sinks.' },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'UT-3: no raw HTML sinks.' },
      ],
    },
  },
  { files: ['**/*.{ts,tsx}'], extends: [tseslint.configs.recommended] },
);
