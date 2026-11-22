// Node command for slide packs (docs/SLIDES_PLAN.md section 6 and 12, S4).
//
//   npm run slides -- --scope deliverable:td-1001 [--pack deliverable] [--kinds td-verdict,td-plan] [--out <dir>]
//
// Scopes: portfolio | deliverable:<id> | outcome:<id> | pm-node:<id> (also
// programme:<id>, project:<id>, initiative:<id>). With --kinds the named slide
// kinds are built; otherwise --pack (default: the pack for the scope). The file
// is written to --out (default out/slides, which is git-ignored; note that
// `npm run build` replaces out/).
//
// How TypeScript runs here without a new dependency: the app's TS sources are
// loaded through Node's own type stripping (`module.stripTypeScriptTypes`, in
// "transform" mode so constructor parameter properties work), wired in with
// synchronous module hooks (`module.registerHooks`) that also resolve the
// `@/` and `@local/terminology` aliases and extensionless imports the same way
// tsconfig and vitest.config do. Both APIs are built into Node >= 22.15
// (package.json requires >= 22.12; the command says so if they are missing).
// JSX is not supported, so only .ts modules (no .tsx) may be on this path.
import module, { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { TERMINOLOGY_ALIAS, terminologyOverrideFile } from './terminology-alias.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The prototype never makes a network request; keep that true here too.
createRequire(import.meta.url)('./offline-guard.cjs');

function fail(message) {
  console.error(`slides: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// TypeScript loading
// ---------------------------------------------------------------------------

if (typeof module.registerHooks !== 'function' || typeof module.stripTypeScriptTypes !== 'function') {
  fail(`needs Node 22.15 or later for built-in TypeScript loading (this is ${process.version}).`);
}

const CANDIDATES = ['', '.ts', '/index.ts', '.mjs', '.js'];

function resolveFile(base) {
  for (const ext of CANDIDATES) {
    const file = base + ext;
    if (ext === '' && !/\.(ts|mjs|js|cjs|json)$/.test(file)) continue;
    if (existsSync(file)) return file;
  }
  return null;
}

const isAppTs = (url) => url.startsWith('file:') && url.endsWith('.ts') && !url.includes('/node_modules/');

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;
    if (specifier === TERMINOLOGY_ALIAS) return { url: pathToFileURL(terminologyOverrideFile(rootDir)).href, format: 'module', shortCircuit: true };
    if (specifier.startsWith('@/')) base = path.join(rootDir, specifier.slice(2));
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL && isAppTs(context.parentURL)) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (base) {
      const file = resolveFile(base);
      if (file) return { url: pathToFileURL(file).href, format: file.endsWith('.ts') ? 'module' : undefined, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!isAppTs(url)) return nextLoad(url, context);
    const loaded = nextLoad(url, { ...context, format: 'module' });
    const source = module.stripTypeScriptTypes(String(loaded.source), { mode: 'transform', sourceUrl: url });
    return { format: 'module', source, shortCircuit: true };
  },
});

// stripTypeScriptTypes prints an ExperimentalWarning once; it is expected here.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  const text = typeof warning === 'string' ? warning : warning?.message;
  if (text && text.includes('stripTypeScriptTypes')) return;
  emitWarning.call(process, warning, ...rest);
};

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    scope: { type: 'string' },
    pack: { type: 'string' },
    kinds: { type: 'string' },
    out: { type: 'string', default: path.join('out', 'slides') },
    'no-agent-narrative': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

const USAGE = 'usage: npm run slides -- --scope <portfolio|deliverable:ID|outcome:ID|pm-node:ID> [--pack ID] [--kinds a,b] [--out DIR] [--no-agent-narrative]';
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!args.scope) fail(`--scope is required.\n${USAGE}`);

function parseScope(text) {
  if (text === 'portfolio') return { kind: 'portfolio' };
  const at = text.indexOf(':');
  if (at < 1) fail(`cannot read scope "${text}".\n${USAGE}`);
  const kind = text.slice(0, at);
  const id = text.slice(at + 1);
  if (kind === 'deliverable') return { kind, deliverableId: id };
  if (kind === 'outcome') return { kind, outcomeId: id };
  if (['pm-node', 'programme', 'project', 'initiative'].includes(kind)) return { kind: 'pm-node', pmNodeId: id };
  fail(`unknown scope kind "${kind}".\n${USAGE}`);
}

const scope = parseScope(args.scope);
const kinds = args.kinds ? args.kinds.split(',').map((k) => k.trim()).filter(Boolean) : null;

// ---------------------------------------------------------------------------
// Build and write
// ---------------------------------------------------------------------------

const indexFile = path.join(rootDir, 'lib/slides/index.ts');
if (!existsSync(indexFile)) fail('lib/slides/index.ts is not there yet (the slide composer); nothing to build.');

const { createDemoStore } = await import('@/lib/store/store');
const slides = await import('@/lib/slides/index');
const { renderPptx } = await import('@/lib/slides/render/pptx');
const { default: PptxGenJS } = await import('pptxgenjs');

for (const name of ['buildDeck', 'buildPackDeck', 'buildSlides', 'defaultPackFor', 'packsFor']) {
  if (typeof slides[name] !== 'function') fail(`lib/slides/index.ts does not export ${name}.`);
}

// The same snapshot the app starts from: seeded data, engine results, drafts and the demo clock.
const state = createDemoStore().getState();
const ctx = { data: state.data, result: state.results, drafts: state.drafts, clock: state.clock };
const options = { includeAgentNarrative: !args['no-agent-narrative'] };

let deck;
try {
  if (kinds) {
    // Single slides: the named kinds, wrapped as a deck.
    deck = slides.buildDeck(slides.buildSlides(scope, kinds, ctx, options), ctx, { scope });
  } else {
    const packId = args.pack ?? slides.defaultPackFor(scope, ctx);
    const accepted = slides.packsFor(scope, ctx);
    if (!accepted.includes(packId)) fail(`pack "${packId}" does not accept scope ${args.scope} (accepted: ${accepted.join(', ') || 'none'}).`);
    deck = slides.buildPackDeck(packId, scope, options, ctx);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0) fail('the composer returned no slides for that scope.');

const outDir = path.resolve(process.cwd(), args.out);
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, deck.fileName);
const buffer = await renderPptx(deck, PptxGenJS, 'nodebuffer');
writeFileSync(file, buffer);
const shown = path.relative(process.cwd(), file);
console.log(`Wrote ${shown.startsWith('..') ? file : shown} (${deck.slides.length} slides, ${Math.round(buffer.length / 1024)} KB)`);
