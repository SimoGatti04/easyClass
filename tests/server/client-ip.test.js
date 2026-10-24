import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientIp } from '../../src/server/client-ip.js';

test('rate-limit client identity ignores forwarded headers unless the immediate peer is a trusted proxy', () => {
  const spoofed = {
    socket: { remoteAddress: '10.42.1.19' },
    headers: { 'cf-connecting-ip': '203.0.113.99', 'x-forwarded-for': '198.51.100.23' }
  };
  assert.equal(resolveClientIp(spoofed), '10.42.1.19');
  assert.equal(resolveClientIp(spoofed, ['10.42.0.0/16']), '203.0.113.99');
  assert.equal(resolveClientIp({ ...spoofed, headers: { 'x-forwarded-for': '198.51.100.23' } }, ['10.42.0.0/16']), '10.42.1.19');
  assert.equal(resolveClientIp({ ...spoofed, headers: { 'cf-connecting-ip': 'not-an-ip' } }, ['10.42.0.0/16']), '10.42.1.19');
});

test('rate-limit proxy matching normalizes IPv4-mapped peer addresses and rejects invalid CIDRs', () => {
  const request = {
    socket: { remoteAddress: '::ffff:10.42.1.19' },
    headers: { 'cf-connecting-ip': '198.51.100.7' }
  };
  assert.equal(resolveClientIp(request, ['not-a-cidr']), '10.42.1.19');
  assert.equal(resolveClientIp(request, ['10.42.1.0/24']), '198.51.100.7');
});
