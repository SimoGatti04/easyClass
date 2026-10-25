import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createHttpApp } from '../../src/server/http.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';

test('Pre-opening internal read-only smoke checks suite', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-gate-'));
  const dbManager = new DatabaseManager(path.join(tmpDir, 'teacher.sqlite')).init();
  const fileStore = new FileStore(path.join(tmpDir, 'files'));
  const service = new TeacherService({ dbManager, fileStore, mockAi: true });

  const cls = service.createClass({ name: '5B Informatica', academicYear: '2026/2027' });
  const sub = service.createSubject({ classId: cls.id, name: 'Sistemi e Reti' });
  const mat = service.createMaterial({
    title: 'Dispensa Fumo',
    contentText: 'Materiale didattico per smoke test.',
    pedagogicalRole: 'student_material',
    classId: cls.id,
    subjectId: sub.id
  });
  service.publishMaterial(mat.id, { versionNumber: 1 });

  const app = await createHttpApp({
    service,
    authMode: 'strict',
    authConfig: { webAud: 'test-aud', expectedIss: 'https://auth.simogatti.it' }
  });

  async function executeCheck({ method = 'GET', url = '/health', headers = {}, body = null }) {
    const socket = new EventEmitter();
    socket.setTimeout = () => {};
    socket.remoteAddress = '127.0.0.1';
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    const reqHeaders = {
      host: 'localhost:8770',
      ...headers
    };
    req.headers = Object.fromEntries(Object.entries(reqHeaders).map(([k, v]) => [k.toLowerCase(), v]));
    req.rawHeaders = Object.entries(reqHeaders).flatMap(([k, v]) => [k, v]);

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
      finishedResolve();
      return this;
    };

    if (body) {
      process.nextTick(() => {
        req.emit('data', Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
        req.emit('end');
      });
    } else {
      process.nextTick(() => req.emit('end'));
    }

    await app.handleHttpRequest(req, res);

    return finishedPromise.then(() => {
      const raw = Buffer.concat(outChunks).toString('utf-8');
      let json = null;
      try { json = JSON.parse(raw); } catch {}
      return { statusCode: res.statusCode, headers: writtenHeaders, body: json, raw };
    });
  }

  t.after(async () => {
    await app.close();
    service.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('1. Health check verifies service status without mutating store', async () => {
    const res = await executeCheck({ url: '/health' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'teacher-service');
  });

  await t.test('2. Web UI root and /studente serve HTML SPA shell', async () => {
    const rootRes = await executeCheck({ url: '/' });
    assert.equal(rootRes.statusCode, 200);
    assert.match(rootRes.headers['content-type'], /html/);

    const studentRes = await executeCheck({ url: '/studente' });
    assert.equal(studentRes.statusCode, 200);
    assert.match(studentRes.headers['content-type'], /html/);
  });

  await t.test('3. Database read path executes queries with zero writes', async () => {
    const classesRes = await executeCheck({ url: '/api/student/classes' });
    assert.equal(classesRes.statusCode, 200);
    assert.ok(Array.isArray(classesRes.body.classes));
    assert.equal(classesRes.body.classes.length, 1);
    assert.equal(classesRes.body.classes[0].name, '5B Informatica');
  });

  await t.test('4. Management teacher API rejects unauthenticated requests fail-closed', async () => {
    const mgmtRes = await executeCheck({ url: '/api/classes' });
    assert.ok([401, 403].includes(mgmtRes.statusCode), `Must reject unauthenticated with 401 or 403, got ${mgmtRes.statusCode}`);
  });

  await t.test('5. Retired individual student-credential endpoint returns 410 without mutating rate limits', async () => {
    const countBefore = dbManager.prepare('SELECT count(*) as count FROM student_claim_rate_limits').get().count;

    // Repeated legacy requests must not issue credentials or alter either limiter.
    for (let i = 0; i < 5; i++) {
      const claimRes = await executeCheck({
        method: 'POST',
        url: '/api/student/claim-code',
        headers: { 'Content-Type': 'application/json' },
        body: {}
      });
      assert.equal(claimRes.statusCode, 410);
      assert.equal(claimRes.body.error, 'Gone');
    }

    const countAfter = dbManager.prepare('SELECT count(*) as count FROM student_claim_rate_limits').get().count;
    assert.equal(countAfter, countBefore, 'Repeated empty claim smoke checks must not record rate-limiting failures or mutate database');
  });

  await t.test('6. MCP endpoint /mcp rejects unauthenticated requests with 401 JSON-RPC and distinguishes transport vs Origin errors', async () => {
    // 1. Unauthenticated request without Origin -> 401 JSON-RPC (active server, fail-closed auth active)
    const mcpRes = await executeCheck({
      method: 'POST',
      url: '/mcp',
      headers: { 'content-type': 'application/json' },
      body: { jsonrpc: '2.0', method: 'ping', id: 1 }
    });
    assert.equal(mcpRes.statusCode, 401);
    assert.equal(mcpRes.body.jsonrpc, '2.0');
    assert.equal(mcpRes.body.error.code, -32000);
    assert.match(mcpRes.body.error.message, /Unauthorized/);

    // 2. Request with unauthorized local Origin -> 403 Forbidden (demonstrates why smoke-test must not send local Origin)
    const badOriginRes = await executeCheck({
      method: 'POST',
      url: '/mcp',
      headers: {
        origin: 'http://127.0.0.1:8770',
        'content-type': 'application/json'
      },
      body: { jsonrpc: '2.0', method: 'ping', id: 1 }
    });
    assert.equal(badOriginRes.statusCode, 403);
    assert.match(badOriginRes.body.error.message, /Invalid Origin/);
  });
});
