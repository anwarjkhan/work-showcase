/**
 * Committed, empty stand-in for the git-ignored `terminology.local.ts`.
 *
 * To use internal names inside the firm, copy this file to
 * `lib/config/terminology.local.ts` (same folder, never committed) and fill in
 * only the labels you want to change, for example:
 *
 *   const override: TerminologyOverride = {
 *     systems: { 'portfolio-system': '<internal portfolio system name>' },
 *     templates: { rapid: '<internal template name>' },
 *   };
 *   export default override;
 *
 * Restart `npm run dev` after creating or deleting the local file: the alias is
 * resolved when the bundler starts.
 */
import type { TerminologyOverride } from './terminology';

const override: TerminologyOverride = {};

export default override;
