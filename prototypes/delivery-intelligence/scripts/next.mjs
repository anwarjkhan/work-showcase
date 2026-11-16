#!/usr/bin/env node
// Runs the Next.js CLI with networking switched off (telemetry disabled and the
// offline guard preloaded). Cross-platform replacement for `VAR=1 next ...`.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const guard = path.join(here, 'offline-guard.cjs');

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require "${guard}"`].filter(Boolean).join(' '),
};

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
