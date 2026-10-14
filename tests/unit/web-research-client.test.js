import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WebResearchClient, isPublicAddress } from '../../src/ai/web-research-client.js';

test('external page retrieval rejects private addresses, credentials, and unsafe redirects', async () => {
  assert.equal(isPublicAddress('93.184.216.34'), true);
  assert.equal(isPublicAddress('10.1.2.3'), false);
  assert.equal(isPublicAddress('198.51.100.13'), false);
  assert.equal(isPublicAddress('::1'), false);
  assert.equal(isPublicAddress('::ffff:127.0.0.1'), false);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);

  let requestCount = 0;
  const privateDns = new WebResearchClient({ lookupImpl: async () => [{ address: '198.51.100.13', family: 4 }] });
  await assert.rejects(() => privateDns.fetchPage('https://example.org/page'), /non-public/);
  await assert.rejects(() => privateDns.fetchPage('http://example.org/page'), /public HTTPS/);
  await assert.rejects(() => privateDns.fetchPage('https://user:pass@example.org/page'), /public HTTPS/);
  await assert.rejects(() => privateDns.fetchPage('https://example.org:8443/page'), /public HTTPS/);

  const redirecting = new WebResearchClient({
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    requestImpl: (_options, callback) => {
      requestCount += 1;
      const request = new EventEmitter();
      request.setTimeout = () => {};
      request.destroy = (error) => { if (error) queueMicrotask(() => request.emit('error', error)); };
      request.end = () => {
        const response = new EventEmitter();
        response.statusCode = 302;
        response.headers = { location: 'https://127.0.0.1/admin' };
        callback(response);
        queueMicrotask(() => response.emit('end'));
      };
      return request;
    }
  });
  await assert.rejects(() => redirecting.fetchPage('https://example.org/start'), /non-public/);
  assert.equal(requestCount, 1, 'The unsafe redirect target must be rejected before connecting');
});
