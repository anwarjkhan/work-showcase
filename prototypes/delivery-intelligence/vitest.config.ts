import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { TERMINOLOGY_ALIAS, terminologyOverrideFile } from './scripts/terminology-alias.mjs';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: TERMINOLOGY_ALIAS, replacement: terminologyOverrideFile(rootDir) },
      { find: /^@\//, replacement: `${rootDir}${path.sep}` },
    ],
  },
  test: {
    // Logic tests run in Node; a test that renders React can opt in with
    // `// @vitest-environment jsdom` at the top of the file.
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'e2e/**', '.next/**', 'out/**'],
  },
});
