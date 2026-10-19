import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

import { createHttpApp } from '../../src/server/http.js';
import { authenticateRequest, setTestAuthKeys, clearJwksCache } from '../../src/server/auth.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import { parseBufferedMultipartFormData } from '../../src/server/multipart.js';
import { MarkdownViewer } from '../../client/src/components/MarkdownViewer.js';
import { markdownToHtml } from '../../src/core/markdown.js';

test('Teacher Service — C2/T1 Pre-release Verification Suite', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', `test-prerelease-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);

  let aiCallCount = 0;
  const promptInvocations = [];
  const mockAiClient = {
    complete: async ({ messages }) => {
      aiCallCount++;
      promptInvocations.push(messages);
      return {
        content: `# Test Output (Rev ${aiCallCount})\nContenuto generato per il test didattico ${aiCallCount}.\n\n[TEACHER_ONLY_SOLUTION]\nSoluzione riservata test ${aiCallCount}\n[/TEACHER_ONLY_SOLUTION]`,
        model: 'test-omniroute-model'
      };
    },
    listModels: async () => [{ id: 'test-omniroute-model' }]
  };

  const service = new TeacherService({
    dbManager,
    fileStore,
    omniRouteClient: mockAiClient
  });

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const testKid = 'prerelease-test-kid';
  setTestAuthKeys({
    keys: new Map([[testKid, crypto.createPublicKey(publicKey)]])
  });

  const mcpAud = 'test-mcp-aud-999';
  const webAud = 'test-web-aud-888';
  const teacherEmail = 'docente.pre@scuola.example';

  function createSignedJwt({
    sub = 'teacher-pre-1',
    email = teacherEmail,
    aud = webAud,
    exp = Math.floor(Date.now() / 1000) + 3600
  } = {}) {
    const header = { alg: 'RS256', kid: testKid, typ: 'JWT' };
    const payload = {
      iss: 'https://simogatti.cloudflareaccess.com',
      sub,
      email,
      aud,
      exp,
      nbf: Math.floor(Date.now() / 1000) - 10
    };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${headerB64}.${payloadB64}`);
    const sigB64 = signer.sign(privateKey, 'base64url');
    return `${headerB64}.${payloadB64}.${sigB64}`;
  }

  const app = await createHttpApp({
    service,
    authMode: 'strict',
    authorizeTeacher: async (auth) => {
      return auth.user?.email === teacherEmail;
    },
    authConfig: {
      mcpAud,
      webAud,
      allowSyntheticAuth: true
    }
  });

  async function executeVirtualRequest({
    method = 'GET',
    url = '/',
    headers = {},
    body = null
  } = {}) {
    const socket = new EventEmitter();
    socket.setTimeout = () => {};
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    req.headers['host'] ||= 'localhost:8770';
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
      finishedResolve();
      return this;
    };

    process.nextTick(() => {
      if (body) {
        if (Buffer.isBuffer(body)) {
          req.emit('data', body);
        } else if (typeof body === 'string') {
          req.emit('data', Buffer.from(body));
        } else {
          req.emit('data', Buffer.from(JSON.stringify(body)));
        }
      }
      req.emit('end');
    });

    await app.handleHttpRequest(req, res);
    await finishedPromise;

    const respBuffer = Buffer.concat(outChunks);
    let json = null;
    try {
      json = JSON.parse(respBuffer.toString('utf8'));
    } catch {}

    return {
      status: res.statusCode,
      headers: writtenHeaders,
      buffer: respBuffer,
      text: respBuffer.toString('utf8'),
      json
    };
  }

  t.after(async () => {
    clearJwksCache();
    setTestAuthKeys(null);
    await app.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  // 1. Escaping & XSS Protection
  await t.test('1. Escaping & XSS: React virtual DOM and HTML export immunize against injection', () => {
    const xssAttack = '# Attacco <script>alert("pwned")</script>\n<img src=x onerror="stealCookies()">\n[TEACHER_ONLY_SOLUTION]<iframe src="evil.com"></iframe>[/TEACHER_ONLY_SOLUTION]';

    // React Component inspection
    const vdom = MarkdownViewer({ content: xssAttack });
    function verifyNoDanger(node) {
      if (!node || typeof node !== 'object') return;
      assert.equal(node.props?.dangerouslySetInnerHTML, undefined, 'Must never use dangerouslySetInnerHTML');
      if (node.props?.children) {
        if (Array.isArray(node.props.children)) node.props.children.forEach(verifyNoDanger);
        else verifyNoDanger(node.props.children);
      }
    }
    verifyNoDanger(vdom);

    // Markdown to HTML conversion inspection
    const renderedHtml = markdownToHtml(xssAttack);
    assert.doesNotMatch(renderedHtml, /<script>/i, 'Raw <script> must be escaped');
    assert.match(renderedHtml, /&lt;script&gt;/, 'Must escape script tag');
    assert.doesNotMatch(renderedHtml, /onerror="stealCookies\(\)"/i, 'Raw onerror handler must be escaped');
  });

  // 2. Strict AUD Separation
  await t.test('2. Strict AUD separation: Web token rejected on MCP, MCP token rejected on Web', async () => {
    const webJwt = createSignedJwt({ aud: webAud });
    const mcpJwt = createSignedJwt({ aud: mcpAud });

    // Web token on Web endpoint (/api/auth/me) -> 200
    const webOnWeb = await executeVirtualRequest({
      method: 'GET',
      url: '/api/auth/me',
      headers: { 'cf-access-jwt-assertion': webJwt }
    });
    assert.equal(webOnWeb.status, 200);

    // MCP token on Web endpoint (/api/auth/me) -> 401 Audience mismatch
    const mcpOnWeb = await executeVirtualRequest({
      method: 'GET',
      url: '/api/auth/me',
      headers: { 'cf-access-jwt-assertion': mcpJwt }
    });
    assert.equal(mcpOnWeb.status, 401);
    assert.match(mcpOnWeb.json?.message || '', /Audience mismatch/);

    // MCP token on MCP endpoint (/mcp) -> Accepted (proceeds to MCP request handling)
    const mcpOnMcp = await executeVirtualRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'cf-access-jwt-assertion': mcpJwt,
        'content-type': 'application/json'
      },
      body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } } }
    });
    assert.notEqual(mcpOnMcp.status, 401, 'MCP token on /mcp should not be 401');

    // Web token on MCP endpoint (/mcp) -> 401 Audience mismatch
    const webOnMcp = await executeVirtualRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'cf-access-jwt-assertion': webJwt,
        'content-type': 'application/json'
      },
      body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } } }
    });
    assert.equal(webOnMcp.status, 401);
    assert.match(webOnMcp.json?.error?.message || '', /Audience mismatch/);
  });

  // 3. CSRF Protection
  await t.test('3. CSRF protection: Host validation, Sec-Fetch-Site and Cookie session requirements', async () => {
    const webJwt = createSignedJwt({ aud: webAud });

    // Untrusted Host header -> 403
    const badHost = await executeVirtualRequest({
      method: 'POST',
      url: '/api/classes',
      headers: {
        'host': 'attacker-phishing.com',
        'cf-access-jwt-assertion': webJwt,
        'content-type': 'application/json'
      },
      body: { name: '1A', academicYear: '2026/2027' }
    });
    assert.equal(badHost.status, 403);
    assert.match(badHost.json?.message, /Untrusted Host/);

    // Sec-Fetch-Site: cross-site -> 403
    const crossSite = await executeVirtualRequest({
      method: 'POST',
      url: '/api/classes',
      headers: {
        'sec-fetch-site': 'cross-site',
        'cf-access-jwt-assertion': webJwt,
        'content-type': 'application/json'
      },
      body: { name: '1A', academicYear: '2026/2027' }
    });
    assert.equal(crossSite.status, 403);
    assert.match(crossSite.json?.message, /Cross-site request blocked/);

    // Cookie session without Origin and without Referer -> 403 Fail-closed
    const cookieNoOrigin = await executeVirtualRequest({
      method: 'POST',
      url: '/api/classes',
      headers: {
        'cookie': `CF_Authorization=${webJwt}`,
        'content-type': 'application/json'
      },
      body: { name: '1A', academicYear: '2026/2027' }
    });
    assert.equal(cookieNoOrigin.status, 403);
    assert.match(cookieNoOrigin.json?.message, /requires Origin or Referer/);

    // Cookie session with valid same-origin Origin -> 201
    const cookieValid = await executeVirtualRequest({
      method: 'POST',
      url: '/api/classes',
      headers: {
        'cookie': `CF_Authorization=${webJwt}`,
        'origin': 'http://localhost:8770',
        'content-type': 'application/json'
      },
      body: { name: '1A Informatica', academicYear: '2026/2027' }
    });
    assert.equal(cookieValid.status, 201);
  });

  // 4. Multipart Parser Validation
  await t.test('4. Multipart parser: Rejection of malformed boundaries, fake magic bytes, and unsafe filenames', () => {
    // Malformed boundary
    assert.throws(
      () => parseBufferedMultipartFormData(Buffer.from('test'), 'multipart/form-data; boundary=invalid boundary with spaces!'),
      /Malformed or missing multipart boundary/
    );

    // Disallowed file extension (.sh)
    const badExtMultipart = Buffer.concat([
      Buffer.from('--myboundary\r\nContent-Disposition: form-data; name="file"; filename="script.sh"\r\nContent-Type: text/x-shellscript\r\n\r\necho hello\r\n--myboundary--')
    ]);
    assert.throws(
      () => parseBufferedMultipartFormData(badExtMultipart, 'multipart/form-data; boundary=myboundary'),
      /Unsupported file extension "\.sh"/
    );

    // Fake PDF (missing %PDF- magic bytes)
    const fakePdfMultipart = Buffer.concat([
      Buffer.from('--myboundary\r\nContent-Disposition: form-data; name="file"; filename="fake.pdf"\r\nContent-Type: application/pdf\r\n\r\nNot a real pdf header\r\n--myboundary--')
    ]);
    assert.throws(
      () => parseBufferedMultipartFormData(fakePdfMultipart, 'multipart/form-data; boundary=myboundary'),
      /missing %PDF- header/
    );

    // Unsafe filename path traversal is sanitized
    const traversalMultipart = Buffer.concat([
      Buffer.from('--myboundary\r\nContent-Disposition: form-data; name="file"; filename="../../../etc/passwd.txt"\r\nContent-Type: text/plain\r\n\r\nroot:x:0:0\r\n--myboundary--')
    ]);
    const parsed = parseBufferedMultipartFormData(traversalMultipart, 'multipart/form-data; boundary=myboundary');
    assert.equal(parsed.file.filename, 'passwd.txt', 'Path traversal components must be stripped');

    // Filename with null bytes
    const nullByteMultipart = Buffer.concat([
      Buffer.from('--myboundary\r\nContent-Disposition: form-data; name="file"; filename="evil\0.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--myboundary--')
    ]);
    assert.throws(
      () => parseBufferedMultipartFormData(nullByteMultipart, 'multipart/form-data; boundary=myboundary'),
      /Filename contains null bytes/
    );
  });

  // 5. Lesson Pack Lifecycle: Interrupted Generation, Selective Retry, In-place Re-generation
  await t.test('5. Lesson Pack Lifecycle: Partial generation, selective retry, immutable version increment', async () => {
    const webJwt = createSignedJwt({ aud: webAud });

    // Setup Class, Subject, Lesson
    const cls = service.createClass({ name: '3A Telecomunicazioni', academicYear: '2026/2027' });
    const sub = service.createSubject({ classId: cls.id, name: 'Reti di Calcolatori' });
    const les = service.createLesson({
      classId: cls.id,
      subjectId: sub.id,
      title: 'Modello OSI e TCP/IP',
      durationMinutes: 90
    });

    // Step A: Partial generation — only lessonPlan
    const part1 = await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/generate-pack`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { targetArtifacts: ['lessonPlan'], durationMinutes: 90 }
    });
    assert.equal(part1.status, 200);
    assert.ok(part1.json.pack.artifacts.lessonPlan);
    assert.equal(part1.json.pack.artifacts.teacherScript, null);
    assert.equal(part1.json.pack.isComplete, false);
    assert.equal(part1.json.pack.preparationStatus, 'incomplete');

    const initialPlanId = part1.json.pack.artifacts.lessonPlan.id;
    assert.equal(part1.json.pack.artifacts.lessonPlan.current_version, 1);

    // Step B: In-place retry/generation for remaining steps
    const part2 = await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/generate-pack`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { targetArtifacts: ['teacherScript', 'exercises', 'studentMaterial'], durationMinutes: 90 }
    });
    assert.equal(part2.status, 200);
    assert.equal(part2.json.pack.isComplete, true);
    assert.equal(part2.json.pack.artifacts.lessonPlan.id, initialPlanId, 'Lesson plan ID must be preserved');

    // Step C: Selective retry of 'exercises' — must increment version to v2 without duplicating record
    const retryEx = await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/generate-pack`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { targetArtifacts: ['exercises'], durationMinutes: 90 }
    });
    assert.equal(retryEx.status, 200);
    assert.equal(retryEx.json.pack.artifacts.exercises.current_version, 2, 'Exercises must increment to v2');

    // Verify DB does not contain duplicate exercise sheets for this lesson
    const dbMats = service.materials.listMaterials({ lessonId: les.id, status: 'active' });
    const exCount = dbMats.filter(m => m.resource_type === 'exercise_sheet').length;
    assert.equal(exCount, 1, 'There must be exactly 1 exercise sheet resource (with v2), not duplicate entries');
  });

  // 6. Preparation Confirmation State Machine
  await t.test('6. Preparation Confirmation: Incomplete rejection, version freezing, modification invalidation', async () => {
    const webJwt = createSignedJwt({ aud: webAud });

    const cls = service.createClass({ name: '5A Informatica', academicYear: '2026/2027' });
    const sub = service.createSubject({ classId: cls.id, name: 'Sistemi e Reti' });
    const les = service.createLesson({ classId: cls.id, subjectId: sub.id, title: 'Routing BGP e OSPF' });

    // Incomplete pack rejection
    const badConfirm = await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/confirm-preparation`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { notes: 'Tentativo con pack vuoto' }
    });
    assert.equal(badConfirm.status, 400);
    assert.match(badConfirm.json?.message, /Lesson Pack is incomplete/);

    // Generate complete pack
    await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/generate-pack`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { durationMinutes: 60 }
    });

    // Confirm complete pack
    const okConfirm = await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/confirm-preparation`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { notes: 'Approvato per aula 2' }
    });
    assert.equal(okConfirm.status, 200);
    assert.equal(okConfirm.json.confirmation.preparationStatus, 'confirmed');

    // Check pack status -> confirmed
    const packAfterConfirm = await executeVirtualRequest({
      method: 'GET',
      url: `/api/lessons/${les.id}/pack`,
      headers: { 'cf-access-jwt-assertion': webJwt }
    });
    assert.equal(packAfterConfirm.json.pack.preparationStatus, 'confirmed');

    // Now edit one artifact (e.g. lessonPlan) -> increments to v2
    const planId = packAfterConfirm.json.pack.artifacts.lessonPlan.id;
    await executeVirtualRequest({
      method: 'PUT',
      url: `/api/materials/${planId}`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { contentText: 'Contenuto modificato dal docente dopo la conferma' }
    });

    // Check pack status -> modified_since_confirmation
    const packAfterEdit = await executeVirtualRequest({
      method: 'GET',
      url: `/api/lessons/${les.id}/pack`,
      headers: { 'cf-access-jwt-assertion': webJwt }
    });
    assert.equal(packAfterEdit.json.pack.preparationStatus, 'modified_since_confirmation');

    // Re-confirm -> returns to confirmed
    const reConfirm = await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/confirm-preparation`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { notes: 'Riconfermato con integrazioni' }
    });
    assert.equal(reConfirm.status, 200);

    const packFinal = await executeVirtualRequest({
      method: 'GET',
      url: `/api/lessons/${les.id}/pack`,
      headers: { 'cf-access-jwt-assertion': webJwt }
    });
    assert.equal(packFinal.json.pack.preparationStatus, 'confirmed');
  });

  // 7. Source Selection & Provenance Tracking
  await t.test('7. Source Selection & Provenance: Selected sources are passed and recorded in provenance', async () => {
    const webJwt = createSignedJwt({ aud: webAud });

    const cls = service.createClass({ name: '4B Sistemi', academicYear: '2026/2027' });
    const sub = service.createSubject({ classId: cls.id, name: 'Sistemi Operativi' });
    const les = service.createLesson({ classId: cls.id, subjectId: sub.id, title: 'Virtual Memory & Paging' });

    // Create 3 support materials
    const m1 = service.materials.createMaterial({
      title: 'Dispensa Paginazione',
      contentText: 'Dettagli su tabella delle pagine e TLB.',
      pedagogicalRole: 'support_material',
      classId: cls.id, subjectId: sub.id, lessonId: les.id
    });
    const m2 = service.materials.createMaterial({
      title: 'Dispensa Segmentazione (Esclusa)',
      contentText: 'Concetti di segmentazione della memoria.',
      pedagogicalRole: 'support_material',
      classId: cls.id, subjectId: sub.id, lessonId: les.id
    });

    // Generate pack selecting ONLY m1
    const res = await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/generate-pack`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: {
        selectedSourceIds: [m1.id],
        durationMinutes: 75
      }
    });

    assert.equal(res.status, 200);
    const plan = res.json.pack.artifacts.lessonPlan;
    assert.ok(plan.provenance?.sourceSet);
    const sourceIds = plan.provenance.sourceSet.map(s => s.resourceId);
    assert.ok(sourceIds.includes(m1.id), 'M1 must be present in sourceSet');
    assert.ok(!sourceIds.includes(m2.id), 'M2 must NOT be present in sourceSet as it was not selected');
  });
  // 8. Strict Production Security Enforcements (Requirement 1 & 4)
  await t.test('8. Strict Production Security: Absolute prohibition of authMode!=strict and synthetic identities in production', async () => {
    // A. Mode !== strict in production
    const prodModePermissive = await authenticateRequest({}, {
      isProduction: true,
      authMode: 'permissive'
    });
    assert.equal(prodModePermissive.authenticated, false);
    assert.equal(prodModePermissive.statusCode, 500);
    assert.match(prodModePermissive.error, /Security violation: authMode "permissive" is strictly forbidden in production/);

    const prodModeDisabled = await authenticateRequest({}, {
      isProduction: true,
      authMode: 'disabled'
    });
    assert.equal(prodModeDisabled.authenticated, false);
    assert.equal(prodModeDisabled.statusCode, 500);
    assert.match(prodModeDisabled.error, /Security violation: authMode "disabled" is strictly forbidden in production/);

    // B. Synthetic auth in production is strictly rejected (403)
    const prodSyntheticReq = await authenticateRequest({
      headers: { 'x-test-synthetic-user': 'attacker@domain.com' }
    }, {
      isProduction: true,
      authMode: 'strict',
      allowSyntheticAuth: true
    });
    assert.equal(prodSyntheticReq.authenticated, false);
    assert.equal(prodSyntheticReq.statusCode, 403);
    assert.match(prodSyntheticReq.error, /Synthetic authentication is strictly forbidden in production/);

    // C. createHttpApp in production throws if authMode !== strict
    await assert.rejects(
      async () => createHttpApp({ isProduction: true, authMode: 'permissive' }),
      /Security violation: authMode "permissive" is strictly forbidden in production/
    );

    await assert.rejects(
      async () => createHttpApp({ isProduction: true, authMode: 'disabled' }),
      /Security violation: authMode "disabled" is strictly forbidden in production/
    );
  });

  // 9. Concurrency Protection & Duplicate Generation Prevention (Requirement 4)
  await t.test('9. Concurrency Protection: Reject concurrent duplicate generation on the same lesson artifacts', async () => {
    const webJwt = createSignedJwt({ aud: webAud });

    const cls = service.createClass({ name: '5A Informatica', academicYear: '2026/2027' });
    const sub = service.createSubject({ classId: cls.id, name: 'Sistemi Distribuiti' });
    const les = service.createLesson({ classId: cls.id, subjectId: sub.id, title: 'Consensus Algorithms (Raft & Paxos)' });

    // Lock simulation: start a generation and attempt concurrent call
    service._activeArtifactLocks.add(`${les.id}:lessonPlan`);

    const conflictRes = await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/generate-pack`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { targetArtifacts: ['lessonPlan'] }
    });

    assert.equal(conflictRes.status, 409, 'Must return 409 Conflict when generation is already in progress');
    assert.match(conflictRes.json.message, /Concurrent duplicate requests are rejected/);

    // Release lock
    service._activeArtifactLocks.delete(`${les.id}:lessonPlan`);

    // Now it must succeed
    const okRes = await executeVirtualRequest({
      method: 'POST',
      url: `/api/lessons/${les.id}/generate-pack`,
      headers: { 'cf-access-jwt-assertion': webJwt, 'content-type': 'application/json' },
      body: { targetArtifacts: ['lessonPlan'] }
    });
    assert.equal(okRes.status, 200);
  });
});
