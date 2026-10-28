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
 * 5. Validates R3 contracts: public class directory, anonymous published materials,
 *    fail-closed anonymous denial of activities and roster without class PIN,
 *    410 Gone for retired individual student codes, fail-closed teacher API and MCP.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const checks = [
  {
    name: '1. Health endpoint (/health)',
    method: 'GET',
    path: () => '/health',
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
    path: () => '/',
    expectedStatus: [200],
    validate: (res, json, text) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html') || (!text.includes('id="app"') && !text.includes('root'))) {
        throw new Error(`Expected HTML SPA shell, got content-type "${ct}"`);
      }
    }
  },
  {
    name: '3. Student SPA route (/studente)',
    method: 'GET',
    path: () => '/studente',
    expectedStatus: [200],
    validate: (res, json, text) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html') || (!text.includes('id="app"') && !text.includes('root'))) {
        throw new Error(`Expected HTML SPA shell, got content-type "${ct}"`);
      }
    }
  },
  {
    name: '4. Public class directory (/api/student/classes)',
    method: 'GET',
    path: () => '/api/student/classes',
    expectedStatus: [200],
    validate: (res, json, text, context) => {
      if (!json || !Array.isArray(json.classes)) {
        throw new Error(`Expected JSON object with classes array, got: ${text.slice(0, 100)}`);
      }
      if (json.classes.length > 0) {
        context.firstClassId = json.classes[0].id;
      }
    }
  },
  {
    name: '5. Anonymous read of published materials (/api/student/classes/:id/materials)',
    method: 'GET',
    path: (context) => context.firstClassId
      ? `/api/student/classes/${encodeURIComponent(context.firstClassId)}/materials`
      : '/api/student/classes/nonexistent-class-probe/materials',
    expectedStatus: [200, 404],
    validate: (res, json, text) => {
      if (res.status === 200) {
        if (!json || !Array.isArray(json.materials)) {
          throw new Error(`Expected materials array in 200 response, got: ${text.slice(0, 100)}`);
        }
        for (const m of json.materials) {
          const role = m.pedagogicalRole || m.pedagogical_role;
          if (!['student_material', 'support_material'].includes(role)) {
            throw new Error(`Leaked non-student material role: ${role}`);
          }
        }
      } else {
        if (!json || json.error !== 'NotFoundError') {
          throw new Error(`Expected NotFoundError for probe class, got: ${text.slice(0, 100)}`);
        }
      }
    }
  },
  {
    name: '6. Anonymous rejection of activities without class PIN (/api/student/classes/:id/activities)',
    method: 'GET',
    path: (context) => context.firstClassId
      ? `/api/student/classes/${encodeURIComponent(context.firstClassId)}/activities`
      : '/api/student/classes/nonexistent-class-probe/activities',
    expectedStatus: [401],
    validate: (res, json, text) => {
      if (!json || json.error !== 'AuthorizationError') {
        throw new Error(`Expected AuthorizationError (401) on anonymous activities read, got: ${text.slice(0, 100)}`);
      }
    }
  },
  {
    name: '7. Anonymous rejection of roster without class PIN (/api/student/classes/:id/activities/:aid/students)',
    method: 'GET',
    path: (context) => context.firstClassId
      ? `/api/student/classes/${encodeURIComponent(context.firstClassId)}/activities/probe-act/students`
      : '/api/student/classes/nonexistent-class-probe/activities/probe-act/students',
    expectedStatus: [401],
    validate: (res, json, text) => {
      if (!json || json.error !== 'AuthorizationError') {
        throw new Error(`Expected AuthorizationError (401) on anonymous roster read, got: ${text.slice(0, 100)}`);
      }
    }
  },
  {
    name: '8. Retired individual student claim endpoint returns 410 Gone (/api/student/claim-code)',
    method: 'POST',
    path: () => '/api/student/claim-code',
    headers: (context, targetUrl) => ({
      'Content-Type': 'application/json',
      Referer: `${targetUrl}/studente`
    }),
    body: JSON.stringify({}),
    expectedStatus: [410],
    validate: (res, json, text) => {
      if (!json || json.error !== 'Gone') {
        throw new Error(`Expected 410 Gone for retired individual student claim code endpoint, got: ${text.slice(0, 100)}`);
      }
      if (!json.message || !json.message.includes('PIN')) {
        throw new Error(`Expected retirement message explaining PIN replacement, got: ${text.slice(0, 100)}`);
      }
    }
  },
  {
    name: '9. Fail-closed teacher authorization (/api/classes)',
    method: 'GET',
    path: () => '/api/classes',
    expectedStatus: [401, 403],
    validate: (res, json, text) => {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`Expected JSON rejection, got: ${ct}`);
      }
    }
  },
  {
    name: '10. MCP streamable HTTP transport (/mcp)',
    method: 'POST',
    path: () => '/mcp',
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

export async function runSmokeChecks(targetUrl, { customFetch = fetch, logger = console } = {}) {
  const context = {
    firstClassId: null
  };
  const normalizedUrl = targetUrl.replace(/\/+$/, '');
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const relPath = typeof check.path === 'function' ? check.path(context) : check.path;
    const url = `${normalizedUrl}${relPath}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      // Note: Do NOT automatically send Origin: targetUrl.
      // MCP clients and API probes are not cross-origin browsers; sending an unauthorized
      // local origin triggers strict Origin rejection (403) before authentication/protocol checks.
      const rawHeaders = typeof check.headers === 'function'
        ? check.headers(context, normalizedUrl)
        : (check.headers || {});
      const headers = {
        Host: new URL(normalizedUrl).host,
        ...rawHeaders
      };
      const res = await customFetch(url, {
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
        check.validate(res, json, text, context);
      }

      passed++;
      logger.log(`  [PASS] ${check.name} -> HTTP ${res.status}`);
    } catch (err) {
      failed++;
      logger.error(`  [FAIL] ${check.name} -> ${err.message}`);
    }
  }

  return { passed, failed, total: checks.length };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const targetUrl = (process.argv[2] || process.env.TEACHER_SERVICE_TARGET_URL || 'http://127.0.0.1:8770').replace(/\/+$/, '');
  console.log(`[PRE-OPENING GATE] Running internal read-only smoke checks against: ${targetUrl}\n`);
  const { failed } = await runSmokeChecks(targetUrl);
  console.log('');
  if (failed > 0) {
    console.error(`[PRE-OPENING GATE REJECTED] ${failed} check(s) failed. Do NOT apply Cloudflare edge changes.`);
    process.exit(1);
  } else {
    console.log('[PRE-OPENING GATE PASSED] All pre-opening read-only smoke checks succeeded.');
    console.log('Application is running, database read path is operational, teacher API is fail-closed, and retired student claim endpoints are Gone (410).');
    process.exit(0);
  }
}
