/**
 * Teacher Service — Cloudflare Access & Bearer Token Authentication
 *
 * Implements fail-closed verification of Cf-Access-Jwt-Assertion and Bearer authorization tokens.
 * Validates RS256 signature, issuer, audience, and expiration.
 * Enforces session-to-principal isolation via SessionPrincipalRegistry.
 * Zero token/secret logging invariant.
 */
import crypto from 'node:crypto';

export const DEFAULT_CF_ACCESS_ISS = 'https://simogatti.cloudflareaccess.com';
export const DEFAULT_CF_ACCESS_CERTS_URL = 'https://simogatti.cloudflareaccess.com/cdn-cgi/access/certs';

let jwksCache = {
  keys: new Map(),
  fetchedAt: 0,
  ttlMs: 60 * 60 * 1000 // 1 hour TTL
};

let testAuthKeys = null;

export function setTestAuthKeys(keys) {
  testAuthKeys = keys;
}

export function clearJwksCache() {
  jwksCache.keys.clear();
  jwksCache.fetchedAt = 0;
}

export function computePrincipalHash(iss, sub) {
  const raw = `${iss}:${sub}`;
  const digest = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  return `sha256:${digest}`;
}

export class SessionPrincipalRegistry {
  constructor() {
    this._sessions = new Map();
  }

  bind(sessionId, principal) {
    if (!sessionId || !principal) return false;
    const bound = this._sessions.get(sessionId);
    if (!bound) {
      this._sessions.set(sessionId, principal);
      return true;
    }
    return bound === principal;
  }

  validate(sessionId, principal) {
    if (!sessionId || !principal) return false;
    const bound = this._sessions.get(sessionId);
    return bound === principal;
  }

  has(sessionId) {
    return this._sessions.has(sessionId);
  }

  getPrincipal(sessionId) {
    return this._sessions.get(sessionId);
  }

  unregister(sessionId) {
    this._sessions.delete(sessionId);
  }

  clear() {
    this._sessions.clear();
  }

  get size() {
    return this._sessions.size;
  }
}

export function parseJwt(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('JWT must be a non-empty string');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: expected 3 dot-separated parts');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
  } catch (err) {
    throw new Error(`Invalid JWT header: ${err.message}`);
  }

  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
  } catch (err) {
    throw new Error(`Invalid JWT payload: ${err.message}`);
  }

  return { header, payload, headerB64, payloadB64, signatureB64 };
}

export async function fetchJwks(certsUrl = DEFAULT_CF_ACCESS_CERTS_URL) {
  if (testAuthKeys) {
    return testAuthKeys;
  }

  const now = Date.now();
  if (jwksCache.keys.size > 0 && (now - jwksCache.fetchedAt) < jwksCache.ttlMs) {
    return jwksCache;
  }

  const response = await fetch(certsUrl, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Cloudflare Access JWKS from ${certsUrl}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.keys)) {
    throw new Error('Invalid JWKS response: expected keys array');
  }

  const newKeys = new Map();
  for (const jwk of data.keys) {
    if (jwk.kid && jwk.kty === 'RSA') {
      try {
        const keyObject = crypto.createPublicKey({
          key: jwk,
          format: 'jwk'
        });
        newKeys.set(jwk.kid, keyObject);
      } catch (err) {
        // Skip unparseable keys
      }
    }
  }

  if (newKeys.size === 0) {
    throw new Error('JWKS response contained no valid RSA keys');
  }

  jwksCache.keys = newKeys;
  jwksCache.fetchedAt = now;
  return jwksCache;
}

export async function verifyAssertion(token, {
  expectedAud,
  expectedIss = DEFAULT_CF_ACCESS_ISS,
  certsUrl = DEFAULT_CF_ACCESS_CERTS_URL,
  nowSec = Math.floor(Date.now() / 1000)
} = {}) {
  const expectedAuds = (Array.isArray(expectedAud) ? expectedAud : String(expectedAud || '').split(','))
    .map(a => typeof a === 'string' ? a.trim() : '')
    .filter(Boolean);
  if (expectedAuds.length === 0) {
    throw new Error('Security misconfiguration: expectedAud is strictly required');
  }

  const { header, payload, headerB64, payloadB64, signatureB64 } = parseJwt(token);

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported JWT algorithm: expected RS256, got "${header.alg}"`);
  }

  if (!header.kid) {
    throw new Error('JWT header missing key ID (kid)');
  }

  let key = null;
  if (testAuthKeys) {
    if (testAuthKeys.keys && testAuthKeys.keys.has(header.kid)) {
      key = testAuthKeys.keys.get(header.kid);
    } else if (testAuthKeys.publicKey && (!testAuthKeys.kid || testAuthKeys.kid === header.kid)) {
      key = testAuthKeys.publicKey;
    }
  }
  if (!key) {
    const jwks = await fetchJwks(certsUrl);
    key = jwks.keys?.get(header.kid);
  }
  if (!key) {
    throw new Error(`Public key not found for kid: "${header.kid}"`);
  }

  const signedContent = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(signatureB64, 'base64url');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signedContent);
  const isValid = verifier.verify(key, signature);

  if (!isValid) {
    throw new Error('Invalid JWT signature: verification failed against Cloudflare public cert');
  }

  const tokenIss = String(payload.iss || '').replace(/\/+$/, '');
  const cleanExpectedIss = String(expectedIss || '').replace(/\/+$/, '');
  if (tokenIss !== cleanExpectedIss) {
    throw new Error(`Issuer mismatch: expected "${cleanExpectedIss}", got "${tokenIss}"`);
  }

  const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const audMatched = tokenAud.some(a => expectedAuds.includes(a));
  if (!audMatched) {
    throw new Error(`Audience mismatch: expected one of [${expectedAuds.join(', ')}]`);
  }

  const clockSkewSec = 60;
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    throw new Error('JWT is missing a valid numeric expiration (exp)');
  }
  if (payload.exp < (nowSec - clockSkewSec)) {
    throw new Error(`JWT expired at ${new Date(payload.exp * 1000).toISOString()}`);
  }

  if (payload.nbf && typeof payload.nbf === 'number' && payload.nbf > (nowSec + clockSkewSec)) {
    throw new Error(`JWT not valid before ${new Date(payload.nbf * 1000).toISOString()}`);
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('JWT missing sub claim');
  }

  const principal = computePrincipalHash(payload.iss, payload.sub);

  return {
    valid: true,
    principal,
    sub: payload.sub,
    email: payload.email || payload.sub,
    payload
  };
}

export async function authenticateRequest(req, options = {}) {
  const isProduction = options.isProduction !== undefined
    ? Boolean(options.isProduction)
    : process.env.NODE_ENV === 'production';
  const mode = options.authMode || process.env.TEACHER_SERVICE_AUTH_MODE || 'strict';

  if (isProduction) {
    if (mode !== 'strict') {
      return {
        authenticated: false,
        statusCode: 500,
        error: `Security violation: authMode "${mode}" is strictly forbidden in production`
      };
    }
    if (options.allowSyntheticAuth || (req.headers && req.headers['x-test-synthetic-user'])) {
      return {
        authenticated: false,
        statusCode: 403,
        error: 'Forbidden: Synthetic authentication is strictly forbidden in production'
      };
    }
  }

  if (mode === 'preview' && !isProduction) {
    return {
      authenticated: true,
      authMethod: 'synthetic',
      principal: 'sha256:preview_teacher_synthetic',
      user: { sub: 'teacher@school.example', email: 'teacher@school.example', name: 'Synthetic Teacher' }
    };
  }

  if (mode === 'permissive') {
    return {
      authenticated: true,
      authMethod: 'permissive_fallback',
      principal: 'sha256:permissive_fallback_principal',
      user: { sub: 'permissive-user', email: 'permissive@local' }
    };
  }

  if (mode === 'disabled') {
    return {
      authenticated: true,
      authMethod: 'disabled',
      principal: 'sha256:test_mode_principal_unauthenticated',
      user: { sub: 'test-user', email: 'test@local' }
    };
  }

  if (!isProduction && options.allowSyntheticAuth && req.headers && req.headers['x-test-synthetic-user']) {
    const syntheticEmail = String(req.headers['x-test-synthetic-user']).trim();
    return {
      authenticated: true,
      authMethod: 'synthetic',
      principal: `sha256:synthetic_${syntheticEmail}`,
      user: { sub: syntheticEmail, email: syntheticEmail }
    };
  }

  const rawExpectedAud = options.expectedAud;
  const expectedAudList = (Array.isArray(rawExpectedAud) ? rawExpectedAud : String(rawExpectedAud || '').split(','))
    .map(a => typeof a === 'string' ? a.trim() : '')
    .filter(Boolean);

  if (mode === 'strict' && expectedAudList.length === 0) {
    return {
      authenticated: false,
      statusCode: 500,
      error: 'Security misconfiguration: CF_ACCESS_AUD is not configured in strict auth mode'
    };
  }

  // 1. Check Cf-Access-Jwt-Assertion header or CF_Authorization cookie
  const rawCf = req.headers['cf-access-jwt-assertion'];
  let cfAssertion = Array.isArray(rawCf) ? rawCf[0] : rawCf;
  if (!cfAssertion && req.headers['cookie']) {
    const cookieMatch = req.headers['cookie'].match(/(?:^|;\s*)CF_Authorization=([^;]*)/);
    if (cookieMatch) {
      cfAssertion = decodeURIComponent(cookieMatch[1].trim());
    }
  }

  if (cfAssertion && typeof cfAssertion === 'string') {
    try {
      const verified = await verifyAssertion(cfAssertion.trim(), { ...options, expectedAud: expectedAudList });
      return {
        authenticated: true,
        authMethod: 'cloudflare_access',
        principal: verified.principal,
        user: { sub: verified.sub, email: verified.email }
      };
    } catch (err) {
      return {
        authenticated: false,
        statusCode: 401,
        error: `Cloudflare Access authentication failed: ${err.message}`
      };
    }
  }

  // 2. Check Authorization Bearer header
  const rawAuth = req.headers['authorization'];
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const token = match[1].trim();

      // Check configured bearer secret token if present
      const configuredBearer = options.bearerToken || process.env.TEACHER_SERVICE_BEARER_TOKEN;
      if (configuredBearer && token === configuredBearer) {
        return {
          authenticated: true,
          authMethod: 'shared_bearer',
          principal: 'sha256:bearer_authenticated_token',
          user: { sub: 'bearer-client', email: 'bearer@local' }
        };
      }

      // Check if it's a JWT assertion
      try {
        const verified = await verifyAssertion(token, { ...options, expectedAud: expectedAudList });
        return {
          authenticated: true,
          authMethod: 'cloudflare_access',
          principal: verified.principal,
          user: { sub: verified.sub, email: verified.email }
        };
      } catch (err) {
        return {
          authenticated: false,
          statusCode: 401,
          error: `Bearer assertion failed: ${err.message}`
        };
      }
    }
  }

  return {
    authenticated: false,
    statusCode: 401,
    error: 'Authentication credentials missing (expected Cf-Access-Jwt-Assertion or Bearer token)'
  };
}

export function validateCsrf(req, configuredAllowedOrigins = []) {
  const method = (req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  // 1. Host header validation (guard against host header poisoning)
  const host = req.headers['host'];
  if (!host || typeof host !== 'string' || !host.trim()) {
    return { valid: false, error: 'Missing or empty Host header' };
  }
  const cleanHost = host.trim().toLowerCase();

  const allowedHosts = new Set(
    configuredAllowedOrigins.map(origin => {
      try {
        return new URL(origin).host.toLowerCase();
      } catch {
        return null;
      }
    }).filter(Boolean)
  );

  const isLocalHost = cleanHost.startsWith('localhost') || cleanHost.startsWith('127.0.0.1');
  if (allowedHosts.size > 0 && !allowedHosts.has(cleanHost) && !isLocalHost) {
    return { valid: false, error: `Untrusted Host header: "${host}"` };
  }

  // 2. Sec-Fetch-Site validation
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    return { valid: false, error: 'Cross-site request blocked by Sec-Fetch-Site policy' };
  }

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  const cookieHeader = req.headers['cookie'];
  const hasCookieAuth = typeof cookieHeader === 'string' && cookieHeader.includes('CF_Authorization');

  // 3. Origin validation
  if (origin && typeof origin === 'string') {
    const cleanOrigin = origin.trim();
    let originAllowed = configuredAllowedOrigins.includes(cleanOrigin);
    if (!originAllowed) {
      try {
        const parsedOrigin = new URL(cleanOrigin);
        if (parsedOrigin.host.toLowerCase() === cleanHost) {
          originAllowed = true;
        }
      } catch {}
    }
    if (!originAllowed) {
      return { valid: false, error: `Invalid or untrusted Origin "${origin}"` };
    }
    return { valid: true };
  }

  // 4. Referer validation when Origin is omitted (e.g. same-origin navigations/forms)
  if (referer && typeof referer === 'string') {
    let refererAllowed = false;
    try {
      const parsedReferer = new URL(referer);
      if (parsedReferer.host.toLowerCase() === cleanHost || allowedHosts.has(parsedReferer.host.toLowerCase())) {
        refererAllowed = true;
      }
    } catch {}
    if (!refererAllowed) {
      return { valid: false, error: `Invalid or untrusted Referer "${referer}"` };
    }
    return { valid: true };
  }

  // 5. Fail-closed: If request uses browser cookie-based session, Origin or Referer is mandatory
  const isBrowserClient = Boolean(hasCookieAuth || req.headers['sec-fetch-mode'] || (cookieHeader && cookieHeader.trim().length > 0));
  if (isBrowserClient) {
    return {
      valid: false,
      error: 'CSRF check failed: cookie-authenticated state mutation requires Origin or Referer header'
    };
  }

  // Programmatic non-browser clients using Bearer/assertion headers without cookies are allowed if Host is verified
  return { valid: true };
}


  
