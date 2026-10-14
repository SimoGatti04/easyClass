/**
 * Network boundary for ChatGPT file-reference imports & external fetches.
 * Enforces strict SSRF protection, IP pinning, DNS rebinding prevention, and bounded responses.
 */
import dnsLookup from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';
import { Readable } from 'node:stream';
import { SecurityError } from '../core/errors.js';

const MAX_RESOLVED_ADDRESSES = 16;

// Deny non-global IPv4 ranges and accept IPv6 only from global-unicast space,
// excluding special-purpose, transition, and documentation allocations.
const nonPublicIpv4 = new net.BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
]) nonPublicIpv4.addSubnet(network, prefix, 'ipv4');

const globalUnicastIpv6 = new net.BlockList();
globalUnicastIpv6.addSubnet('2000::', 3, 'ipv6');
const nonPublicIpv6 = new net.BlockList();
for (const [network, prefix] of [
  ['2001::', 23], // IETF special-purpose allocations
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 embeds arbitrary IPv4 destinations
  ['3fff::', 20] // documentation
]) nonPublicIpv6.addSubnet(network, prefix, 'ipv6');

/** Returns true only for public unicast DNS answers, not private or special-use ranges. */
export function isPublicNetworkAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return !nonPublicIpv4.check(address, 'ipv4');
  if (family !== 6 || address.includes('%')) return false;
  return globalUnicastIpv6.check(address, 'ipv6') && !nonPublicIpv6.check(address, 'ipv6');
}

function awaitWithAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason || new Error('Aborted'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason || new Error('Aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      value => { signal.removeEventListener('abort', onAbort); resolve(value); },
      error => { signal.removeEventListener('abort', onAbort); reject(error); }
    );
  });
}

/** Resolve once, reject any non-public answer, and return addresses to pin for the HTTPS request. */
export async function resolvePublicAddresses(hostname, { lookupImpl = dnsLookup.lookup, signal } = {}) {
  let addresses;
  try {
    addresses = await awaitWithAbort(
      lookupImpl(hostname, { all: true }),
      signal
    );
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw error;
    throw new SecurityError('ChatGPT file host DNS lookup failed', {
      hostname,
      reasons: ['DNS_LOOKUP_FAILED']
    });
  }

  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.length > MAX_RESOLVED_ADDRESSES) {
    throw new SecurityError('ChatGPT file host did not resolve to a bounded public address set', {
      hostname,
      reasons: ['DNS_ADDRESS_SET_INVALID']
    });
  }

  const normalized = [];
  for (const entry of addresses) {
    const address = entry?.address;
    const family = Number(entry?.family);
    if (net.isIP(address) !== family || !isPublicNetworkAddress(address)) {
      throw new SecurityError('ChatGPT file host resolved to a non-public network address', {
        hostname,
        reasons: ['NON_PUBLIC_ADDRESS_BLOCKED']
      });
    }
    normalized.push({ address, family });
  }

  return normalized;
}

/** Issues a pinned HTTPS GET request rejecting redirects and binding DNS to pre-validated public IPs. */
export function fetchHttpsPinned(url, addresses, signal) {
  const expectedHostname = url.hostname.toLowerCase();
  const lookup = (hostname, options, callback) => {
    if (hostname.toLowerCase() !== expectedHostname) {
      callback(new Error('Connection host is not pinned'));
      return;
    }
    const candidates = options?.family
      ? addresses.filter(item => item.family === options.family)
      : addresses;
    if (!candidates.length) {
      callback(new Error('No validated address is available for this connection'));
      return;
    }
    if (options?.all) callback(null, candidates);
    else callback(null, candidates[0].address, candidates[0].family);
  };

  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ keepAlive: false, lookup, autoSelectFamily: true });
    const request = https.request(url, {
      method: 'GET',
      agent,
      lookup,
      autoSelectFamily: true,
      servername: expectedHostname,
      signal
    }, response => {
      response.once('close', () => agent.destroy());
      resolve({
        status: response.statusCode || 0,
        redirected: false,
        url: url.href,
        headers: { get: name => response.headers[name.toLowerCase()] ?? null },
        body: Readable.toWeb(response)
      });
    });
    request.once('error', error => {
      agent.destroy();
      reject(error);
    });
    request.end();
  });
}
