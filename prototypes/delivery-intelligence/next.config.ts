import path from 'node:path';
import type { NextConfig } from 'next';
import { TERMINOLOGY_ALIAS, terminologyOverrideFile } from './scripts/terminology-alias.mjs';

// No network at build or run time: opt out of Next.js telemetry before the
// build initialises it. (scripts/next.mjs also sets this for every command.)
process.env.NEXT_TELEMETRY_DISABLED = '1';

const rootDir = process.cwd();
const overrideFile = terminologyOverrideFile(rootDir);

const nextConfig: NextConfig = {
  // Fully static: `next build` writes plain files to out/ for internal hosting.
  output: 'export',
  // Each route becomes <route>/index.html, which any static file server serves.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  // `next dev` would otherwise write an AGENTS.md into the project folder.
  agentRules: false,
  turbopack: {
    root: rootDir,
    resolveAlias: {
      // Turbopack wants a project-relative path here.
      [TERMINOLOGY_ALIAS]: `./${path.relative(rootDir, overrideFile).split(path.sep).join('/')}`,
    },
  },
  // Only used with `next build --webpack`; kept so both bundlers agree.
  webpack(config: { resolve: { alias: Record<string, string> } }) {
    config.resolve.alias[TERMINOLOGY_ALIAS] = overrideFile;
    return config;
  },
};

export default nextConfig;
