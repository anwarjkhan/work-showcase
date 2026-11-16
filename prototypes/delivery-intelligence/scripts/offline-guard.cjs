// Preloaded into every Next.js process by scripts/next.mjs.
//
// The prototype must never send a request off the machine. Next.js's dev
// server asks the public npm registry for its latest version; this guard makes
// any fetch to a non-loopback host fail fast instead (Next.js ignores the
// failure). Loopback requests, which Next.js uses internally, pass through.
'use strict';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);
const realFetch = globalThis.fetch;

if (typeof realFetch === 'function' && !globalThis.__diOfflineGuard) {
  globalThis.__diOfflineGuard = true;
  globalThis.fetch = function guardedFetch(input, init) {
    let host = '';
    try {
      const url = typeof input === 'string' || input instanceof URL ? new URL(String(input)) : new URL(input.url);
      host = url.hostname;
    } catch {
      // Relative or unparsable URL: not an outbound request.
      return realFetch(input, init);
    }
    if (LOOPBACK.has(host)) return realFetch(input, init);
    return Promise.reject(new Error(`Blocked outbound request to ${host}: this prototype runs offline.`));
  };
}
