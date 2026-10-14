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
  if (typeof token !== 'string') {
    throw new Error('JWT token must be a string');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: expected 3 dot-separated segments');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  } catch (err) {
    throw new Error(`Invalid JWT header: ${err.message}`);
  }

  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch (err) {
    throw new Error(`Invalid JWT payload: ${err.message}`);
  }

  return {
    header,
    payload,
    headerB64,
    payloadB64,
    signatureB64
  };
}

export async function getCloudflarePublicKeys(certsUrl = DEFAULT_CF_ACCESS_CERTS_URL) {
  const now = Date.now();
  if (jwksCache.keys.size > 0 && now - jwksCache.fetchedAt < jwksCache.ttlMs) {
    return jwksCache.keys;
  }

  try {
    const res = await fetch(certsUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch JWKS from ${certsUrl}: status ${res.status}`);
    }

    const data = await res.json();
    const newKeys = new Map();

    if (Array.isArray(data.keys)) {
      for (const jwk of data.keys) {
        if (jwk.kid && jwk.kty === 'RSA') {
          try {
            const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
            newKeys.set(jwk.kid, keyObject);
          } catch {}
        }
      }
    }
    jwksCache = {
      keys: newKeys,
      fetchedAt: now,
      ttlMs: 60 * 60 * 1000
    };
    return newKeys;
  } catch (err) {
    if (jwksCache.keys.size > 0) {
      return jwksCache.keys;
    }
    throw new Error(`Cloudflare Access JWKS fetch failed: ${err.message}`);
  }
}

export async function verifyAssertion(token, {
  expectedAud,
  expectedIss = DEFAULT_CF_ACCESS_ISS,
  certsUrl = DEFAULT_CF_ACCESS_CERTS_URL,
  nowSec = Math.floor(Date.now() / 1000)
} = {}) {
  if (!expectedAud || typeof expectedAud !== 'string' || !expectedAud.trim()) {
    throw new Error('Security misconfiguration: expectedAud is strictly required');
  }

  const { header, payload, headerB64, payloadB64, signatureB64 } = parseJwt(token);

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }
  if (!header.kid) {
    throw new Error('JWT header missing key ID (kid)');
  }

  let publicKey;
  if (testAuthKeys) {
    if (testAuthKeys.keys && testAuthKeys.keys.has(header.kid)) {
      publicKey = testAuthKeys.keys.get(header.kid);
    } else if (testAuthKeys.publicKey && (!testAuthKeys.kid || testAuthKeys.kid === header.kid)) {
      publicKey = testAuthKeys.publicKey;
    }
  }

  if (!publicKey) {
    const keys = await getCloudflarePublicKeys(certsUrl);
    publicKey = keys.get(header.kid);
    if (!publicKey) {
      // Clear cache and retry once in case keys were rotated
      clearJwksCache();
      const refreshedKeys = await getCloudflarePublicKeys(certsUrl);
      publicKey = refreshedKeys.get(header.kid);
    }
  }

  if (!publicKey) {
    throw new Error(`Public key not found for kid: ${header.kid}`);
  }

  const signedContent = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(signatureB64, 'base64url');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signedContent);
  const isValid = verifier.verify(publicKey, signature);
  if (!isValid) {
    throw new Error('Cryptographic signature verification failed');
  }

  const tokenIss = String(payload.iss || '').replace(/\/+$/, '');
  const cleanExpectedIss = String(expectedIss || '').replace(/\/+$/, '');
  if (tokenIss !== cleanExpectedIss) {
    throw new Error(`Issuer mismatch: expected "${cleanExpectedIss}", got "${tokenIss}"`);
  }

  const cleanExpectedAud = expectedAud.trim();
  const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!tokenAud.includes(cleanExpectedAud)) {
    throw new Error(`Audience mismatch: expected "${cleanExpectedAud}"`);
  }

  const clockSkewSec = 60;
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    throw new Error('JWT is missing a valid numeric expiration (exp)');
  }
  if (payload.exp < nowSec - clockSkewSec) {
    throw new Error(`Token expired at ${payload.exp}, current time ${nowSec}`);
  }
  if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || !Number.isFinite(payload.nbf))) {
    throw new Error('JWT has an invalid numeric not-before claim (nbf)');
  }
  if (payload.nbf !== undefined && payload.nbf > nowSec + clockSkewSec) {
    throw new Error(`Token not active until ${payload.nbf}`);
  }

  const sub = payload.sub || payload.email || 'anonymous';
  const principal = computePrincipalHash(payload.iss, sub);

  return {
    verified: true,
    principal,
    sub,
    email: payload.email || null,
    identity: payload.identity_nonce || null
  };
}

export async function authenticateRequest(req, options = {}) {
  const mode = options.authMode || process.env.TEACHER_SERVICE_AUTH_MODE || 'strict';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && mode !== 'strict') {
    return {
      authenticated: false,
      statusCode: 500,
      error: 'Security violation: Authentication cannot be disabled in production environment'
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

  const expectedAud = options.expectedAud || process.env.TEACHER_SERVICE_CF_ACCESS_AUD || '';
  if (mode === 'strict' && (!expectedAud || !expectedAud.trim())) {
    return {
      authenticated: false,
      statusCode: 500,
      error: 'Security misconfiguration: CF_ACCESS_AUD is not configured in strict auth mode'
    };
  }

  // 1. Check Cf-Access-Jwt-Assertion header
  const rawCf = req.headers['cf-access-jwt-assertion'];
  const cfAssertion = Array.isArray(rawCf) ? rawCf[0] : rawCf;
  if (cfAssertion && typeof cfAssertion === 'string') {
    try {
      const verified = await verifyAssertion(cfAssertion.trim(), options);
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
        const verified = await verifyAssertion(token, options);
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
