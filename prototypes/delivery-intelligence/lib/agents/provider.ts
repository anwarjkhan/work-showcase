/**
 * Model providers. This build has exactly one: the scripted provider, which
 * makes no external call. Agents compose their text deterministically from the
 * data; the provider is the seam where an approved model would take over the
 * wording (never the facts or the citations, which stay computed).
 *
 * To plug in an approved model (design section 8, step 5):
 *
 *   export const approvedModelProvider: ModelProvider = {
 *     id: 'approved-model', label: terms.modelPlatform, kind: 'model', live: true,
 *     async generate(request) {
 *       // POST request.messages to the approved platform's endpoint, constrain the
 *       // answer to request.context, and return { providerId, text, citations, provenance: 'computed' }.
 *     },
 *   };
 *
 * then return it from `activeProvider()` behind a configuration flag.
 */
import type { ModelProvider, ModelRequest, ModelResponse } from '@/lib/types';

export const scriptedProvider: ModelProvider = {
  id: 'scripted',
  label: 'Scripted agent (no model)',
  kind: 'scripted',
  live: false,
  async generate(request: ModelRequest): Promise<ModelResponse> {
    // Echo the composed text: the scripted agent has already written it from the data.
    const last = [...request.messages].reverse().find((m) => m.role !== 'system');
    return { providerId: 'scripted', text: last?.content ?? '', citations: request.context, provenance: 'scripted-agent' };
  },
};

/** The provider agent runs record in `AgentRun.providerId`. */
export function activeProvider(): ModelProvider {
  return scriptedProvider;
}
