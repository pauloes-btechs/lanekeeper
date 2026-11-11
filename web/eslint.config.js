import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'public/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  { files: ['scripts/**', 'test/**', '*.config.js'], languageOptions: { globals: { ...globals.node } } },
];
