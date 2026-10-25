import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { createHttpApp } from '../../src/server/http.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import { setTestAuthKeys, clearJwksCache, computePrincipalHash } from '../../src/server/auth.js';

test('Student Public API & Teacher Live Monitor HTTP Suite', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', `test-student-api-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);

  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true,
    classPinSecret: 'synthetic-student-api-class-pin-secret-2026'
  });

  // Seed sample data
  const testClass = service.createClass({
    name: '5B Informatica',
    section: 'B',
    academicYear: '2026/2027'
  });

  const testSubject = service.createSubject({
    classId: testClass.id,
    name: 'Sistemi e Reti'
  });

  const student1 = service.addStudent({
    classId: testClass.id,
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'm.rossi@scuola.example'
  });

  const student2 = service.addStudent({
    classId: testClass.id,
    firstName: 'Laura',
    lastName: 'Bianchi',
    email: 'l.bianchi@scuola.example'
  });

  // Published student material for grounding
  const studentMaterial = service.createMaterial({
    title: 'Dispensa Reti TCP/IP',
    contentText: '# Reti di Calcolatori\nIl protocollo TCP opera a livello di trasporto...',
    pedagogicalRole: 'student_material',
    classId: testClass.id,
    subjectId: testSubject.id
  });
  service.publishMaterial(studentMaterial.id, { versionNumber: 1 });

  const testAssessment = service.createAssessment({
    title: 'Verifica Reti TCP/IP',
    classId: testClass.id,
    subjectId: testSubject.id,
    activityType: 'test',
    status: 'active',
    durationMinutes: 45,
    maxScore: 30,
    items: [
      {
        type: 'multiple_choice',
        questionText: 'A quale livello della pila ISO/OSI opera il protocollo TCP?',
        options: ['Fisico', 'Trasporto', 'Applicativo', 'Rete'],
        maxScore: 10,
        isSelfCorrecting: true,
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1,
        teacherSolution: 'Trasporto (Livello 4)'
      },
      {
        type: 'open_question',
        questionText: 'Spiega la differenza tra TCP e UDP, indicando due casi d\'uso per ciascuno.',
        maxScore: 20,
        isSelfCorrecting: false,
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1,
        teacherSolution: 'TCP è orientato alla connessione (affidabile, handshake 3-way, flow control). UDP è connectionless (basso overhead, streaming, DNS, VoIP).'
      }
    ]
  });

  // Auth setup for teacher requests
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  let testClassPin = service.generateClassActivityPin(testClass.id, { createdBy: 'synthetic-teacher' }).pin;
  let classAccessCookie = '';

  const keyId = 'test-teacher-key';
  setTestAuthKeys({ keys: new Map([[keyId, crypto.createPublicKey(publicKey)]]) });

  const makeJwt = (payload) => {
    const header = { alg: 'RS256', typ: 'JWT', kid: keyId };
    const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const dataToSign = `${encHeader}.${encPayload}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(dataToSign);
    const signature = sign.sign(privateKey).toString('base64url');
    return `${dataToSign}.${signature}`;
  };

  const teacherPrincipal = computePrincipalHash('https://auth.simogatti.it', 'teacher@school.example');
  const teacherToken = makeJwt({
    iss: 'https://auth.simogatti.it',
    aud: 'test-web-aud',
    sub: 'teacher@school.example',
    email: 'teacher@school.example',
    exp: Math.floor(Date.now() / 1000) + 3600
  });

  const app = await createHttpApp({
    service,
    authMode: 'strict',
    authorizeTeacher: async (auth) => {
      return auth.user?.email === 'teacher@school.example';
    },
    authConfig: {
      webAud: 'test-web-aud',
      expectedIss: 'https://auth.simogatti.it',
      allowSyntheticAuth: true
    }
  });

  async function executeVirtualRequest({
    method = 'GET',
    url = '/health',
    headers = {},
    body = null,
    remoteAddress = '127.0.0.1'
  } = {}) {
    const socket = new EventEmitter();
    socket.setTimeout = () => {};
    socket.remoteAddress = remoteAddress;
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    req.headers['host'] ||= 'localhost:8770'; req.headers['origin'] ||= 'http://localhost:8770';
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
          req.emit('data', Buffer.from(body, 'utf-8'));
        } else {
          req.emit('data', Buffer.from(JSON.stringify(body), 'utf-8'));
        }
      }
      req.emit('end');
    });

    await app.handleHttpRequest(req, res);

    return finishedPromise.then(() => {
      const rawBody = Buffer.concat(outChunks).toString('utf-8');
      let parsedJson = null;
      try {
        parsedJson = JSON.parse(rawBody);
      } catch {}

      return {
        statusCode: res.statusCode,
        headers: writtenHeaders,
        body: parsedJson,
        raw: rawBody
      };
    });
  }

  function parseAccessCookies(headers = {}) {
    const setCookie = headers['set-cookie'];
    const values = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
    return values.map(value => value.split(';', 1)[0]).join('; ');
  }

  function startAttemptSession(assessmentId, studentId, {
    seatRow = 'Fila 1', seatDesk = 'Banco 1', leftNeighborId = 'none', rightNeighborId = 'none'
  } = {}) {
    const assessment = service.getAssessment(assessmentId);
    return service.startClassAttempt({
      classId: assessment.class_id,
      assessmentId,
      studentId,
      seatRow,
      seatDesk,
      leftNeighborId,
      rightNeighborId
    });
  }

  async function startClassAttemptRequest(assessmentId, studentId, {
    cookie = classAccessCookie,
    seatRow = 'Fila 1', seatDesk = 'Banco 1', leftNeighborId = 'none', rightNeighborId = 'none'
  } = {}) {
    const assessment = service.getAssessment(assessmentId);
    if (!cookie) throw new Error('Test fixture must redeem the class PIN before starting an attempt');
    return executeVirtualRequest({
      method: 'POST',
      url: `/api/student/classes/${assessment.class_id}/activities/${assessmentId}/start`,
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: { studentId, seatRow, seatDesk, leftNeighborId, rightNeighborId }
    });
  }

  t.after(async () => {
    await app.close();
    clearJwksCache(); setTestAuthKeys(null);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

    let student1Token = null;
  let student2Token = null;
  let student3Token = null;
  let testSubmissionId = null;
  let student3 = null;

  await t.test('1. Student can list classes without authentication', async () => {
    const res = await executeVirtualRequest({
      method: 'GET',
      url: '/api/student/classes'
    });
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.classes));
    assert.equal(res.body.classes.length, 1);
    assert.equal(res.body.classes[0].name, '5B Informatica');
  });

  await t.test('2. Full student roster is not available through the legacy public route', async () => {
    const res = await executeVirtualRequest({
      method: 'GET',
      url: `/api/student/classes/${testClass.id}/students`
    });
    assert.equal(res.statusCode, 404);
    assert.ok(!res.raw.includes('Marco Rossi'));
    assert.ok(!res.raw.includes('Laura Bianchi'));
  });

  await t.test('3. Activity list is withheld until the shared class PIN is redeemed', async () => {
    const res = await executeVirtualRequest({
      method: 'GET',
      url: `/api/student/classes/${testClass.id}/activities`
    });
    assert.equal(res.statusCode, 401);
    assert.ok(!res.raw.includes(testAssessment.title));
  });

  await t.test('4. Shared class PIN unlocks active activities and allows declared identity before attempt', async () => {
    const retiredClaim = await executeVirtualRequest({
      method: 'POST',
      url: '/api/student/claim-code',
      headers: { 'Content-Type': 'application/json' },
      body: { accessCode: 'ABC123' }
    });
    assert.equal(retiredClaim.statusCode, 410);

    const access = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/classes/${testClass.id}/access`,
      headers: { 'Content-Type': 'application/json' },
      body: { pin: testClassPin }
    });
    assert.equal(access.statusCode, 200);
    assert.ok(access.body.class);
    classAccessCookie = parseAccessCookies(access.headers);
    assert.match(classAccessCookie, /ts_class_access=/);
    assert.ok(!classAccessCookie.includes(testClassPin));

    const activities = await executeVirtualRequest({
      method: 'GET',
      url: `/api/student/classes/${testClass.id}/activities`,
      headers: { Cookie: classAccessCookie }
    });
    assert.equal(activities.statusCode, 200);
    assert.deepEqual(activities.body.activities.map(item => item.id), [testAssessment.id]);

    const roster = await executeVirtualRequest({
      method: 'GET',
      url: `/api/student/classes/${testClass.id}/activities/${testAssessment.id}/students`,
      headers: { Cookie: classAccessCookie }
    });
    assert.equal(roster.statusCode, 200);
    assert.deepEqual(roster.body.students.map(student => student.fullName).sort(), ['Laura Bianchi', 'Marco Rossi']);
    assert.equal(roster.body.students[0].email, undefined);

    const startRes = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/classes/${testClass.id}/activities/${testAssessment.id}/start`,
      headers: { 'Content-Type': 'application/json', Cookie: classAccessCookie },
      body: {
        studentId: student1.id,
        seatRow: 'Fila 1',
        seatDesk: 'Banco 2',
        leftNeighborId: 'none',
        rightNeighborId: student2.id
      }
    });
    assert.equal(startRes.statusCode, 201);
    assert.equal(startRes.body.status, 'started');
    assert.equal(startRes.body.session.studentId, student1.id);
    assert.equal(startRes.body.session.studentName, 'Marco Rossi');
    student1Token = startRes.body.session.token;
    testSubmissionId = startRes.body.submission.id;
    assert.equal(startRes.body.submission.seat_row, 'Fila 1');
    assert.equal(startRes.body.submission.seat_desk, 'Banco 2');
    assert.equal(startRes.body.submission.left_neighbor_name, null, 'Nessuno is persisted as an empty neighbor reference');
    assert.equal(startRes.body.submission.right_neighbor_id, student2.id);
  });

  await t.test('5. Student can retrieve activity questions with teacher solutions strictly stripped', async () => {
    const res = await executeVirtualRequest({
      method: 'GET',
      url: `/api/student/activities/${testAssessment.id}`,
      headers: { 'X-Student-Token': student1Token }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.activity.title, 'Verifica Reti TCP/IP');
    assert.equal(res.body.activity.items.length, 2);
    for (const item of res.body.activity.items) {
      assert.equal(item.teacher_solution, null, 'Teacher solution must be strictly null for student');
      assert.equal(item.rubric, null, 'Rubric must be strictly null for student');
    }
  });

  await t.test('6. Re-entering the same activity and declared identity resumes the existing attempt', async () => {
    const res = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/classes/${testClass.id}/activities/${testAssessment.id}/start`,
      headers: { 'Content-Type': 'application/json', Cookie: classAccessCookie },
      body: {
        studentId: student1.id,
        seatRow: 'Fila 9',
        seatDesk: 'Banco 9',
        leftNeighborId: 'none',
        rightNeighborId: 'none'
      }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'resumed');
    assert.equal(res.body.submission.id, testSubmissionId);
    assert.equal(res.body.submission.seat_row, 'Fila 1', 'resume does not silently replace the original seat declaration');
    student1Token = res.body.session.token;
  });

  await t.test('7. Student can autosave responses and retrieve draft only for own session', async () => {
    const autosaveRes = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/activities/${testAssessment.id}/autosave`,
      headers: {
        'Content-Type': 'application/json',
        'X-Student-Token': student1Token
      },
      body: {
        revision: 2,
        seatRow: 'Fila 1',
        seatDesk: 'Banco 2',
        responses: [
          { itemId: testAssessment.items[0].id, responseText: 'Trasporto' }
        ]
      }
    });
    assert.equal(autosaveRes.statusCode, 200);
    assert.equal(autosaveRes.body.status, 'saved');

    // Retrieve draft: session token guarantees retrieval of own submission without passing studentId
    const draftRes = await executeVirtualRequest({
      method: 'GET',
      url: `/api/student/activities/${testAssessment.id}/submission`,
      headers: { 'X-Student-Token': student1Token }
    });
    assert.equal(draftRes.statusCode, 200);
    assert.ok(draftRes.body.submission);
    assert.equal(draftRes.body.submission.student_id, student1.id);
    assert.equal(draftRes.body.submission.responses.length, 1);
    assert.equal(draftRes.body.submission.responses[0].response_text, 'Trasporto');
  });

  await t.test('8. Student can finalize submission and it becomes immutable', async () => {
    const submitRes = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/activities/${testAssessment.id}/submit`,
      headers: {
        'Content-Type': 'application/json',
        'X-Student-Token': student1Token
      },
      body: {
        revision: 3,
        seatRow: 'Fila 1',
        seatDesk: 'Banco 2',
        responses: [
          { itemId: testAssessment.items[0].id, responseText: 'Trasporto' },
          { itemId: testAssessment.items[1].id, responseText: 'TCP è affidabile con handshake; UDP è leggero per streaming.' }
        ]
      }
    });
    assert.equal(submitRes.statusCode, 200);
    assert.equal(submitRes.body.status, 'submitted');
    assert.equal(submitRes.body.submission.status, 'submitted');
    assert.equal(submitRes.body.submission.attempt_status, 'submitted');

    // Subsequent autosave MUST be rejected with 409 Conflict
    const rejectedAutosave = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/activities/${testAssessment.id}/autosave`,
      headers: {
        'Content-Type': 'application/json',
        'X-Student-Token': student1Token
      },
      body: {
        revision: 4,
        responses: [{ itemId: testAssessment.items[0].id, responseText: 'Modifica illegittima' }]
      }
    });
    assert.equal(rejectedAutosave.statusCode, 409, 'Autosave after submission must return 409 Conflict');
  });

  await t.test('9. Teacher-only endpoints reject unauthenticated or student access', async () => {
    const res1 = await executeVirtualRequest({
      method: 'GET',
      url: '/api/classes'
    });
    assert.equal(res1.statusCode, 401);

    const res2 = await executeVirtualRequest({
      method: 'GET',
      url: `/api/assessments/${testAssessment.id}/live-monitor`
    });
    assert.equal(res2.statusCode, 401);

    const unauthenticatedTeacherActions = await Promise.all([
      executeVirtualRequest({
        method: 'POST',
        url: `/api/assessments/${testAssessment.id}/submissions/${student1.id}/extra-time`,
        body: { extraMinutes: 5, reason: 'negative auth test', idempotencyKey: 'negative-extra-time-0001' }
      }),
      executeVirtualRequest({
        method: 'POST',
        url: `/api/submissions/${testSubmissionId}/withdraw`,
        body: { reason: 'negative auth test', idempotencyKey: 'negative-withdraw-0001' }
      }),
      executeVirtualRequest({
        method: 'POST',
        url: `/api/assessments/${testAssessment.id}/submissions/${testSubmissionId}/reopen`,
        body: { reason: 'negative auth test', idempotencyKey: 'negative-reopen-0001' }
      })
    ]);
    assert.deepEqual(unauthenticatedTeacherActions.map(result => result.statusCode), [401, 401, 401]);

    const studentCannotOperateTeacherActions = await Promise.all([
      executeVirtualRequest({
        method: 'POST',
        url: `/api/assessments/${testAssessment.id}/submissions/${student1.id}/extra-time`,
        headers: { 'X-Student-Token': student1Token },
        body: { extraMinutes: 5, reason: 'student attempt', idempotencyKey: 'student-extra-time-0001' }
      }),
      executeVirtualRequest({
        method: 'POST',
        url: `/api/submissions/${testSubmissionId}/withdraw`,
        headers: { 'X-Student-Token': student1Token },
        body: { reason: 'student attempt', idempotencyKey: 'student-withdraw-0001' }
      }),
      executeVirtualRequest({
        method: 'POST',
        url: `/api/assessments/${testAssessment.id}/submissions/${testSubmissionId}/reopen`,
        headers: { 'X-Student-Token': student1Token },
        body: { reason: 'student attempt', idempotencyKey: 'student-reopen-0001' }
      })
    ]);
    assert.deepEqual(studentCannotOperateTeacherActions.map(result => result.statusCode), [401, 401, 401]);
  });

  await t.test('10. Teacher can view live monitoring with seat map and saved responses', async () => {
    const res = await executeVirtualRequest({
      method: 'GET',
      url: `/api/assessments/${testAssessment.id}/live-monitor`,
      headers: {
        'cf-access-jwt-assertion': teacherToken
      }
    });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.liveMonitoring);
    assert.equal(res.body.liveMonitoring.summary.submitted, 1);
    assert.equal(res.body.liveMonitoring.summary.total, 2);
    assert.ok(Array.isArray(res.body.liveMonitoring.students));

    const marco = res.body.liveMonitoring.students.find(s => s.studentId === student1.id);
    assert.ok(marco);
    assert.equal(marco.status, 'submitted');
    assert.equal(marco.seatRow, 'Fila 1');
    assert.equal(marco.seatDesk, 'Banco 2');
    assert.equal(marco.rightNeighborName, 'Laura Bianchi');
  });

  await t.test('11. Teacher can reopen submission and student can resume work', async () => {
    const reopenRes = await executeVirtualRequest({
      method: 'POST',
      url: `/api/assessments/${testAssessment.id}/submissions/${testSubmissionId}/reopen`,
      headers: {
        'cf-access-jwt-assertion': teacherToken,
        'Content-Type': 'application/json'
      },
      body: {
        reason: 'Connessione Wi-Fi interrotta durante la prova',
        idempotencyKey: 'student-api-reopen-attempt-0001'
      }
    });
    assert.equal(reopenRes.statusCode, 200, JSON.stringify(reopenRes.body));
    assert.equal(reopenRes.body.submission.attempt_status, 'in_progress');
    assert.equal(reopenRes.body.submission.reopened_by, teacherPrincipal);
    assert.equal(reopenRes.body.submission.reopen_reason, 'Connessione Wi-Fi interrotta durante la prova');

    // Now student can autosave again
    const resumeAutosave = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/activities/${testAssessment.id}/autosave`,
      headers: {
        'Content-Type': 'application/json',
        'X-Student-Token': student1Token
      },
      body: {
        revision: 4,
        responses: [{ itemId: testAssessment.items[0].id, responseText: 'Trasporto (aggiornato dopo riapertura)' }]
      }
    });
    assert.equal(resumeAutosave.statusCode, 200);
  });

  await t.test('12. Teacher can manage student roster via API', async () => {
    // List students as teacher
    const listRes = await executeVirtualRequest({
      method: 'GET',
      url: `/api/classes/${testClass.id}/students`,
      headers: {
        'Cf-Access-Jwt-Assertion': teacherToken
      }
    });
    assert.equal(listRes.statusCode, 200);
    assert.equal(listRes.body.students.length, 2);

    // Add student as teacher
    const addRes = await executeVirtualRequest({
      method: 'POST',
      url: `/api/classes/${testClass.id}/students`,
      headers: {
        'Cf-Access-Jwt-Assertion': teacherToken,
        'Content-Type': 'application/json'
      },
      body: {
        firstName: 'Andrea',
        lastName: 'Verdi',
        email: 'a.verdi@scuola.example'
      }
    });
    assert.equal(addRes.statusCode, 201);
    assert.equal(addRes.body.student.first_name, 'Andrea');

    // Delete student as teacher
    const delRes = await executeVirtualRequest({
      method: 'DELETE',
      url: `/api/students/${addRes.body.student.id}`,
      headers: {
        'Cf-Access-Jwt-Assertion': teacherToken
      }
    });
    assert.equal(delRes.statusCode, 200);
    });

  await t.test("13. Declared identity is explicit; attempt token scopes saved answers", async () => {
    const start2 = await startClassAttemptRequest(testAssessment.id, student2.id, {
      seatRow: 'Fila 1', seatDesk: 'Banco 3'
    });
    assert.equal(start2.statusCode, 201);
    student2Token = start2.body.session.token;

    // The Domain Owner accepts name selection as a declaration, not strong
    // identity proof. Starting the attempt creates this student's own draft.
    const draft2 = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + testAssessment.id + "/submission",
      headers: { "X-Student-Token": student2Token }
    });
    assert.equal(draft2.statusCode, 200);
    assert.ok(draft2.body.submission, JSON.stringify(draft2.body));
    assert.equal(draft2.body.submission.student_id, student2.id);

    // A client-supplied studentId is ignored: ownership comes only from the
    // attempt bearer returned by the server after the declaration flow.
    const spoofAutosave = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student2Token
      },
      body: {
        revision: 2,
        studentId: student1.id,
        studentName: "Marco Rossi",
        responses: [{ itemId: testAssessment.items[0].id, responseText: "RISPOSTA_STUDENTE_2" }]
      }
    });
    assert.equal(spoofAutosave.statusCode, 200);

    const sub1 = service.getStudentSubmission(testAssessment.id, student1.id);
    assert.ok(sub1);
    const sub1Item0 = sub1.responses.find(r => r.item_id === testAssessment.items[0].id);
    assert.equal(sub1Item0?.response_text, "Trasporto (aggiornato dopo riapertura)");

    const sub2 = service.getStudentSubmission(testAssessment.id, student2.id);
    assert.ok(sub2);
    assert.equal(sub2.student_id, student2.id);
    assert.equal(sub2.revision, 2);
    assert.equal(sub2.responses.find(r => r.item_id === testAssessment.items[0].id)?.response_text, "RISPOSTA_STUDENTE_2");
  });

  await t.test("14. Integrity: Draft activities are strictly inaccessible to students", async () => {
    const draftAsm = service.createAssessment({
      title: "Verifica Bozza Riservata",
      classId: testClass.id,
      subjectId: testSubject.id,
      status: "draft",
      items: [
        {
          type: "multiple_choice",
          questionText: "Domanda in bozza?",
          options: ["A", "B"],
          maxScore: 10,
          teacherSolution: "A"
        }
      ]
    });

    // Student cannot view draft activity via direct GET
    const draftView = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + draftAsm.id,
      headers: { "X-Student-Token": student1Token }
    });
    assert.ok(draftView.statusCode === 404 || draftView.statusCode === 403 || draftView.statusCode === 401);

    // Draft activities do not appear in class activities list
    const classActs = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/classes/" + testClass.id + "/activities",
      headers: { Cookie: classAccessCookie }
    });
    assert.equal(classActs.statusCode, 200);
    const draftFound = classActs.body.activities.find(a => a.id === draftAsm.id);
    assert.equal(draftFound, undefined, "Draft activities must never be listed to students");
  });

  await t.test("15. Immutability & Conflict: Finalized submission rejects further autosave, submit, and upload (409)", async () => {
    // Student 1 finalizes submission
    const finalSubmitRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/submit",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student1Token
      },
      body: {
        revision: 5,
        responses: [{ itemId: testAssessment.items[0].id, responseText: "Risposta finale definitiva" }]
      }
    });
    assert.equal(finalSubmitRes.statusCode, 200);
    assert.equal(finalSubmitRes.body.status, "submitted");

    // Subsequent autosave returns 409 Conflict
    const autosaveAfterFinal = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student1Token
      },
      body: {
        revision: 6,
        responses: [{ itemId: testAssessment.items[0].id, responseText: "Modifica non autorizzata" }]
      }
    });
    assert.equal(autosaveAfterFinal.statusCode, 409);
    assert.equal(autosaveAfterFinal.body.error, "ConflictError");

    // Subsequent submit returns 409 Conflict
    const secondSubmitRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/submit",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student1Token
      },
      body: { revision: 6 }
    });
    assert.equal(secondSubmitRes.statusCode, 409);
    assert.equal(secondSubmitRes.body.error, "ConflictError");


  });

  await t.test("16. Class PIN revocation blocks new navigation but preserves started attempts", async () => {
    const previousCookie = classAccessCookie;
    const attemptStatus = await executeVirtualRequest({
      method: 'GET', url: '/api/student/session', headers: { 'X-Student-Token': student1Token }
    });
    assert.equal(attemptStatus.statusCode, 200);

    service.revokeClassActivityPin(testClass.id, { revokedBy: 'synthetic-teacher' });
    const hiddenActivities = await executeVirtualRequest({
      method: 'GET', url: `/api/student/classes/${testClass.id}/activities`, headers: { Cookie: previousCookie }
    });
    assert.equal(hiddenActivities.statusCode, 401);
    const preservedAttempt = await executeVirtualRequest({
      method: 'GET', url: '/api/student/session', headers: { 'X-Student-Token': student1Token }
    });
    assert.equal(preservedAttempt.statusCode, 200, 'revoking the navigation PIN must not revoke an attempt bearer');

    const oldPin = await executeVirtualRequest({
      method: 'POST', url: `/api/student/classes/${testClass.id}/access`,
      headers: { 'Content-Type': 'application/json' }, body: { pin: testClassPin }
    });
    assert.equal(oldPin.statusCode, 403);

    testClassPin = service.generateClassActivityPin(testClass.id, { createdBy: 'synthetic-teacher' }).pin;
    const entered = await executeVirtualRequest({
      method: 'POST', url: `/api/student/classes/${testClass.id}/access`,
      headers: { 'Content-Type': 'application/json' }, body: { pin: testClassPin }
    });
    assert.equal(entered.statusCode, 200);
    classAccessCookie = parseAccessCookies(entered.headers);
    assert.match(classAccessCookie, /ts_class_access=/);
  });

  await t.test("17. Teacher solutions & rubrics isolation between student and teacher views", async () => {
    // Teacher endpoint returns full solutions
    const teacherView = await executeVirtualRequest({
      method: "GET",
      url: "/api/assessments/" + testAssessment.id,
      headers: { "cf-access-jwt-assertion": teacherToken }
    });
    assert.equal(teacherView.statusCode, 200);
    assert.ok(teacherView.body.assessment.items[0].teacher_solution);
    assert.equal(teacherView.body.assessment.items[0].teacher_solution, "Trasporto (Livello 4)");

    // Student endpoint strictly zeroes out solutions & rubrics
    const studentView = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + testAssessment.id,
      headers: { "X-Student-Token": student1Token }
    });
    assert.equal(studentView.statusCode, 200);
    for (const item of studentView.body.activity.items) {
      assert.equal(item.teacher_solution, null, "teacher_solution must be null for student");
      assert.equal(item.rubric, null, "rubric must be null for student");
      assert.equal(item.rubric_json, null, "rubric_json must be null for student");
    }

    const ownSubmission = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + testAssessment.id + "/submission",
      headers: { "X-Student-Token": student1Token }
    });
    assert.equal(ownSubmission.statusCode, 200);
    assert.equal(ownSubmission.body.submission.student_id, student1.id);
    assert.ok(!JSON.stringify(ownSubmission.body).includes("TEACHER_SOLUTION"));
    assert.ok(!Object.hasOwn(ownSubmission.body.submission, "teacher_notes"));
    assert.ok(!Object.hasOwn(ownSubmission.body.submission, "final_grade"));

    const studentIntegrityRoute = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + testAssessment.id + "/integrity-preview",
      headers: { "X-Student-Token": student1Token }
    });
    assert.equal(studentIntegrityRoute.statusCode, 404, "student API must not expose comparative integrity reports");
    const teacherIntegrityRoute = await executeVirtualRequest({
      method: "GET",
      url: "/api/assessments/" + testAssessment.id + "/integrity-preview",
      headers: { "X-Student-Token": student1Token }
    });
    assert.equal(teacherIntegrityRoute.statusCode, 401, "student session must not authenticate teacher-only integrity routes");
  });

  await t.test("18. File upload security: Safe extensions accepted, dangerous/executable rejected", async () => {
    const attachmentAssessment = service.createAssessment({
      title: "Consegna allegato sicurezza",
      classId: testClass.id,
      subjectId: testSubject.id,
      status: "active",
      durationMinutes: 45,
      items: [{
        type: "attachment",
        questionText: "Carica un diagramma di rete",
        maxScore: 10,
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1
      }]
    });
    const startRes = await startClassAttemptRequest(attachmentAssessment.id, student2.id);
    assert.equal(startRes.statusCode, 201);
    const token = startRes.body.session.token;

    const boundary = "----UploadSecBoundary123";
    const makeMultipart = (filename, contentType, bytes) => Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="assessmentId"\r\n\r\n${attachmentAssessment.id}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="itemId"\r\n\r\n${attachmentAssessment.items[0].id}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
      bytes, Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const dangerous = makeMultipart("exploit.sh", "text/x-sh", Buffer.from("#!/bin/sh\necho blocked"));
    const dangerRes = await executeVirtualRequest({
      method: "POST", url: "/api/student/upload",
      headers: { "X-Student-Token": token, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: dangerous
    });
    assert.equal(dangerRes.statusCode, 400);
    assert.match(dangerRes.body.message, /Unsupported file extension/);

    const safe = makeMultipart("schema_rete.pdf", "application/pdf", Buffer.from("%PDF-1.4\nDiagramma sintetico\n"));
    const safeRes = await executeVirtualRequest({
      method: "POST", url: "/api/student/upload",
      headers: { "X-Student-Token": token, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: safe
    });
    assert.equal(safeRes.statusCode, 201);
    assert.ok(safeRes.body.attachmentId);
    assert.equal(safeRes.body.attachmentName, "schema_rete.pdf");
    assert.equal(safeRes.body.attachmentPath, undefined, "storage path must not be exposed to the browser");
  });

  await t.test("19. Cross-Class Access Rejection: Student from Class A cannot access or save for Class B", async () => {
    // Create separate class and student
    const otherClass = service.createClass({
      name: "3A Elettronica",
      academicYear: "2026/2027"
    });
    const foreignStudent = service.addStudent({
      classId: otherClass.id,
      firstName: "Davide",
      lastName: "Riva"
    });

    // Attempting to save draft submission for testAssessment (which belongs to testClass 5B)
    assert.throws(
      () => {
        service.saveDraftSubmission({
          assessmentId: testAssessment.id,
          studentId: foreignStudent.id,
          responses: [{ itemId: testAssessment.items[0].id, responseText: "Foreign attempt" }]
        });
      },
      {
        name: "AuthorizationError",
        message: /non appartiene alla classe/
      }
    );
  });

  await t.test("20. Concurrency & Reconnect resilience: Subsequent autosaves update lastSavedAt smoothly", async () => {
    assert.ok(student2Token);

    // Send rapid autosaves
    const save1 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student2Token
      },
      body: {
        revision: 3,
        responses: [{ itemId: testAssessment.items[0].id, responseText: "Risposta revisione 1" }]
      }
    });
    assert.equal(save1.statusCode, 200);

    const save2 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student2Token
      },
      body: {
        revision: 4,
        responses: [{ itemId: testAssessment.items[0].id, responseText: "Risposta revisione 2 (definitiva)" }]
      }
    });
    assert.equal(save2.statusCode, 200);
    assert.ok(save2.body.lastSavedAt);

    // Verify stored state matches latest
    const latestSub = service.getStudentSubmission(testAssessment.id, student2.id);
    assert.equal(latestSub.responses[0].response_text, "Risposta revisione 2 (definitiva)");
  });

  await t.test("21. Page Reload & State Restoration: Student resumes session, draft responses and seat map are restored completely", async () => {
    // Student 2 verifies session upon page reload
    assert.ok(student2Token);

    // 1. Session verification on page reload
    const sessRes = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/session",
      headers: { "X-Student-Token": student2Token }
    });
    assert.equal(sessRes.statusCode, 200);
    assert.equal(sessRes.body.session.studentId, student2.id);
    assert.equal(sessRes.body.session.assessmentId, testAssessment.id);

    // 2. Draft retrieval on page reload
    const draftRes = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + testAssessment.id + "/submission",
      headers: { "X-Student-Token": student2Token }
    });
    assert.equal(draftRes.statusCode, 200);
    assert.ok(draftRes.body.submission);
    assert.equal(draftRes.body.submission.attempt_status, "in_progress");
    assert.ok(Array.isArray(draftRes.body.submission.responses));
    const r0 = draftRes.body.submission.responses.find(r => r.item_id === testAssessment.items[0].id);
    assert.equal(r0?.response_text, "Risposta revisione 2 (definitiva)");
  });

  await t.test("22. Stale / Delayed In-Flight Autosave arriving AFTER Final Submission is rejected with 409 Conflict", async () => {
    assert.ok(student2Token);

    // Student 2 finalizes submission
    const submitRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/submit",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student2Token
      },
      body: {
        revision: 5,
        responses: [
          { itemId: testAssessment.items[0].id, responseText: "Risposta finale sigillata" }
        ]
      }
    });
    assert.equal(submitRes.statusCode, 200);
    assert.equal(submitRes.body.submission.attempt_status, "submitted");

    // A delayed in-flight autosave request arrives AFTER final submission
    const delayedAutosaveRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student2Token
      },
      body: {
        revision: 4,
        responses: [
          { itemId: testAssessment.items[0].id, responseText: "Stale out-of-order text that must not overwrite" }
        ]
      }
    });
    assert.equal(delayedAutosaveRes.statusCode, 409);
    assert.equal(delayedAutosaveRes.body.error, "ConflictError");

    // Verify DB still contains the finalized submission and not the stale autosave
    const sub = service.getStudentSubmission(testAssessment.id, student2.id);
    assert.equal(sub.attempt_status, "submitted");
    assert.equal(sub.responses[0].response_text, "Risposta finale sigillata");
  });

  await t.test("23. Revoked attempt bearer fails closed and class-PIN re-entry recovers the saved draft", async () => {
    student3 = service.addStudent({
      classId: testClass.id,
      firstName: "Giulia",
      lastName: "Verdi",
      email: "g.verdi@scuola.example"
    });
    const started = await startClassAttemptRequest(testAssessment.id, student3.id, {
      seatRow: 'Fila 3', seatDesk: 'Banco 1'
    });
    assert.equal(started.statusCode, 201);
    student3Token = started.body.session.token;
    const submissionId = started.body.submission.id;
    const originalExpiry = started.body.submission.timer.expires_at;

    const saved = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/activities/${testAssessment.id}/autosave`,
      headers: { 'Content-Type': 'application/json', 'X-Student-Token': student3Token },
      body: { revision: 2, responses: [{ itemId: testAssessment.items[0].id, responseText: 'Salvata prima della disconnessione' }] }
    });
    assert.equal(saved.statusCode, 200);
    dbManager.prepare(`UPDATE student_attempt_sessions SET revoked_at = ? WHERE submission_id = ? AND revoked_at IS NULL`)
      .run(new Date().toISOString(), submissionId);

    const rejected = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/activities/${testAssessment.id}/autosave`,
      headers: { 'Content-Type': 'application/json', 'X-Student-Token': student3Token },
      body: { revision: 3, responses: [{ itemId: testAssessment.items[0].id, responseText: 'Non deve sovrascrivere' }] }
    });
    assert.equal(rejected.statusCode, 401);

    const reentered = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/classes/${testClass.id}/access`,
      headers: { 'Content-Type': 'application/json' },
      body: { pin: testClassPin }
    });
    assert.equal(reentered.statusCode, 200);
    classAccessCookie = parseAccessCookies(reentered.headers);
    const resumed = await startClassAttemptRequest(testAssessment.id, student3.id, {
      cookie: classAccessCookie, seatRow: 'Fila 3', seatDesk: 'Banco 1'
    });
    assert.equal(resumed.statusCode, 200);
    assert.equal(resumed.body.submission.id, submissionId);
    assert.equal(resumed.body.submission.responses[0].response_text, 'Salvata prima della disconnessione');
    assert.equal(resumed.body.submission.timer.expires_at, originalExpiry);
    student3Token = resumed.body.session.token;
  });

  await t.test("24. Duplicate & Rapid Concurrent Requests Handling", async () => {
    // Use the recovered attempt bearer. Identical revisions race, and the
    // server permits exactly one persisted write.
    const currentRevision = service.getStudentSubmission(testAssessment.id, student3.id).revision;
    const duplicateRevision = currentRevision + 1;
    // Concurrent autosaves in flight: two requests with the same revision
    // Exactly one must succeed (200) and the duplicate must be rejected (409 Conflict)
    const [resA, resB] = await Promise.all([
      executeVirtualRequest({
        method: "POST",
        url: "/api/student/activities/" + testAssessment.id + "/autosave",
        headers: { "Content-Type": "application/json", "X-Student-Token": student3Token },
        body: { revision: duplicateRevision, responses: [{ itemId: testAssessment.items[0].id, responseText: "Test concorrente A" }] }
      }),
      executeVirtualRequest({
        method: "POST",
        url: "/api/student/activities/" + testAssessment.id + "/autosave",
        headers: { "Content-Type": "application/json", "X-Student-Token": student3Token },
        body: { revision: duplicateRevision, responses: [{ itemId: testAssessment.items[0].id, responseText: "Test concorrente B" }] }
      })
    ]);
    const statuses = [resA.statusCode, resB.statusCode].sort();
    assert.deepEqual(statuses, [200, 409]);

    // Duplicate submit calls: first succeeds at the next revision, second returns 409 Conflict
    const submit1 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/submit",
      headers: { "Content-Type": "application/json", "X-Student-Token": student3Token },
      body: { revision: duplicateRevision + 1 }
    });
    assert.equal(submit1.statusCode, 200);

    const submit2 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/submit",
      headers: { "Content-Type": "application/json", "X-Student-Token": student3Token },
      body: { revision: duplicateRevision + 1 }
    });
    assert.equal(submit2.statusCode, 409);
    assert.equal(submit2.body.error, "ConflictError");
  });

  await t.test("25. Question Item CRUD & Teacher Solutions Protection", async () => {
    // 1. Invariant: Modifying items on an assessment with started submissions is rejected with 409 Conflict
    const rejectedAddItem = await executeVirtualRequest({
      method: "POST",
      url: "/api/assessments/" + testAssessment.id + "/items",
      headers: {
        "Content-Type": "application/json",
        "Cf-Access-Jwt-Assertion": teacherToken
      },
      body: {
        type: "code",
        questionText: "Non consentito su prova già avviata",
        maxScore: 10,
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1
      }
    });
    assert.equal(rejectedAddItem.statusCode, 409);
    assert.match(rejectedAddItem.body.message, /ha già tentativi avviati/);

    // 2. Fresh assessment without attempts allows full item CRUD, version bumping, and solution isolation
    const freshAsm = service.createAssessment({
      title: "Verifica Quesiti e Rubriche Docente",
      classId: testClass.id,
      subjectId: testSubject.id,
      activityType: "test",
      status: "active",
      durationMinutes: 45,
      maxScore: 30
    });
    // The assessment remains editable until its first attempt is started.
    // Teacher adds a new Code question item
    const addItemRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/assessments/" + freshAsm.id + "/items",
      headers: {
        "Content-Type": "application/json",
        "Cf-Access-Jwt-Assertion": teacherToken
      },
      body: {
        type: "code",
        questionText: "Scrivi una funzione Python che calcoli il checksum TCP",
        maxScore: 10,
        language: "python",
        starterCode: "def tcp_checksum(packet):\n    pass",
        teacherSolution: "def tcp_checksum(packet):\n    return sum(packet) & 0xffff",
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1
      }
    });
    assert.equal(addItemRes.statusCode, 201);
    const newItemId = addItemRes.body.item.id;
    assert.ok(newItemId);

    // Teacher view has teacher solution
    const teacherView = await executeVirtualRequest({
      method: "GET",
      url: "/api/assessments/" + freshAsm.id,
      headers: { "Cf-Access-Jwt-Assertion": teacherToken }
    });
    assert.equal(teacherView.statusCode, 200);
    const addedItemTeacher = teacherView.body.assessment.items.find(i => i.id === newItemId);
    assert.equal(addedItemTeacher.teacher_solution, "def tcp_checksum(packet):\n    return sum(packet) & 0xffff");

    // Teacher updates the item
    const updateItemRes = await executeVirtualRequest({
      method: "PUT",
      url: "/api/assessments/" + freshAsm.id + "/items/" + newItemId,
      headers: {
        "Content-Type": "application/json",
        "Cf-Access-Jwt-Assertion": teacherToken
      },
      body: {
        maxScore: 15,
        teacherSolution: "def tcp_checksum_v2(packet):\n    return 42"
      }
    });
    assert.equal(updateItemRes.statusCode, 200);
    assert.equal(updateItemRes.body.item.max_score, 15);

    // Deletion is allowed while no student has started this version.
    const temporaryItem = await executeVirtualRequest({
      method: "POST",
      url: "/api/assessments/" + freshAsm.id + "/items",
      headers: { "Content-Type": "application/json", "Cf-Access-Jwt-Assertion": teacherToken },
      body: {
        type: "open_short", questionText: "Quesito temporaneo", maxScore: 1,
        assessableSourceId: studentMaterial.id, assessableSourceVersion: 1
      }
    });
    assert.equal(temporaryItem.statusCode, 201);
    const deleteBeforeStart = await executeVirtualRequest({
      method: "DELETE",
      url: "/api/assessments/" + freshAsm.id + "/items/" + temporaryItem.body.item.id,
      headers: { "Cf-Access-Jwt-Assertion": teacherToken }
    });
    assert.equal(deleteBeforeStart.statusCode, 200);

    const freshStart = await startClassAttemptRequest(freshAsm.id, student1.id, {
      seatRow: 'Fila 1', seatDesk: 'Banco 2'
    });
    assert.equal(freshStart.statusCode, 201, JSON.stringify(freshStart.body));
    const freshStudentToken = freshStart.body.session.token;
    const studentView = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + freshAsm.id,
      headers: { "X-Student-Token": freshStudentToken }
    });
    assert.equal(studentView.statusCode, 200);
    const addedItemStudent = studentView.body.activity.items.find(i => i.id === newItemId);
    assert.equal(addedItemStudent.teacher_solution, null);

    // Teacher deletes the item
    const deleteItemRes = await executeVirtualRequest({
      method: "DELETE",
      url: "/api/assessments/" + freshAsm.id + "/items/" + newItemId,
      headers: { "Cf-Access-Jwt-Assertion": teacherToken }
    });
    assert.equal(deleteItemRes.statusCode, 409, 'question changes are locked after a student starts');
  });

  await t.test("26. Retired individual codes are unavailable through service and HTTP contracts", async () => {
    assert.throws(() => service.generateActivityCredentials(testAssessment.id), { code: 'CONFLICT' });
    assert.throws(() => service.listActivityCredentials(testAssessment.id), { code: 'CONFLICT' });
    assert.throws(() => service.reissueActivityCredential('historical-credential', { reason: 'legacy' }), { code: 'CONFLICT' });

    const claim = await executeVirtualRequest({
      method: 'POST', url: '/api/student/claim-code',
      headers: { 'Content-Type': 'application/json' }, body: { accessCode: 'ABC123' }
    });
    assert.equal(claim.statusCode, 410);
    const credentialList = await executeVirtualRequest({
      method: 'GET', url: `/api/assessments/${testAssessment.id}/credentials`,
      headers: { 'Cf-Access-Jwt-Assertion': teacherToken }
    });
    assert.equal(credentialList.statusCode, 410);
  });

  await t.test("27. Draft and ready activities are not listed or startable", async () => {
    const draftAsm = service.createAssessment({
      title: 'Bozza non visibile', classId: testClass.id, subjectId: testSubject.id, status: 'draft'
    });
    const readyAsm = service.createAssessment({
      title: 'Pronta ma non attiva', classId: testClass.id, subjectId: testSubject.id, status: 'ready',
      items: [{
        type: 'open_short', questionText: 'Quesito riservato fino all’attivazione', maxScore: 10,
        assessableSourceId: studentMaterial.id, assessableSourceVersion: 1, teacherSolution: 'Soluzione privata'
      }]
    });
    const activities = await executeVirtualRequest({
      method: 'GET', url: `/api/student/classes/${testClass.id}/activities`,
      headers: { Cookie: classAccessCookie }
    });
    assert.equal(activities.statusCode, 200);
    assert.ok(!activities.body.activities.some(item => [draftAsm.id, readyAsm.id].includes(item.id)));

    for (const assessmentId of [draftAsm.id, readyAsm.id]) {
      const start = await startClassAttemptRequest(assessmentId, student1.id);
      assert.equal(start.statusCode, 403);
    }
    assert.ok(!activities.raw.includes('Soluzione privata'));
  });

  await t.test("28. Monotonic autosave rejects stale and duplicate revisions without overwriting saved answers", async () => {
    const studentMono = service.addStudent({ classId: testClass.id, firstName: 'Claudio', lastName: 'Neri' });
    const started = await startClassAttemptRequest(testAssessment.id, studentMono.id);
    assert.equal(started.statusCode, 201);
    const token = started.body.session.token;
    const itemId = testAssessment.items[0].id;

    const save2 = await executeVirtualRequest({
      method: 'POST', url: `/api/student/activities/${testAssessment.id}/autosave`,
      headers: { 'Content-Type': 'application/json', 'X-Student-Token': token },
      body: { revision: 2, responses: [{ itemId, responseText: 'Revisione 2' }] }
    });
    assert.equal(save2.statusCode, 200);
    const save5 = await executeVirtualRequest({
      method: 'POST', url: `/api/student/activities/${testAssessment.id}/autosave`,
      headers: { 'Content-Type': 'application/json', 'X-Student-Token': token },
      body: { revision: 5, responses: [{ itemId, responseText: 'Revisione 5 conservata' }] }
    });
    assert.equal(save5.statusCode, 200);
    for (const revision of [3, 5]) {
      const stale = await executeVirtualRequest({
        method: 'POST', url: `/api/student/activities/${testAssessment.id}/autosave`,
        headers: { 'Content-Type': 'application/json', 'X-Student-Token': token },
        body: { revision, responses: [{ itemId, responseText: 'Sovrascrittura obsoleta' }] }
      });
      assert.equal(stale.statusCode, 409);
    }
    assert.equal(service.getStudentSubmission(testAssessment.id, studentMono.id).responses[0].response_text, 'Revisione 5 conservata');
  });

  await t.test("29. Teacher-only class PIN management generates, reports and revokes the shared PIN", async () => {
    const route = `/api/classes/${testClass.id}/activity-pin`;
    const unauthorized = await executeVirtualRequest({ method: 'GET', url: route });
    assert.equal(unauthorized.statusCode, 401);

    const generated = await executeVirtualRequest({
      method: 'POST', url: route, headers: { 'Cf-Access-Jwt-Assertion': teacherToken }
    });
    assert.equal(generated.statusCode, 201);
    assert.match(generated.body.pin.pin, /^\d{4}$/);
    testClassPin = generated.body.pin.pin;

    const status = await executeVirtualRequest({
      method: 'GET', url: route, headers: { 'Cf-Access-Jwt-Assertion': teacherToken }
    });
    assert.equal(status.statusCode, 200);
    assert.equal(status.body.pin.active, true);
    assert.ok(!JSON.stringify(status.body).includes(testClassPin));

    const revoked = await executeVirtualRequest({
      method: 'DELETE', url: route, headers: { 'Cf-Access-Jwt-Assertion': teacherToken }
    });
    assert.equal(revoked.statusCode, 200);
    assert.equal(revoked.body.pin.active, false);

    const regenerated = await executeVirtualRequest({
      method: 'POST', url: route, headers: { 'Cf-Access-Jwt-Assertion': teacherToken }
    });
    assert.equal(regenerated.statusCode, 201);
    testClassPin = regenerated.body.pin.pin;
    const entered = await executeVirtualRequest({
      method: 'POST', url: `/api/student/classes/${testClass.id}/access`,
      headers: { 'Content-Type': 'application/json' }, body: { pin: testClassPin }
    });
    assert.equal(entered.statusCode, 200);
    classAccessCookie = parseAccessCookies(entered.headers);
  });

  await t.test("30. Concurrent shared-PIN entry succeeds and duplicate starts are idempotent per browser", async () => {
    const [accessA, accessB] = await Promise.all([
      executeVirtualRequest({
        method: 'POST', url: `/api/student/classes/${testClass.id}/access`,
        headers: { 'Content-Type': 'application/json' }, body: { pin: testClassPin }
      }),
      executeVirtualRequest({
        method: 'POST', url: `/api/student/classes/${testClass.id}/access`,
        headers: { 'Content-Type': 'application/json' }, body: { pin: testClassPin }
      })
    ]);
    assert.deepEqual([accessA.statusCode, accessB.statusCode], [200, 200]);
    const browserCookie = parseAccessCookies(accessA.headers);
    classAccessCookie = browserCookie;

    const studentDoubleClick = service.addStudent({ classId: testClass.id, firstName: 'Elena', lastName: 'Blu' });
    const startRequest = () => startClassAttemptRequest(testAssessment.id, studentDoubleClick.id, { cookie: browserCookie });
    const [startA, startB] = await Promise.all([startRequest(), startRequest()]);
    assert.ok([200, 201].includes(startA.statusCode));
    assert.ok([200, 201].includes(startB.statusCode));
    assert.equal(startA.body.submission.id, startB.body.submission.id);
    assert.equal(startA.body.session.token, startB.body.session.token, 'duplicate starts from one browser return the same bearer');
    const liveSessions = dbManager.prepare(`
      SELECT COUNT(*) AS count FROM student_attempt_sessions
      WHERE submission_id = ? AND revoked_at IS NULL
    `).get(startA.body.submission.id).count;
    assert.equal(liveSessions, 1);
  });

  await t.test("31. PIN rotation preserves attempts, drafts, timers and final submission immutability", async () => {
    const recoveringStudent = service.addStudent({ classId: testClass.id, firstName: 'Marta', lastName: 'Gialli' });
    const started = await startClassAttemptRequest(testAssessment.id, recoveringStudent.id, {
      seatRow: 'Fila 4', seatDesk: 'Banco 6'
    });
    assert.equal(started.statusCode, 201);
    const token = started.body.session.token;
    const submissionId = started.body.submission.id;
    const expiry = started.body.submission.timer.expires_at;
    const itemId = testAssessment.items[0].id;

    const save = await executeVirtualRequest({
      method: 'POST', url: `/api/student/activities/${testAssessment.id}/autosave`,
      headers: { 'Content-Type': 'application/json', 'X-Student-Token': token },
      body: { revision: 2, responses: [{ itemId, responseText: 'Risposta conservata dopo rotazione' }] }
    });
    assert.equal(save.statusCode, 200);
    testClassPin = service.generateClassActivityPin(testClass.id, { createdBy: 'synthetic-teacher' }).pin;

    const oldClassSession = await executeVirtualRequest({
      method: 'GET', url: `/api/student/classes/${testClass.id}/activities`, headers: { Cookie: classAccessCookie }
    });
    assert.equal(oldClassSession.statusCode, 401);
    const stillRunning = await executeVirtualRequest({
      method: 'GET', url: '/api/student/session', headers: { 'X-Student-Token': token }
    });
    assert.equal(stillRunning.statusCode, 200);
    assert.equal(service.getStudentSubmission(testAssessment.id, recoveringStudent.id).responses[0].response_text, 'Risposta conservata dopo rotazione');

    const newEntry = await executeVirtualRequest({
      method: 'POST', url: `/api/student/classes/${testClass.id}/access`,
      headers: { 'Content-Type': 'application/json' }, body: { pin: testClassPin }
    });
    assert.equal(newEntry.statusCode, 200);
    classAccessCookie = parseAccessCookies(newEntry.headers);
    const resumed = await startClassAttemptRequest(testAssessment.id, recoveringStudent.id, { cookie: classAccessCookie });
    assert.equal(resumed.statusCode, 200);
    assert.equal(resumed.body.submission.id, submissionId);
    assert.equal(resumed.body.submission.timer.expires_at, expiry);
    assert.equal(resumed.body.submission.responses[0].response_text, 'Risposta conservata dopo rotazione');

    const submitted = await executeVirtualRequest({
      method: 'POST', url: `/api/student/activities/${testAssessment.id}/submit`,
      headers: { 'Content-Type': 'application/json', 'X-Student-Token': resumed.body.session.token },
      body: { revision: 3, responses: [{ itemId, responseText: 'Risposta definitiva' }] }
    });
    assert.equal(submitted.statusCode, 200);
    testClassPin = service.generateClassActivityPin(testClass.id, { createdBy: 'synthetic-teacher' }).pin;
    const refreshedEntry = await executeVirtualRequest({
      method: 'POST', url: `/api/student/classes/${testClass.id}/access`,
      headers: { 'Content-Type': 'application/json' }, body: { pin: testClassPin }
    });
    assert.equal(refreshedEntry.statusCode, 200);
    classAccessCookie = parseAccessCookies(refreshedEntry.headers);
    const lateSave = await executeVirtualRequest({
      method: 'POST', url: `/api/student/activities/${testAssessment.id}/autosave`,
      headers: { 'Content-Type': 'application/json', 'X-Student-Token': resumed.body.session.token },
      body: { revision: 4, responses: [{ itemId, responseText: 'Modifica tardiva' }] }
    });
    assert.equal(lateSave.statusCode, 409);
    assert.equal(service.getStudentSubmission(testAssessment.id, recoveringStudent.id).responses[0].response_text, 'Risposta definitiva');
  });

  await t.test("33. Multi-Question Assessment with Two Concurrent Students: Monotonic Autosave & Live Monitoring", async () => {
    // 1. Create a multi-question assessment with 3 varied items
    const multiAsm = service.createAssessment({
      title: "Verifica Multi-Quesito Concorrente",
      classId: testClass.id,
      subjectId: testSubject.id,
      activityType: "test",
      status: "active",
      durationMinutes: 60,
      maxScore: 30,
      items: [
        {
          type: "open_short",
          questionText: "Cos'è il modello OSI?",
          maxScore: 10,
          assessableSourceId: studentMaterial.id,
          assessableSourceVersion: 1,
          teacherSolution: "Modello architetturale a 7 livelli"
        },
        {
          type: "multiple_choice",
          questionText: "Quale livello gestisce il routing IP?",
          options: ["Fisico", "Collegamento", "Rete", "Trasporto"],
          maxScore: 5,
          assessableSourceId: studentMaterial.id,
          assessableSourceVersion: 1,
          teacherSolution: "Rete"
        },
        {
          type: "code",
          questionText: "Implementa un socket TCP client",
          maxScore: 15,
          assessableSourceId: studentMaterial.id,
          assessableSourceVersion: 1,
          teacherSolution: "import socket\ns = socket.socket()"
        }
      ]
    });
    assert.equal(multiAsm.items.length, 3);

    // 2. Add two distinct students for the same class-shared PIN workflow
    const studA = service.addStudent({
      classId: testClass.id,
      firstName: "Elena",
      lastName: "Galli",
      email: "e.galli@scuola.example"
    });
    const studB = service.addStudent({
      classId: testClass.id,
      firstName: "Federico",
      lastName: "Riva",
      email: "f.riva@scuola.example"
    });

    // 3. Each student explicitly selects their roster identity after class PIN entry.
    const [startA, startB] = await Promise.all([
      startClassAttemptRequest(multiAsm.id, studA.id, {
        seatRow: 'Fila 2', seatDesk: 'Banco 1', rightNeighborId: studB.id
      }),
      startClassAttemptRequest(multiAsm.id, studB.id, {
        seatRow: 'Fila 2', seatDesk: 'Banco 2', leftNeighborId: studA.id
      })
    ]);
    assert.equal(startA.statusCode, 201, JSON.stringify(startA.body));
    assert.equal(startB.statusCode, 201, JSON.stringify(startB.body));
    const tokenA = startA.body.session.token;
    const tokenB = startB.body.session.token;

    // 5. Concurrent autosaves across questions with monotonic revisions
    const items = multiAsm.items;
    const [autoA1, autoB1] = await Promise.all([
      executeVirtualRequest({
        method: "POST",
        url: `/api/student/activities/${multiAsm.id}/autosave`,
        headers: { "Content-Type": "application/json", "X-Student-Token": tokenA },
        body: {
          revision: 2,
          responses: [{ itemId: items[0].id, responseText: "Elena: Modello a 7 strati ISO/OSI" }]
        }
      }),
      executeVirtualRequest({
        method: "POST",
        url: `/api/student/activities/${multiAsm.id}/autosave`,
        headers: { "Content-Type": "application/json", "X-Student-Token": tokenB },
        body: {
          revision: 2,
          responses: [{ itemId: items[0].id, responseText: "Federico: Standard internazionale reti" }]
        }
      })
    ]);
    assert.equal(autoA1.statusCode, 200);
    assert.equal(autoA1.body.revision, 2);
    assert.equal(autoB1.statusCode, 200);
    assert.equal(autoB1.body.revision, 2);

    // Save Q2 and Q3
    await executeVirtualRequest({
      method: "POST",
      url: `/api/student/activities/${multiAsm.id}/autosave`,
      headers: { "Content-Type": "application/json", "X-Student-Token": tokenA },
      body: {
        revision: 3,
        responses: [
          { itemId: items[0].id, responseText: "Elena: Modello a 7 strati ISO/OSI" },
          { itemId: items[1].id, responseText: "Rete" },
          { itemId: items[2].id, responseText: "const client = net.createConnection(80);" }
        ]
      }
    });

    await executeVirtualRequest({
      method: "POST",
      url: `/api/student/activities/${multiAsm.id}/autosave`,
      headers: { "Content-Type": "application/json", "X-Student-Token": tokenB },
      body: {
        revision: 3,
        responses: [
          { itemId: items[0].id, responseText: "Federico: Standard internazionale reti" },
          { itemId: items[1].id, responseText: "Rete" },
          { itemId: items[2].id, responseText: "s = socket.socket(); s.connect(('127.0.0.1', 80))" }
        ]
      }
    });

    // 6. Student A finalizes submission (revision 4)
    const submitA = await executeVirtualRequest({
      method: "POST",
      url: `/api/student/activities/${multiAsm.id}/submit`,
      headers: { "Content-Type": "application/json", "X-Student-Token": tokenA },
      body: {
        revision: 4,
        responses: [
          { itemId: items[0].id, responseText: "Elena: Modello a 7 strati ISO/OSI Definitivo" },
          { itemId: items[1].id, responseText: "Rete" },
          { itemId: items[2].id, responseText: "const client = net.createConnection(80);" }
        ]
      }
    });
    assert.equal(submitA.statusCode, 200);
    assert.equal(submitA.body.status, "submitted");
    assert.equal(submitA.body.revision, 4);

    // 7. Late autosave attempt from Student A is rejected with 409 Conflict
    const lateAutoA = await executeVirtualRequest({
      method: "POST",
      url: `/api/student/activities/${multiAsm.id}/autosave`,
      headers: { "Content-Type": "application/json", "X-Student-Token": tokenA },
      body: {
        revision: 5,
        responses: [{ itemId: items[0].id, responseText: "Late modification" }]
      }
    });
    assert.equal(lateAutoA.statusCode, 409);
    assert.match(lateAutoA.body.message, /già finalizzata ed immutabile/);

    // 8. Student B continues editing peacefully (revision 4)
    const autoB4 = await executeVirtualRequest({
      method: "POST",
      url: `/api/student/activities/${multiAsm.id}/autosave`,
      headers: { "Content-Type": "application/json", "X-Student-Token": tokenB },
      body: {
        revision: 4,
        responses: [
          { itemId: items[0].id, responseText: "Federico: Revisione approfondita" },
          { itemId: items[1].id, responseText: "Rete" },
          { itemId: items[2].id, responseText: "s = socket.socket(); s.connect(('127.0.0.1', 80))" }
        ]
      }
    });
    assert.equal(autoB4.statusCode, 200);
    assert.equal(autoB4.body.revision, 4);

    // 9. Teacher Live Monitor accurately reflects both students
    const monitorRes = await executeVirtualRequest({
      method: "GET",
      url: `/api/assessments/${multiAsm.id}/live-monitor`,
      headers: { "Cf-Access-Jwt-Assertion": teacherToken }
    });
    assert.equal(monitorRes.statusCode, 200);
    const mon = monitorRes.body.liveMonitoring;
    assert.equal(mon.summary.submitted, 1);
    assert.equal(mon.summary.inProgress, 1);

    const studAMon = mon.students.find(s => s.studentId === studA.id);
    const studBMon = mon.students.find(s => s.studentId === studB.id);
    assert.equal(studAMon.status, "submitted");
    assert.equal(studAMon.answeredCount, 3);
    assert.equal(studAMon.seatRow, "Fila 2");
    assert.equal(studAMon.seatDesk, "Banco 1");

    assert.equal(studBMon.status, "in_progress");
    assert.equal(studBMon.answeredCount, 3);
    assert.equal(studBMon.seatRow, "Fila 2");
    assert.equal(studBMon.seatDesk, "Banco 2");
  });

  await t.test("34. Class PIN limiter ignores client-forged forwarding headers from direct peers", async () => {
    const directPublicIp = '203.0.113.88';
    const deviceCookie = 'ts_class_device=synthetic-device-fixed';
    for (let i = 0; i < 4; i += 1) {
      const response = await executeVirtualRequest({
        method: 'POST',
        url: `/api/student/classes/${testClass.id}/access`,
        remoteAddress: directPublicIp,
        headers: {
          'Content-Type': 'application/json',
          Cookie: deviceCookie,
          'X-Forwarded-For': `1.2.3.${i}`,
          'Cf-Connecting-Ip': `10.0.0.${i}`
        },
        body: { pin: '0000' }
      });
      assert.equal(response.statusCode, 403);
    }
    const identifier = crypto.createHash('sha256').update(`${testClass.id}\0${directPublicIp}`).digest('hex');
    const ipBucket = dbManager.prepare(`
      SELECT failed_count FROM student_claim_rate_limits WHERE scope = 'class_pin_ip' AND identifier = ?
    `).get(identifier);
    assert.equal(ipBucket.failed_count, 4, 'all failures share the direct socket-IP bucket despite changing forged headers');
  });

  await t.test("35. Authoritative Server Timer, Expiration Enforcement & Teacher Extra Time", async () => {
    // 1. Create a timed assessment with 10 minutes duration
    const timedAsm = service.assessments.createAssessment({
      title: "Verifica a Tempo — 10 Minuti",
      durationMinutes: 10,
      classId: testClass.id,
      maxScore: 30
    });
    service.assessments.setAssessmentStatus(timedAsm.id, "active");
    const item1 = service.assessments.addItem(timedAsm.id, {
      type: "open_short",
      questionText: "Domanda a tempo",
      maxScore: 10,
      assessableSourceId: studentMaterial.id,
      assessableSourceVersion: 1
    });
    // 2. Start through the current public class PIN and declared roster identity flow.
    const startRes = await startClassAttemptRequest(timedAsm.id, student1.id, {
      seatRow: 'Fila 1', seatDesk: 'Banco 1'
    });
    assert.equal(startRes.statusCode, 201);
    const sToken = startRes.body.session.token;
    const startTimer = startRes.body.submission.timer;
    assert.ok(startTimer);
    assert.equal(startTimer.duration_minutes, 10);
    assert.equal(startTimer.extra_time_minutes, 0);
    assert.ok(startTimer.started_at);
    assert.ok(startTimer.expires_at);
    assert.ok(startTimer.time_remaining_seconds > 580);
    assert.equal(startTimer.is_time_expired, false);

    // 4. Student queries submission endpoint and verifies timer matches
    const subRes = await executeVirtualRequest({
      method: "GET",
      url: `/api/student/activities/${timedAsm.id}/submission`,
      headers: { "X-Student-Token": sToken }
    });
    assert.equal(subRes.statusCode, 200);
    assert.ok(subRes.body.submission.timer);
    assert.equal(subRes.body.submission.timer.duration_minutes, 10);

    // 5. Teacher grants 5 minutes extra time
    const extraTimeRes = await executeVirtualRequest({
      method: "POST",
      url: `/api/assessments/${timedAsm.id}/submissions/${student1.id}/extra-time`,
      headers: { "Cf-Access-Jwt-Assertion": teacherToken },
      body: {
        extraMinutes: 5,
        reason: 'Richiesta sintetica di supporto tecnico',
        idempotencyKey: 'student-api-extra-time-0001'
      }
    });
    assert.equal(extraTimeRes.statusCode, 200);
    assert.equal(extraTimeRes.body.submission.extra_time_minutes, 5);
    assert.ok(extraTimeRes.body.submission.timer.time_remaining_seconds > 850);

    // 6. Simulate timer expiration by moving started_at back in the database
    const pastStartedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 mins ago (allowed was 10+5=15m)
    service.dbManager.prepare(`
      UPDATE assessment_submissions
      SET started_at = ?
      WHERE assessment_id = ? AND student_id = ?
    `).run(pastStartedAt, timedAsm.id, student1.id);

    // 7. Autosave after grace period is rejected with 409 Conflict and attempt is auto-sealed
    const expiredAutosaveRes = await executeVirtualRequest({
      method: "POST",
      url: `/api/student/activities/${timedAsm.id}/autosave`,
      headers: { "X-Student-Token": sToken },
      body: {
        revision: 2,
        responses: [{ itemId: item1.id, responseText: "Risposta tardiva" }]
      }
    });
    assert.equal(expiredAutosaveRes.statusCode, 409);
    assert.match(expiredAutosaveRes.body.message, /Tempo a disposizione per la verifica scaduto/);

    // Check DB: attempt status is now 'submitted' (sealed)
    const sealedSub = service.assessments.getStudentSubmission(timedAsm.id, student1.id, { role: "teacher" });
    assert.equal(sealedSub.attempt_status, "submitted");
    assert.equal(sealedSub.status, "submitted");

    // Expiration must also prevent a delayed attachment upload from reaching FileStore.
    // Use a separate student/attempt so the preceding autosave-expiry assertion cannot
    // pre-seal this upload scenario.
    const uploadAssessment = service.assessments.createAssessment({
      title: "Verifica a tempo con allegato",
      durationMinutes: 10,
      classId: testClass.id,
      maxScore: 10,
      items: [{
        type: "attachment",
        questionText: "Allega un file SQL",
        maxScore: 10,
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1
      }]
    });
    service.assessments.setAssessmentStatus(uploadAssessment.id, "active");
    const uploadItem = uploadAssessment.items[0];
    const uploadStart = await startClassAttemptRequest(uploadAssessment.id, student2.id);
    assert.equal(uploadStart.statusCode, 201);
    const uploadToken = uploadStart.body.session.token;
    service.dbManager.prepare(`
      UPDATE assessment_submissions SET started_at = ?
      WHERE assessment_id = ? AND student_id = ?
    `).run(pastStartedAt, uploadAssessment.id, student2.id);

    const boundary = "----ExpiredUploadBoundary";
    const uploadBuffer = Buffer.from("SELECT 'late' AS attempt;\n");
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="assessmentId"\r\n\r\n${uploadAssessment.id}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="itemId"\r\n\r\n${uploadItem.id}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="late.sql"\r\nContent-Type: text/plain\r\n\r\n`),
      uploadBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const attachmentCountBefore = service.dbManager.prepare(
      "SELECT COUNT(*) AS count FROM student_attachments WHERE assessment_id = ?"
    ).get(uploadAssessment.id).count;
    const expiredUpload = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/upload",
      headers: { "X-Student-Token": uploadToken, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: multipartBody
    });
    assert.equal(expiredUpload.statusCode, 409);
    assert.match(expiredUpload.body.message, /Tempo a disposizione per la verifica scaduto/);
    assert.equal(service.dbManager.prepare(
      "SELECT COUNT(*) AS count FROM student_attachments WHERE assessment_id = ?"
    ).get(uploadAssessment.id).count, attachmentCountBefore, "expired uploads must not create attachment records");
  });

  await t.test("36. Attachment Preview API Security: opaque IDs, ownership, and submitted immutability", async () => {
    const uploadStud = service.addStudent({ classId: testClass.id, firstName: "Paolo", lastName: "Verdi", email: "p.verdi@scuola.example" });
    const otherStud = service.addStudent({ classId: testClass.id, firstName: "Sara", lastName: "Neri", email: "s.neri@scuola.example" });
    const uploadAssessment = service.createAssessment({
      title: "Verifica allegati e anteprima",
      classId: testClass.id, subjectId: testSubject.id, status: "active", durationMinutes: 45,
      items: [{ type: "attachment", questionText: "Allega un'immagine del diagramma", maxScore: 10, assessableSourceId: studentMaterial.id, assessableSourceVersion: 1 }]
    });
    const issueSession = async student => {
      const started = await startClassAttemptRequest(uploadAssessment.id, student.id);
      assert.equal(started.statusCode, 201);
      return started.body.session.token;
    };
    const uploadToken = await issueSession(uploadStud);
    const otherToken = await issueSession(otherStud);
    const boundary = "----PreviewBoundary456";
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
    const itemId = uploadAssessment.items[0].id;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="assessmentId"\r\n\r\n${uploadAssessment.id}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="itemId"\r\n\r\n${itemId}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="schema.png"\r\nContent-Type: image/png\r\n\r\n`),
      pngBuffer, Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const upload = await executeVirtualRequest({
      method: "POST", url: "/api/student/upload",
      headers: { "X-Student-Token": uploadToken, "Content-Type": `multipart/form-data; boundary=${boundary}` }, body
    });
    assert.equal(upload.statusCode, 201);
    const attachmentId = upload.body.attachmentId;
    assert.ok(attachmentId);

    const preview = await executeVirtualRequest({
      method: "GET", url: `/api/student/attachment?assessmentId=${uploadAssessment.id}&attachmentId=${attachmentId}`,
      headers: { "X-Student-Token": uploadToken }
    });
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.headers["content-type"], "image/png");
    assert.equal(preview.headers["x-content-type-options"], "nosniff");
    assert.ok(preview.headers["content-security-policy"]);

    const crossStudent = await executeVirtualRequest({
      method: "GET", url: `/api/student/attachment?assessmentId=${uploadAssessment.id}&attachmentId=${attachmentId}`,
      headers: { "X-Student-Token": otherToken }
    });
    assert.equal(crossStudent.statusCode, 404);
    const traversal = await executeVirtualRequest({
      method: "GET", url: `/api/student/attachment?assessmentId=${uploadAssessment.id}&attachmentId=../../package.json`,
      headers: { "X-Student-Token": uploadToken }
    });
    assert.equal(traversal.statusCode, 404);
    const unauth = await executeVirtualRequest({ method: "GET", url: `/api/student/attachment?assessmentId=${uploadAssessment.id}&attachmentId=${attachmentId}` });
    assert.ok([401, 403].includes(unauth.statusCode));

    const submitted = await executeVirtualRequest({
      method: "POST", url: `/api/student/activities/${uploadAssessment.id}/submit`,
      headers: { "X-Student-Token": uploadToken }, body: { revision: 2, responses: [{ itemId, responseText: "", attachmentId }] }
    });
    assert.equal(submitted.statusCode, 200);
    const lateUpload = await executeVirtualRequest({
      method: "POST", url: "/api/student/upload",
      headers: { "X-Student-Token": uploadToken, "Content-Type": `multipart/form-data; boundary=${boundary}` }, body
    });
    assert.equal(lateUpload.statusCode, 409);
  });
});
