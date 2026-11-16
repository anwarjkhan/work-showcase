// Resolves the optional, git-ignored terminology override.
//
// `lib/config/terminology.local.ts` is never committed. When it exists, the
// alias `@local/terminology` points at it; otherwise it points at the committed
// empty fallback, so the build never breaks. Used by next.config.ts and
// vitest.config.ts. tsconfig.json mirrors the same rule with the two-entry "@local/*" path
// (the bundlers use the explicit alias, which takes precedence).
import { existsSync } from 'node:fs';
import path from 'node:path';

export const TERMINOLOGY_ALIAS = '@local/terminology';

/** @param {string} rootDir absolute path of the app folder */
export function terminologyOverrideFile(rootDir) {
  const local = path.join(rootDir, 'lib/config/terminology.local.ts');
  return existsSync(local) ? local : path.join(rootDir, 'lib/config/terminology.local.fallback.ts');
}
