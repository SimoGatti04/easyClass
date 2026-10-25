#!/usr/bin/env node
/**
 * Teacher Service — Internal Pre-Opening Read-Only Smoke Test Gate
 *
 * Runs non-destructive, strictly read-only HTTP smoke checks against an
 * internal application instance (e.g. http://127.0.0.1:8770 or container http://127.0.0.1:80)
 * before any Cloudflare edge routing change is applied.
 *
 * Verifies:
 * 1. Health probe (/health) -> 200 OK, service metadata
 * 2. Web UI root (/) -> 200 OK, SPA shell HTML
 * 3. Student UI (/studente) -> 200 OK, SPA shell HTML
 * 4. Database read path (/api/student/classes) -> 200 OK, JSON classes list (0 writes)
 * 5. Fail-closed teacher auth (/api/classes) -> 401/403 Forbidden (fail-closed check)
 * 6. Student claim router (/api/student/claim-code) -> 400 Bad Request on empty body (0 writes)
 * 7. MCP transport (/mcp) -> 400/405 active transport
 */

const targetUrl = (process.argv[2] || process.env.TEACHER_SERVICE_TARGET_URL || 'http://127.0.0.1:8770').replace(/\/+$/, '');

console.log(`[PRE-OPENING GATE] Running internal read-only smoke checks against: ${targetUrl}\n`);

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
    name: '6. Student claim router (/api/student/claim-code)',
    method: 'POST',
    path: '/api/student/claim-code',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    expectedStatus: [400],
    validate: (res, json, text) => {
      if (!json || (json.error !== 'BadRequest' && json.error !== 'ValidationError')) {
        throw new Error(`Expected BadRequest on empty claim body, got: ${text.slice(0, 100)}`);
      }
    }
  },
  {
    name: '7. MCP streamable HTTP endpoint (/mcp)',
    method: 'GET',
    path: '/mcp',
    expectedStatus: [400, 405],
    validate: (res) => {}
  }
];

let failed = 0;

for (const check of checks) {
  const url = `${targetUrl}${check.path}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: check.method,
      headers: {
        Host: new URL(targetUrl).host,
        Origin: targetUrl,
        ...(check.headers || {})
      },
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
