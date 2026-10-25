#!/usr/bin/env node
/**
 * Teacher Service — Internal Pre-Opening Read-Only Smoke Test Gate
 *
 * Runs non-destructive, strictly read-only HTTP smoke checks against an
 * internal application instance (e.g. http://127.0.0.1:8770 or container http://127.0.0.1:80)
 * before any Cloudflare edge routing change is applied.
 *
 * Invariants:
 * 1. Must NOT mutate SQLite database or FileStore.
 * 2. Must NOT record rate limiting failure counters or block classroom IPs/devices.
 * 3. Must NOT send unauthorized local Origin headers that trigger CORS/Origin rejections.
 * 4. Distinguishes fail-closed authentication (401) from transport errors.
 */

const targetUrl = (process.argv[2] || process.env.TEACHER_SERVICE_TARGET_URL || 'http://127.0.0.1:8770').replace(/\/+$/, '');

console.log(`[PRE-OPENING GATE] Running internal read-only smoke checks against: ${targetUrl}
`);

const checks = [
  {
    name: '1. Health endpoint (/health)',
    method: 'GET',
    path: '/health',
    expectedStatus: [200],
    validate: (res, json, text) => {
      if (!json || json.status !== 'ok' || json.service !== 'teacher-service') {
        throw new Error(`Unexpected health payload: ${text.slice(0, 100)}`);
      }
    }
  },
  {
    name: '2. Web SPA root (/)',
    method: 'GET',
    path: '/',
    expectedStatus: [200],
    validate: (res, json, text) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html') || !text.includes('root')) {
        throw new Error(`Expected HTML SPA shell, got content-type "${ct}"`);
      }
    }
  },
  {
    name: '3. Student SPA route (/studente)',
    method: 'GET',
    path: '/studente',
    expectedStatus: [200],
    validate: (res, json, text) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html') || !text.includes('root')) {
        throw new Error(`Expected HTML SPA shell, got content-type "${ct}"`);
      }
    }
  },
  {
    name: '4. Database read path (/api/student/classes)',
    method: 'GET',
    path: '/api/student/classes',
    expectedStatus: [200],
    validate: (res, json, text) => {
      if (!json || !Array.isArray(json.classes)) {
        throw new Error(`Expected JSON object with classes array, got: ${text.slice(0, 100)}`);
      }
    }
  },
  {
    name: '5. Fail-closed teacher authorization (/api/classes)',
    method: 'GET',
    path: '/api/classes',
    expectedStatus: [401, 403],
    validate: (res, json, text) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`Expected JSON rejection, got: ${ct}`);
      }
    }
  },
  {
    name: '6. Student claim schema validation (/api/student/claim-code)',
    method: 'POST',
    path: '/api/student/claim-code',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    expectedStatus: [400],
    validate: (res, json, text) => {
      if (!json || (json.error !== 'BadRequest' && json.error !== 'ValidationError')) {
        throw new Error(`Expected BadRequest / ValidationError on empty claim body, got: ${text.slice(0, 100)}`);
      }
    }
  },
  {
    name: '7. MCP streamable HTTP transport (/mcp)',
    method: 'POST',
    path: '/mcp',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
    expectedStatus: [401, 200, 400, 405],
    validate: (res, json, text) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`Expected application/json response from MCP endpoint, got: ${ct}`);
      }
      if (!json || json.jsonrpc !== '2.0') {
        throw new Error(`Expected JSON-RPC 2.0 response from MCP endpoint, got: ${text.slice(0, 120)}`);
      }
      if (res.status === 401) {
        // Authenticated access is required and fail-closed is active; this is healthy protocol behavior, not a transport error
        const msg = json.error?.message || '';
        if (!msg.toLowerCase().includes('unauthorized') && !msg.toLowerCase().includes('cf_access_aud')) {
          throw new Error(`Expected 401 Unauthorized JSON-RPC error, got: ${text.slice(0, 120)}`);
        }
      }
    }
  }
];

let failed = 0;

for (const check of checks) {
  const url = `${targetUrl}${check.path}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Note: Do NOT automatically send Origin: targetUrl.
    // MCP clients and API probes are not cross-origin browsers; sending an unauthorized
    // local origin triggers strict Origin rejection (403) before authentication/protocol checks.
    const headers = {
      Host: new URL(targetUrl).host,
      ...(check.headers || {})
    };
    const res = await fetch(url, {
      method: check.method,
      headers,
      body: check.body || undefined,
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (!check.expectedStatus.includes(res.status)) {
      throw new Error(`Status ${res.status} not in expected [${check.expectedStatus.join(', ')}]. Body: ${text.slice(0, 120)}`);
    }

    if (check.validate) {
      check.validate(res, json, text);
    }

    console.log(`  [PASS] ${check.name} -> HTTP ${res.status}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${check.name} -> ${err.message}`);
  }
}

console.log('');
if (failed > 0) {
  console.error(`[PRE-OPENING GATE REJECTED] ${failed} check(s) failed. Do NOT apply Cloudflare edge changes.`);
  process.exit(1);
} else {
  console.log('[PRE-OPENING GATE ACCEPTED] All internal read-only smoke checks passed. Runtime is ready for edge traffic.');
  process.exit(0);
}
