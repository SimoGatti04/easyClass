/**
 * SearXNG-compatible web search plus guarded public-HTTPS page retrieval.
 * Search provider address is operator configuration; page URLs are untrusted.
 */
import crypto from 'node:crypto';
import https from 'node:https';
import net from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import { AIServiceError, ValidationError } from '../core/errors.js';

const USER_AGENT = 'TeacherService/0.1 (+educational-source-retrieval)';
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 12000;

function ipv4ToInt(address) {
  return address.split('.').reduce((value, part) => (value * 256) + Number(part), 0) >>> 0;
}

function ipv6ToBigInt(address) {
  let value = address.toLowerCase().split('%')[0];
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    const ipv4 = value.slice(lastColon + 1);
    const int = ipv4ToInt(ipv4);
    value = `${value.slice(0, lastColon)}:${(int >>> 16).toString(16)}:${(int & 0xffff).toString(16)}`;
  }
  const halves = value.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left;
  if (groups.length !== 8) return null;
  return groups.reduce((acc, group) => (acc << 16n) | BigInt(`0x${group || '0'}`), 0n);
}

export function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const ip = ipv4ToInt(address);
    const blocked = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
      ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
    ];
    return !blocked.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (ip & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (family === 6) {
    const ip = ipv6ToBigInt(address);
    if (ip === null) return false;
    // Only global-unicast 2000::/3 is allowed. Exclude special-use, transition,
    // and documentation ranges that are nominally inside that allocation.
    if ((ip >> 125n) !== 1n) return false;
    const prefix = (network, bits) => {
      const base = ipv6ToBigInt(network);
      if (base === null) return false;
      return (ip >> BigInt(128 - bits)) === (base >> BigInt(128 - bits));
    };
    return ![
      ['2001:db8::', 32], ['2001::', 23], ['2002::', 16],
      ['2001:10::', 28], ['2001:20::', 28], ['3fff::', 20]
    ].some(([base, bits]) => prefix(base, bits));
  }
  return false;
}

function assertSafePageUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new ValidationError('External source URL is invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new ValidationError('External pages must use public HTTPS URLs without credentials or non-standard ports');
  }
  if (!url.hostname || url.hostname.endsWith('.') || url.hostname.toLowerCase() === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) {
    throw new ValidationError('External source URL targets a non-public host');
  }
  return url;
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)));
}

export function extractPageText(html) {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const text = decodeEntities(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<title[^>]*>[\s\S]*?<\/title\s*>/gi, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
  return { title, content: text };
}

function requestHttpsOnce(url, address, { signal, timeoutMs, requestImpl = https.request } = {}) {
  return new Promise((resolve, reject) => {
    const family = net.isIP(address);
    const options = {
      protocol: 'https:',
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname || '/'}${url.search}`,
      method: 'GET',
      agent: false,
      rejectUnauthorized: true,
      servername: family ? undefined : url.hostname,
      lookup: (_hostname, lookupOptions, callback) => {
        if (lookupOptions?.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      },
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html, text/plain, application/xhtml+xml;q=0.9' },
      signal
    };
    let req;
    try { req = requestImpl(options, (res) => {
      const chunks = [];
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_PAGE_BYTES) {
          req.destroy(new AIServiceError('External page exceeds the safe retrieval size limit', 'WEB_PAGE_TOO_LARGE'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
      res.on('error', reject);
    }); } catch (error) { reject(error); return; }
    req.setTimeout(timeoutMs, () => req.destroy(new Error('External page retrieval timed out')));
    req.on('error', reject);
    req.end();
  });
}

export class WebResearchClient {
  constructor({
    searchUrl = process.env.TEACHER_SERVICE_WEB_SEARCH_URL || '',
    searchLanguage = process.env.TEACHER_SERVICE_WEB_SEARCH_LANGUAGE || 'all',
    fetchImpl = globalThis.fetch,
    lookupImpl = dnsLookup,
    requestImpl = https.request,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    this.searchUrl = searchUrl;
    this.searchLanguage = searchLanguage;
    this.fetchImpl = fetchImpl;
    this.lookupImpl = lookupImpl;
    this.requestImpl = requestImpl;
    this.timeoutMs = timeoutMs;
  }

  async search(query, { limit = 5, signal = null } = {}) {
    if (!this.searchUrl) {
      throw new AIServiceError('Web search is not configured; set TEACHER_SERVICE_WEB_SEARCH_URL to a SearXNG /search endpoint', 'WEB_SEARCH_NOT_CONFIGURED');
    }
    if (typeof query !== 'string' || !query.trim()) throw new ValidationError('Web search query is required');
    let endpoint;
    try { endpoint = new URL(this.searchUrl); } catch { throw new ValidationError('Configured web search URL is invalid'); }
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
      throw new ValidationError('Configured web search provider must be an HTTP(S) URL without embedded credentials');
    }
    if (!endpoint.pathname || endpoint.pathname === '/') endpoint.pathname = '/search';
    endpoint.searchParams.set('q', query.trim());
    endpoint.searchParams.set('format', 'json');
    if (this.searchLanguage) endpoint.searchParams.set('language', this.searchLanguage);

    let response;
    try {
      response = await this.fetchImpl(endpoint, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: signal || AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      throw new AIServiceError(`Web search provider request failed: ${error.message}`, 'WEB_SEARCH_FAILED');
    }
    if (!response.ok) throw new AIServiceError(`Web search provider returned HTTP ${response.status}`, 'WEB_SEARCH_FAILED', { status: response.status });
    let payload;
    try { payload = await response.json(); }
    catch { throw new AIServiceError('Web search provider returned invalid JSON', 'WEB_SEARCH_INVALID_RESPONSE'); }
    if (!Array.isArray(payload.results)) throw new AIServiceError('Web search provider response has no results array', 'WEB_SEARCH_INVALID_RESPONSE');
    return payload.results.slice(0, Math.max(0, Number(limit) || 0)).map((item) => ({
      title: String(item.title || item.url || 'Untitled web result').trim(),
      url: String(item.url || '').trim(),
      snippet: String(item.content || item.snippet || '').trim(),
      provider: 'searxng'
    })).filter((item) => item.url);
  }

  async fetchPage(input, { signal = null } = {}) {
    let url = assertSafePageUrl(input);
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const addresses = net.isIP(url.hostname)
        ? [{ address: url.hostname, family: net.isIP(url.hostname) }]
        : await this.lookupImpl(url.hostname, { all: true, verbatim: true });
      if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
        throw new ValidationError('External page hostname resolves to a non-public or mixed address set');
      }
      const response = await requestHttpsOnce(url, addresses[0].address, {
        signal: signal || AbortSignal.timeout(this.timeoutMs),
        timeoutMs: this.timeoutMs,
        requestImpl: this.requestImpl
      }).catch((error) => {
        if (error instanceof AIServiceError || error instanceof ValidationError) throw error;
        throw new AIServiceError(`External page retrieval failed: ${error.message}`, 'WEB_FETCH_FAILED');
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.location;
        if (!location || redirect === MAX_REDIRECTS) throw new AIServiceError('External page redirect limit exceeded or location missing', 'WEB_REDIRECT_REJECTED');
        url = assertSafePageUrl(new URL(location, url).toString());
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new AIServiceError(`External page returned HTTP ${response.status}`, 'WEB_FETCH_FAILED', { status: response.status });
      }
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (!(contentType.includes('text/html') || contentType.includes('text/plain') || contentType.includes('application/xhtml+xml'))) {
        throw new AIServiceError('External source is not a supported HTML or text page', 'WEB_UNSUPPORTED_CONTENT_TYPE', { contentType });
      }
      const parsed = contentType.includes('text/plain')
        ? { title: url.hostname, content: response.body.replace(/\s+/g, ' ').trim() }
        : extractPageText(response.body);
      if (!parsed.content) throw new AIServiceError('External page contained no extractable text', 'WEB_PAGE_EMPTY');
      const accessedAt = new Date().toISOString();
      return {
        title: parsed.title || url.hostname,
        url: url.toString(),
        content: parsed.content,
        contentHash: crypto.createHash('sha256').update(parsed.content).digest('hex'),
        accessedAt,
        contentType
      };
    }
    throw new AIServiceError('External page redirect limit exceeded', 'WEB_REDIRECT_REJECTED');
  }
}
