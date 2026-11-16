#!/usr/bin/env node
// Minimal static file server for the exported site in out/ (used by the e2e
// tests and `npm start`). No dependencies, binds to loopback only.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
const port = Number(process.env.PORT ?? process.argv[2] ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

async function resolveFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath.split('?')[0] ?? '/')).replace(/^([/\\])+/, '');
  const candidate = path.join(root, clean);
  if (!candidate.startsWith(root)) return null;
  for (const file of [candidate, path.join(candidate, 'index.html'), `${candidate}.html`]) {
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? '/');
  if (!file) {
    const notFound = await resolveFile('/404.html');
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(notFound ? await readFile(notFound) : 'Not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving out/ on http://127.0.0.1:${port}`);
});
