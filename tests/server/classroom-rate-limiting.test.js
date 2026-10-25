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

test('Shared classroom PIN limiter tolerates NAT and ignores untrusted forwarded-IP headers', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'class-pin-rate-limit-'));
  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(path.join(tmpDir, 'files'));
  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true,
    classPinSecret: 'synthetic-class-pin-rate-limit-secret-2026'
  });
  const classroom = service.createClass({ name: '5A Informatica', academicYear: '2026/2027' });
  service.generateClassActivityPin(classroom.id, { createdBy: 'synthetic-teacher' });

  const app = await createHttpApp({
    service,
    trustedProxyCidrs: [],
    classPinRateLimiterOptions: { deviceMaxFailures: 3, ipMaxFailures: 120, burstMaxFailures: 75 }
  });
  const appWithTightIpLimit = await createHttpApp({
    service,
    trustedProxyCidrs: [],
    classPinRateLimiterOptions: { deviceMaxFailures: 100, ipMaxFailures: 3, burstMaxFailures: 3 }
  });
  t.after(async () => {
    await app.close();
    await appWithTightIpLimit.close();
    dbManager.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function request(targetApp, {
    classId = classroom.id,
    pin = '9999',
    remoteAddress = '192.0.2.44',
    headers = {}
  } = {}) {
    const socket = new EventEmitter();
    socket.setTimeout = () => {};
    socket.remoteAddress = remoteAddress;
    const req = new http.IncomingMessage(socket);
    req.method = 'POST';
    req.url = `/api/student/classes/${encodeURIComponent(classId)}/access`;
    const requestHeaders = {
      host: 'localhost:8770',
      origin: 'http://localhost:8770',
      'content-type': 'application/json',
      ...headers
    };
    req.headers = Object.fromEntries(Object.entries(requestHeaders).map(([name, value]) => [name.toLowerCase(), value]));
    req.rawHeaders = Object.entries(requestHeaders).flatMap(([name, value]) => [name, value]);

    const res = new http.ServerResponse(req);
    const chunks = [];
    const writtenHeaders = {};
    res.assignSocket(socket);
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = (name, value) => {
      writtenHeaders[name.toLowerCase()] = value;
      return originalSetHeader(name, value);
    };
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = (status, ...args) => {
      const responseHeaders = typeof args[0] === 'object' ? args[0] : (args[1] || {});
      for (const [name, value] of Object.entries(responseHeaders)) writtenHeaders[name.toLowerCase()] = value;
      return originalWriteHead(status, ...args);
    };
    let finish;
    const done = new Promise(resolve => { finish = resolve; });
    res.write = chunk => { if (chunk) chunks.push(Buffer.from(chunk)); return true; };
    res.end = chunk => {
      if (chunk) chunks.push(Buffer.from(chunk));
      finish();
      return res;
    };
    process.nextTick(() => {
      req.emit('data', Buffer.from(JSON.stringify({ pin })));
      req.emit('end');
    });
    await targetApp.handleHttpRequest(req, res);
    await done;
    return {
      status: res.statusCode,
      headers: writtenHeaders,
      body: Buffer.concat(chunks).toString('utf8')
    };
  }

  // Thirty students behind one classroom NAT, each on a distinct browser with
  // one PIN typo, must not trigger a restrictive per-device threshold.
  for (let index = 0; index < 30; index += 1) {
    const response = await request(app, {
      remoteAddress: '192.0.2.44',
      headers: { 'x-forwarded-for': `203.0.113.${index + 1}` }
    });
    assert.equal(response.status, 403, `NAT typo ${index + 1} should remain an ordinary invalid-PIN response`);
  }

  // The HttpOnly browser bucket still limits repeated typos from one browser.
  const firstDeviceFailure = await request(app, { remoteAddress: '192.0.2.45' });
  assert.equal(firstDeviceFailure.status, 403);
  const setCookies = firstDeviceFailure.headers['set-cookie'];
  const cookieList = Array.isArray(setCookies) ? setCookies : [setCookies];
  const deviceCookie = cookieList.find(value => value?.startsWith('ts_class_device='))?.split(';', 1)[0];
  assert.ok(deviceCookie, 'first failed attempt should establish a stable HttpOnly device bucket');
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    assert.equal((await request(app, { remoteAddress: '192.0.2.45', headers: { cookie: deviceCookie } })).status, 403);
  }
  assert.equal((await request(app, { remoteAddress: '192.0.2.45', headers: { cookie: deviceCookie } })).status, 429);

  // A direct client cannot evade the IP bucket by changing X-Forwarded-For or
  // forging Cloudflare's connecting-IP header. Neither header is trusted when
  // the socket peer is not an explicitly trusted proxy.
  const tightClass = service.createClass({ name: '5B Telecomunicazioni', academicYear: '2026/2027' });
  service.generateClassActivityPin(tightClass.id, { createdBy: 'synthetic-teacher' });
  const spoofingHeaders = [
    { 'x-forwarded-for': '203.0.113.1', 'cf-connecting-ip': '203.0.113.1' },
    { 'x-forwarded-for': '203.0.113.2', 'cf-connecting-ip': '203.0.113.2' },
    { 'x-forwarded-for': '203.0.113.3', 'cf-connecting-ip': '203.0.113.3' }
  ];
  for (const headers of spoofingHeaders) {
    assert.equal((await request(appWithTightIpLimit, {
      classId: tightClass.id,
      remoteAddress: '198.51.100.70',
      headers
    })).status, 403);
  }
  assert.equal((await request(appWithTightIpLimit, {
    classId: tightClass.id,
    remoteAddress: '198.51.100.70',
    headers: { 'x-forwarded-for': '203.0.113.99', 'cf-connecting-ip': '203.0.113.99' }
  })).status, 429, 'changing forged forwarding headers must not evade a trusted-peer IP bucket');
});
