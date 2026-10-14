import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { createHttpApp } from '../../src/server/http.js';
import { setTestAuthKeys, clearJwksCache } from '../../src/server/auth.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import fs from 'node:fs';
import path from 'node:path';

test('MCP Streamable HTTP Transport & Auth Tests', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', 'test-http-' + Date.now());
  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);
  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true
  });

  const bearerToken = 'secret-teacher-token-12345';
  let teacherPrincipalAllowed = true;
  const app = await createHttpApp({
    service,
    authMode: 'strict',
    authorizeTeacher: async () => teacherPrincipalAllowed,
    authConfig: {
      bearerToken,
      expectedAud: 'test-audience-aud-123'
    }
  });

  // Helper to execute virtual HTTP request through handleHttpRequest
  async function executeVirtualRequest({
    method = 'GET',
    url = '/',
    headers = {},
    body = null
  } = {}, targetApp = app) {
    const socket = new EventEmitter();
    socket.setTimeout = () => {};
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    req.rawHeaders = Object.entries(headers).flatMap(([k, v]) => [k, v]);

    const res = new http.ServerResponse(req);
    const outChunks = [];
    res.assignSocket(socket);

    const writtenHeaders = {};
    const origSetHeader = res.setHeader.bind(res);
    res.setHeader = (k, v) => {
      writtenHeaders[k.toLowerCase()] = v;
      return origSetHeader(k, v);
    };
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = (status, ...args) => {
      const hdrs = typeof args[0] === 'object' ? args[0] : (args[1] || {});
      for (const [k, v] of Object.entries(hdrs)) {
        writtenHeaders[k.toLowerCase()] = v;
      }
      return origWriteHead(status, ...args);
    };

    let finishedResolve;
    const finishedPromise = new Promise(resolve => { finishedResolve = resolve; });

    res.write = function(chunk) {
      if (chunk) outChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    res.end = function(chunk) {
      if (chunk) outChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      finishedResolve({
        statusCode: res.statusCode,
        headers: { ...res.getHeaders(), ...writtenHeaders },
        body: Buffer.concat(outChunks).toString('utf8')
      });
      return res;
    };

    setImmediate(() => {
      if (body) {
        const bodyBuf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
        req.push(bodyBuf);
      }
      req.push(null);
    });

    await targetApp.handleHttpRequest(req, res);
    return finishedPromise;
  }

  // Generate RSA key pair for testing Cloudflare Access JWTs
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048
  });
  setTestAuthKeys({ publicKey, kid: 'test-kid-1' });

  function createSignedJwt({
    sub = 'user@example.com',
    aud = 'test-audience-aud-123',
    iss = 'https://simogatti.cloudflareaccess.com',
    exp = Math.floor(Date.now() / 1000) + 3600,
    omitExp = false
  } = {}) {
    const header = { alg: 'RS256', kid: 'test-kid-1', typ: 'JWT' };
    const payload = { sub, aud, iss, email: sub };
    if (!omitExp) payload.exp = exp;

    const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${hB64}.${pB64}`);
    const sig = signer.sign(privateKey, 'base64url');

    return `${hB64}.${pB64}.${sig}`;
  }

  t.after(async () => {
    clearJwksCache();
    setTestAuthKeys(null);
    await app.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('GET /health returns 200 with service metadata', async () => {
    const res = await executeVirtualRequest({ url: '/health' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'teacher-service');
  });

  await t.test('GET / returns Teacher Web UI Dashboard', async () => {
    const res = await executeVirtualRequest({ url: '/' });
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Teacher Service/);
    assert.match(res.body, /Piattaforma di Gestione Materiali/);
  });

  await t.test('REST API authenticates before returning teacher data', async () => {
    const secretMaterial = service.createMaterial({
      title: 'Teacher-only API fixture',
      contentText: 'Riservato al docente.',
      pedagogicalRole: 'teacher_material'
    });

    const unauthenticated = await executeVirtualRequest({ url: '/api/materials' });
    assert.equal(unauthenticated.statusCode, 401);
    const unauthenticatedDetail = await executeVirtualRequest({ url: `/api/materials/${secretMaterial.id}` });
    assert.equal(unauthenticatedDetail.statusCode, 401);

    // Client-supplied role hints are not identity/authorization evidence.
    for (const url of [`/api/materials/${secretMaterial.id}`, `/api/materials/${secretMaterial.id}?role=student`]) {
      const authenticated = await executeVirtualRequest({
        url,
        headers: { Authorization: `Bearer ${bearerToken}`, 'x-role': 'student' }
      });
      assert.equal(authenticated.statusCode, 200);
      const body = JSON.parse(authenticated.body);
      assert.match(body.material.content, /Riservato al docente/);
    }
  });

  await t.test('authentication alone does not grant teacher privileges', async () => {
    teacherPrincipalAllowed = false;
    const denied = await executeVirtualRequest({
      url: '/api/materials',
      headers: { Authorization: `Bearer ${bearerToken}` }
    });
    assert.equal(denied.statusCode, 403);
    teacherPrincipalAllowed = true;
  });

  await t.test('Cloudflare Access identity allowlist grants the same teacher principal to REST and MCP', async () => {
    const mappedApp = await createHttpApp({
      service,
      authMode: 'strict',
      teacherEmails: 'Docente@scuola.example',
      authConfig: {
        bearerToken,
        expectedAud: 'test-audience-aud-123'
      }
    });

    try {
      const teacherJwt = createSignedJwt({ sub: 'docente@scuola.example' });
      const otherJwt = createSignedJwt({ sub: 'altro@scuola.example' });
      const restAllowed = await executeVirtualRequest({
        url: '/api/materials',
        headers: { 'Cf-Access-Jwt-Assertion': teacherJwt }
      }, mappedApp);
      assert.equal(restAllowed.statusCode, 200);

      const bearerNotTeacher = await executeVirtualRequest({
        url: '/api/materials',
        headers: { Authorization: `Bearer ${bearerToken}` }
      }, mappedApp);
      assert.equal(bearerNotTeacher.statusCode, 403);

      const missingExpiry = await executeVirtualRequest({
        url: '/api/materials',
        headers: { 'Cf-Access-Jwt-Assertion': createSignedJwt({ sub: 'docente@scuola.example', omitExp: true }) }
      }, mappedApp);
      assert.equal(missingExpiry.statusCode, 401);

      const expiredAssertion = await executeVirtualRequest({
        url: '/api/materials',
        headers: { 'Cf-Access-Jwt-Assertion': createSignedJwt({ sub: 'docente@scuola.example', exp: Math.floor(Date.now() / 1000) - 3600 }) }
      }, mappedApp);
      assert.equal(expiredAssertion.statusCode, 401);

      const mcpDeniedInit = await executeVirtualRequest({
        method: 'POST',
        url: '/mcp',
        headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': otherJwt },
        body: {
          jsonrpc: '2.0', method: 'initialize',
          params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'unmapped-teacher', version: '1.0' } },
          id: 30
        }
      }, mappedApp);
      assert.equal(mcpDeniedInit.statusCode, 403);

      const initialized = await executeVirtualRequest({
        method: 'POST',
        url: '/mcp',
        headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': teacherJwt },
        body: {
          jsonrpc: '2.0', method: 'initialize',
          params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'authorized-teacher', version: '1.0' } },
          id: 31
        }
      }, mappedApp);
      assert.equal(initialized.statusCode, 200);
      const sessionId = initialized.headers['mcp-session-id'];
      assert.ok(sessionId);

      const discovery = await executeVirtualRequest({
        method: 'POST',
        url: '/mcp',
        headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': sessionId, 'Cf-Access-Jwt-Assertion': teacherJwt },
        body: { jsonrpc: '2.0', method: 'tools/list', params: {}, id: 32 }
      }, mappedApp);
      assert.equal(discovery.statusCode, 200);
      const tools = JSON.parse(discovery.body).result.tools.map((tool) => tool.name);
      assert.ok(tools.includes('create_class'));
      assert.ok(tools.includes('generate_lesson_plan'));
      assert.ok(tools.includes('get_source_history'));
      assert.ok(tools.includes('get_ai_rule_version_history'));
      assert.ok(tools.includes('generate_assessment_draft'));
      assert.ok(tools.includes('grade_submission'));

      const createClass = await executeVirtualRequest({
        method: 'POST',
        url: '/mcp',
        headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': sessionId, 'Cf-Access-Jwt-Assertion': teacherJwt },
        body: {
          jsonrpc: '2.0', method: 'tools/call',
          params: { name: 'create_class', arguments: { name: '4A — auth test', academicYear: '2026/2027' } },
          id: 33
        }
      }, mappedApp);
      assert.equal(createClass.statusCode, 200);
      const createResult = JSON.parse(createClass.body).result;
      assert.ok(createResult);
      assert.notEqual(createResult.isError, true);
      assert.match(createResult.content?.[0]?.text || '', /4A/);

      const unauthorizedSessionCall = await executeVirtualRequest({
        method: 'POST',
        url: '/mcp',
        headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': sessionId, 'Cf-Access-Jwt-Assertion': otherJwt },
        body: { jsonrpc: '2.0', method: 'tools/list', params: {}, id: 34 }
      }, mappedApp);
      assert.equal(unauthorizedSessionCall.statusCode, 403);
    } finally {
      await mappedApp.close();
    }
  });

  await t.test('POST /mcp rejects requests with invalid Origin', async () => {
    const res = await executeVirtualRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'Origin': 'https://malicious-attacker.com',
        'Content-Type': 'application/json'
      },
      body: {}
    });
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.match(body.error.message, /Invalid Origin/);
  });

  await t.test('POST /mcp fails closed when unauthenticated', async () => {
    const res = await executeVirtualRequest({
      method: 'POST',
      url: '/mcp',
      headers: { 'Content-Type': 'application/json' },
      body: {
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } },
        id: 1
      }
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('POST /mcp accepts valid Bearer token and initializes session', async () => {
    const initPayload = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'chatgpt-client', version: '1.0.0' } },
      id: 1
    };

    const res = await executeVirtualRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`
      },
      body: initPayload
    });

    assert.equal(res.statusCode, 200);
    const sessionId = res.headers['mcp-session-id'];
    assert.ok(sessionId, 'Should return Mcp-Session-Id header');

    const body = JSON.parse(res.body);
    assert.equal(body.id, 1);
    assert.equal(body.result.serverInfo.name, 'teacher-service');
  });

  await t.test('POST /mcp accepts valid Cloudflare Access assertion JWT', async () => {
    const validJwt = createSignedJwt({ sub: 'docente@scuola.example' });
    const initPayload = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'chatgpt-remote', version: '1.0.0' } },
      id: 2
    };

    const res = await executeVirtualRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': validJwt
      },
      body: initPayload
    });

    assert.equal(res.statusCode, 200);
    const sessionId = res.headers['mcp-session-id'];
    assert.ok(sessionId);
  });

  await t.test('Enforces session-to-principal cross-tenant isolation', async () => {
    // 1. Principal A creates a session
    const jwtA = createSignedJwt({ sub: 'teacher-a@scuola.example' });
    const initA = await executeVirtualRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': jwtA
      },
      body: {
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'client-a', version: '1.0.0' } },
        id: 10
      }
    });
    const sessionA = initA.headers['mcp-session-id'];
    assert.ok(sessionA);

    // 2. Principal B attempts to hijack session A
    const jwtB = createSignedJwt({ sub: 'teacher-b@scuola.example' });
    const hijackRes = await executeVirtualRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionA,
        'Cf-Access-Jwt-Assertion': jwtB
      },
      body: {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 11
      }
    });

    assert.equal(hijackRes.statusCode, 403);
    const hijackBody = JSON.parse(hijackRes.body);
    assert.match(hijackBody.error.message, /Forbidden: Session belongs to a different principal/);
  });
  await t.test("OPTIONS preflight returns 204 with CORS headers for allowed origins", async () => {
    const preflight = await executeVirtualRequest({
      method: "OPTIONS",
      url: "/mcp",
      headers: {
        Origin: "https://chatgpt.com",
        "Access-Control-Request-Method": "POST"
      }
    });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "https://chatgpt.com");
    assert.match(preflight.headers["access-control-allow-methods"], /POST/);

    const forbiddenPreflight = await executeVirtualRequest({
      method: "OPTIONS",
      url: "/mcp",
      headers: {
        Origin: "https://evil.attacker.com"
      }
    });
    assert.equal(forbiddenPreflight.statusCode, 403);
  });

  await t.test("Cloudflare Access assertion with array aud and trailing slash iss succeeds", async () => {
    const customJwt = createSignedJwt({
      sub: "teacher@scuola.example",
      aud: ["other-aud", "test-audience-aud-123"],
      iss: "https://simogatti.cloudflareaccess.com/"
    });
    const res = await executeVirtualRequest({
      method: "POST",
      url: "/mcp",
      headers: {
        "Content-Type": "application/json",
        "Cf-Access-Jwt-Assertion": customJwt
      },
      body: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "ChatGPT", version: "1.0.0" }
        },
        id: 99
      }
    });
    assert.equal(res.statusCode, 200);
  });
});
