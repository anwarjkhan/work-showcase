import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Unused values are usually a sign of an unfinished change; allow the
      // conventional underscore prefix for deliberate placeholders.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    files: ['scripts/**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'next-env.d.ts']),
]);
