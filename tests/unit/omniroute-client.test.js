import test from 'node:test';
import assert from 'node:assert/strict';
import { OmniRouteClient } from '../../src/ai/omniroute-client.js';

test('OmniRoute uses configurable models, ordinary compatible responses, and no default token cap', async (t) => {
  const requests = [];
  const client = new OmniRouteClient({
    baseUrl: 'https://gateway.test/v1',
    apiKey: 'synthetic-key',
    defaultModel: 'provider/configured-model',
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options, payload: JSON.parse(options.body) });
      return new Response(JSON.stringify({
        model: 'provider/actual-model',
        choices: [{ message: { role: 'assistant', content: 'Generated synthetic lesson.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  const result = await client.complete({ messages: [{ role: 'user', content: 'Synthetic lesson request' }] });
  assert.equal(requests[0].url, 'https://gateway.test/v1/chat/completions');
  assert.equal(requests[0].payload.model, 'provider/configured-model');
  assert.equal(Object.hasOwn(requests[0].payload, 'max_tokens'), false);
  assert.equal(result.content, 'Generated synthetic lesson.');
  assert.equal(result.model, 'provider/actual-model');
  assert.equal(result.telemetry.totalTokens, 20);
  assert.equal(result.isMock, false);

  const explicit = new OmniRouteClient({
    baseUrl: 'https://gateway.test/v1', apiKey: 'synthetic-key', defaultModel: 'fallback/model',
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, 'caller/selected-model');
      assert.equal(payload.max_tokens, 333);
      return new Response(JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: 'Text block one.' }, { type: 'image', image_url: 'ignored' }, { type: 'text', text: 'Text block two.' }] } }] }), { status: 200 });
    }
  });
  const structured = await explicit.complete({ messages: [{ role: 'user', content: 'x' }], model: 'caller/selected-model', maxTokens: 333 });
  assert.equal(structured.content, 'Text block one.\nText block two.');

  const empty = new OmniRouteClient({
    apiKey: 'synthetic-key',
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 })
  });
  await assert.rejects(() => empty.complete({ messages: [{ role: 'user', content: 'x' }] }), { code: 'OMNIROUTE_EMPTY_RESPONSE' });
});
