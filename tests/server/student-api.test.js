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
    mockAi: true
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

  t.after(async () => {
    await app.close();
    clearJwksCache(); setTestAuthKeys(null);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

    let student1Token = null;
  let student1Cred = null;
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

  await t.test('2. Student can list students in class with privacy protection', async () => {
    const res = await executeVirtualRequest({
      method: 'GET',
      url: `/api/student/classes/${testClass.id}/students`
    });
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.students));
    assert.equal(res.body.students.length, 2);
    // Student list preserves first name but masks last name with initial, no email/notes exposed
    assert.equal(res.body.students[0].firstName, 'Laura');
    assert.equal(res.body.students[1].firstName, 'Marco');
    assert.equal(res.body.students[0].email, undefined);
  });

  await t.test('3. Student can list active activities for class', async () => {
    const res = await executeVirtualRequest({
      method: 'GET',
      url: `/api/student/classes/${testClass.id}/activities`
    });
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.activities));
    assert.equal(res.body.activities.length, 1);
    assert.equal(res.body.activities[0].title, 'Verifica Reti TCP/IP');
    assert.equal(res.body.activities[0].activityType, 'test');
  });

  await t.test('4. Student can claim access code and receive session token', async () => {
    const creds = service.listActivityCredentials(testAssessment.id);
    assert.ok(creds.length >= 2);
    student1Cred = creds.find(c => c.studentId === student1.id);
    assert.ok(student1Cred);
    assert.ok(student1Cred.accessCode);

    const claimRes = await executeVirtualRequest({
      method: 'POST',
      url: '/api/student/claim-code',
      headers: { 'Content-Type': 'application/json' },
      body: { accessCode: student1Cred.accessCode }
    });
    assert.equal(claimRes.statusCode, 200);
    assert.ok(claimRes.body.session);
    assert.ok(claimRes.body.session.token);
    assert.equal(claimRes.body.session.studentId, student1.id);
    assert.equal(claimRes.body.session.studentName, 'Marco Rossi');
    student1Token = claimRes.body.session.token;
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

    // Verify teacher solutions and rubrics are masked/null
    for (const item of res.body.activity.items) {
      assert.equal(item.teacher_solution, null, 'Teacher solution must be strictly null for student');
      assert.equal(item.rubric, null, 'Rubric must be strictly null for student');
    }
  });

  await t.test('6. Student can start attempt with Seat Map declaration', async () => {
    const res = await executeVirtualRequest({
      method: 'POST',
      url: `/api/student/activities/${testAssessment.id}/start`,
      headers: {
        'Content-Type': 'application/json',
        'X-Student-Token': student1Token
      },
      body: {
        seatRow: 'Fila 1',
        seatDesk: 'Banco 2',
        leftNeighborId: null,
        leftNeighborName: 'Nessuno',
        rightNeighborId: student2.id,
        rightNeighborName: 'Laura Bianchi',
        revision: 1,
        responses: []
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'started');
    assert.equal(res.body.submission.seat_row, 'Fila 1');
    assert.equal(res.body.submission.seat_desk, 'Banco 2');
    assert.equal(res.body.submission.left_neighbor_name, 'Nessuno');
    assert.equal(res.body.submission.right_neighbor_id, student2.id);
    testSubmissionId = res.body.submission.id;
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

  await t.test("13. Impersonation prevention: Student cannot read or overwrite another student submission", async () => {
    const creds = service.listActivityCredentials(testAssessment.id);
    const student2Cred = creds.find(c => c.studentId === student2.id);
    assert.ok(student2Cred);

    // Student 2 claims access code
    const claim2 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: student2Cred.accessCode }
    });
    assert.equal(claim2.statusCode, 200);
    student2Token = claim2.body.session.token;

    // Student 2 retrieves draft: must be null, cannot read Student 1 submission
    const draft2 = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + testAssessment.id + "/submission",
      headers: { "X-Student-Token": student2Token }
    });
    assert.equal(draft2.statusCode, 200);
    assert.equal(draft2.body.submission, null);

    // Student 2 attempts to spoof Student 1 studentId in autosave payload
    const spoofAutosave = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student2Token
      },
      body: {
        revision: 1,
        studentId: student1.id,
        studentName: "Marco Rossi",
        responses: [{ itemId: testAssessment.items[0].id, responseText: "HACKED_BY_STUDENT_2" }]
      }
    });
    assert.equal(spoofAutosave.statusCode, 200);

    // Verify Student 1 actual submission was untouched
    const sub1 = service.getStudentSubmission(testAssessment.id, student1.id);
    assert.ok(sub1);
    const sub1Item0 = sub1.responses.find(r => r.item_id === testAssessment.items[0].id);
    assert.notEqual(sub1Item0?.response_text, "HACKED_BY_STUDENT_2");
    assert.equal(sub1Item0?.response_text, "Trasporto (aggiornato dopo riapertura)");

    // Verify Student 2 submission was saved under Student 2 own student_id
    const sub2 = service.getStudentSubmission(testAssessment.id, student2.id);
    assert.ok(sub2);
    assert.equal(sub2.student_id, student2.id);
    const sub2Item0 = sub2.responses.find(r => r.item_id === testAssessment.items[0].id);
    assert.equal(sub2Item0?.response_text, "HACKED_BY_STUDENT_2");
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
      url: "/api/student/classes/" + testClass.id + "/activities"
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

  await t.test("16. Security: Revoked and expired credentials fail closed with AuthorizationError", async () => {
    // Generate new credential for test
    const creds = service.listActivityCredentials(testAssessment.id);
    const testCred = creds[0];

    // Revoked credential
    dbManager.prepare("UPDATE student_activity_credentials SET status = 'revoked' WHERE id = ?").run(testCred.id);

    const claimRevoked = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: testCred.accessCode }
    });
    assert.equal(claimRevoked.statusCode, 403);
    assert.equal(claimRevoked.body.error, "AuthorizationError");

    // Expired credential
    dbManager.prepare("UPDATE student_activity_credentials SET status = 'active', expires_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(testCred.id);

    const claimExpired = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: testCred.accessCode }
    });
    assert.equal(claimExpired.statusCode, 403);
    assert.equal(claimExpired.body.error, "AuthorizationError");

    // Restore credential status
    dbManager.prepare("UPDATE student_activity_credentials SET status = 'active', expires_at = '2030-01-01T00:00:00.000Z' WHERE id = ?").run(testCred.id);
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
    const credential = service.listActivityCredentials(attachmentAssessment.id).find(c => c.studentId === student2.id);
    assert.ok(credential);
    const claimRes = await executeVirtualRequest({
      method: "POST", url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" }, body: { accessCode: credential.accessCode }
    });
    assert.equal(claimRes.statusCode, 200);
    const token = claimRes.body.session.token;
    const startRes = await executeVirtualRequest({
      method: "POST", url: `/api/student/activities/${attachmentAssessment.id}/start`,
      headers: { "Content-Type": "application/json", "X-Student-Token": token },
      body: { revision: 1, responses: [] }
    });
    assert.equal(startRes.statusCode, 200);

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
        revision: 2,
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
        revision: 3,
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
        revision: 4,
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
        revision: 3,
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

  await t.test("23. Disconnection & Session Invalidation Resilience: Revoked credential fails closed", async () => {
    // Create new student and credential for disconnection test
    student3 = service.addStudent({
      classId: testClass.id,
      firstName: "Giulia",
      lastName: "Verdi",
      email: "g.verdi@scuola.example"
    });
    const creds = service.generateActivityCredentials(testAssessment.id);
    const s3Cred = creds.find(c => c.studentId === student3.id);
    assert.ok(s3Cred);

    // Student 3 claims access code to establish session
    const claim3 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: s3Cred.accessCode }
    });
    assert.equal(claim3.statusCode, 200);
    student3Token = claim3.body.session.token;
    assert.ok(student3Token);

    // Student 3 starts activity
    const startRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/start",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student3Token
      },
      body: {
        seatRow: "Fila 3",
        seatDesk: "Banco 1",
        revision: 1,
        responses: []
      }
    });
    assert.equal(startRes.statusCode, 200);

    // Teacher revokes student credential (e.g. disciplinary or session disconnection)
    service.revokeActivityCredential(s3Cred.id);

    // Subsequent autosave attempt fails closed with 403
    const autosaveRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student3Token
      },
      body: {
        revision: 2,
        responses: [{ itemId: testAssessment.items[0].id, responseText: "Tentativo post revoca" }]
      }
    });
    assert.equal(autosaveRes.statusCode, 403);
    assert.equal(autosaveRes.body.error, "AuthorizationError");

    // Final submit attempt also fails closed with 403
    const submitRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/submit",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": student3Token
      },
      body: { revision: 2 }
    });
    assert.equal(submitRes.statusCode, 403);
  });

  await t.test("24. Duplicate & Rapid Concurrent Requests Handling", async () => {
    // Recover the revoked credential without modifying the in-progress submission.
    let s3Cred = service.listActivityCredentials(testAssessment.id).find(c => c.studentId === student3.id);
    const renewed = service.reissueActivityCredential(s3Cred.id, { reason: "Ripresa del test concorrente" });
    s3Cred = service.listActivityCredentials(testAssessment.id).find(c => c.studentId === student3.id);
    const renewedClaim = await executeVirtualRequest({
      method: "POST", url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" }, body: { accessCode: renewed.accessCode }
    });
    assert.equal(renewedClaim.statusCode, 200);
    student3Token = renewedClaim.body.session.token;

    // Concurrent autosaves in flight: two requests with duplicate revision 2
    // Exactly one must succeed (200) and the duplicate must be rejected (409 Conflict)
    const [resA, resB] = await Promise.all([
      executeVirtualRequest({
        method: "POST",
        url: "/api/student/activities/" + testAssessment.id + "/autosave",
        headers: { "Content-Type": "application/json", "X-Student-Token": student3Token },
        body: { revision: 2, responses: [{ itemId: testAssessment.items[0].id, responseText: "Test concorrente A" }] }
      }),
      executeVirtualRequest({
        method: "POST",
        url: "/api/student/activities/" + testAssessment.id + "/autosave",
        headers: { "Content-Type": "application/json", "X-Student-Token": student3Token },
        body: { revision: 2, responses: [{ itemId: testAssessment.items[0].id, responseText: "Test concorrente B" }] }
      })
    ]);
    const statuses = [resA.statusCode, resB.statusCode].sort();
    assert.deepEqual(statuses, [200, 409]);

    // Duplicate submit calls: first succeeds with revision 3, second returns 409 Conflict
    const submit1 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/submit",
      headers: { "Content-Type": "application/json", "X-Student-Token": student3Token },
      body: { revision: 3 }
    });
    assert.equal(submit1.statusCode, 200);

    const submit2 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/submit",
      headers: { "Content-Type": "application/json", "X-Student-Token": student3Token },
      body: { revision: 3 }
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
    const freshCreds = service.generateActivityCredentials(freshAsm.id);
    const s1Cred = freshCreds.find(c => c.studentId === student1.id);
    const claimRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: s1Cred.accessCode }
    });
    assert.equal(claimRes.statusCode, 200);
    const freshStudentToken = claimRes.body.session.token;

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

    // Student view strips teacher solution
    const studentView = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + freshAsm.id,
      headers: { "X-Student-Token": freshStudentToken }
    });
    assert.equal(studentView.statusCode, 200);
    const addedItemStudent = studentView.body.activity.items.find(i => i.id === newItemId);
    assert.equal(addedItemStudent.teacher_solution, null);

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

    // Teacher deletes the item
    const deleteItemRes = await executeVirtualRequest({
      method: "DELETE",
      url: "/api/assessments/" + freshAsm.id + "/items/" + newItemId,
      headers: { "Cf-Access-Jwt-Assertion": teacherToken }
    });
    assert.equal(deleteItemRes.statusCode, 200);
    assert.equal(deleteItemRes.body.success, true);
  });

  await t.test("26. Brute-force Defense: 5 failed claim attempts from a browser device block with 429", async () => {
    const fakeIp = "198.51.100.42";
    let browserCookie = null;
    for (let i = 0; i < 5; i++) {
      const failRes = await executeVirtualRequest({
        method: "POST",
        url: "/api/student/claim-code",
        remoteAddress: fakeIp,
        headers: {
          "Content-Type": "application/json",
          // Direct peer is authoritative; this client-controlled header is ignored.
          "X-Forwarded-For": "192.0.2.77",
          ...(browserCookie ? { Cookie: browserCookie } : {})
        },
        body: { accessCode: "WRONG" + i }
      });
      assert.equal(failRes.statusCode, 403);
      if (failRes.headers["set-cookie"]) {
        browserCookie = failRes.headers["set-cookie"].split(";")[0];
      }
    }

    // 6th attempt is blocked immediately with 429 TooManyRequests
    const blockedRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      remoteAddress: fakeIp,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "192.0.2.77",
        ...(browserCookie ? { Cookie: browserCookie } : {})
      },
      body: { accessCode: "WRONG6" }
    });
    assert.equal(blockedRes.statusCode, 429);
    assert.equal(blockedRes.body.error, "TooManyRequests");
  });

  await t.test("27. Single-Use Access Code: Second claim attempt of same code is rejected", async () => {
    // Generate new credentials for testAssessment
    const creds = service.generateActivityCredentials(testAssessment.id, { forceRegenerate: true });
    const student1Fresh = creds.find(c => c.studentId === student1.id);
    assert.ok(student1Fresh);

    // 1st claim succeeds
    const claimFirst = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: student1Fresh.accessCode }
    });
    assert.equal(claimFirst.statusCode, 200);
    assert.ok(claimFirst.body.session.token);

    // 2nd claim of the exact same code by another subject fails with 403 AuthorizationError
    const claimSecond = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: student1Fresh.accessCode }
    });
    assert.equal(claimSecond.statusCode, 403);
    assert.match(claimSecond.body.message, /già stato utilizzato/);
  });

  await t.test("28. State 'ready': Question items are hidden until teacher activates", async () => {
    const readyAsm = service.createAssessment({
      title: "Verifica Pronta Ma Non Attiva",
      classId: testClass.id,
      subjectId: testSubject.id,
      status: "ready",
      items: [
        {
          type: "open_short",
          questionText: "Domanda riservata che deve restare nascosta",
          maxScore: 10,
          assessableSourceId: studentMaterial.id,
          assessableSourceVersion: 1,
          teacherSolution: "Soluzione segreta"
        }
      ]
    });

    const readyCreds = service.listActivityCredentials(readyAsm.id);
    const s1ReadyCred = readyCreds.find(c => c.studentId === student1.id);
    assert.ok(s1ReadyCred);

    const claimRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: s1ReadyCred.accessCode }
    });
    assert.equal(claimRes.statusCode, 200);
    const readyToken = claimRes.body.session.token;

    // Student GET activity in 'ready' state: items MUST be empty array
    const studentView = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + readyAsm.id,
      headers: { "X-Student-Token": readyToken }
    });
    assert.equal(studentView.statusCode, 200);
    assert.equal(studentView.body.activity.status, "ready");
    assert.equal(studentView.body.activity.items.length, 0, "Items must be empty in ready state");
    assert.ok(studentView.body.activity.message);

    // Attempting to start attempt in ready state is rejected
    const startRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + readyAsm.id + "/start",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Token": readyToken
      },
      body: { seatRow: "Fila 1", revision: 1, responses: [] }
    });
    assert.equal(startRes.statusCode, 403);

    // Teacher transitions to 'active'
    service.setAssessmentStatus(readyAsm.id, "active");

    // Now student can view questions (with solution stripped)
    const activeStudentView = await executeVirtualRequest({
      method: "GET",
      url: "/api/student/activities/" + readyAsm.id,
      headers: { "X-Student-Token": readyToken }
    });
    assert.equal(activeStudentView.statusCode, 200);
    assert.equal(activeStudentView.body.activity.items.length, 1);
    assert.equal(activeStudentView.body.activity.items[0].question_text, "Domanda riservata che deve restare nascosta");
    assert.equal(activeStudentView.body.activity.items[0].teacher_solution, null);
  });

  await t.test("29. Monotonic Autosave: Out-of-order or stale revisions rejected with 409 Conflict", async () => {
    // Dedicated student for monotonic revision tests
    const studentMono = service.addStudent({
      classId: testClass.id,
      firstName: "Claudio",
      lastName: "Neri",
      email: "c.neri@scuola.example"
    });
    const creds = service.generateActivityCredentials(testAssessment.id);
    const s2Cred = creds.find(c => c.studentId === studentMono.id);
    const claimRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: s2Cred.accessCode }
    });
    assert.equal(claimRes.statusCode, 200);
    const token = claimRes.body.session.token;

    // Start with revision 1
    const save1 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: { "Content-Type": "application/json", "X-Student-Token": token },
      body: { revision: 1, responses: [{ itemId: testAssessment.items[0].id, responseText: "Rev 1 text" }] }
    });
    assert.equal(save1.statusCode, 200);
    assert.equal(save1.body.revision, 1);

    // Forward to revision 5
    const save5 = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: { "Content-Type": "application/json", "X-Student-Token": token },
      body: { revision: 5, responses: [{ itemId: testAssessment.items[0].id, responseText: "Rev 5 text" }] }
    });
    assert.equal(save5.statusCode, 200);
    assert.equal(save5.body.revision, 5);

    // Delayed revision 3 arrives after revision 5: must be rejected with 409 Conflict
    const staleSave = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: { "Content-Type": "application/json", "X-Student-Token": token },
      body: { revision: 3, responses: [{ itemId: testAssessment.items[0].id, responseText: "Stale Rev 3 text" }] }
    });
    assert.equal(staleSave.statusCode, 409);
    assert.equal(staleSave.body.error, "ConflictError");

    // Same revision 5 arriving again: also 409
    const dupSave = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/activities/" + testAssessment.id + "/autosave",
      headers: { "Content-Type": "application/json", "X-Student-Token": token },
      body: { revision: 5, responses: [{ itemId: testAssessment.items[0].id, responseText: "Duplicate 5 text" }] }
    });
    assert.equal(dupSave.statusCode, 409);
  });

  await t.test("30. Teacher Reissue Procedure: Reissue replaces lost code without token leakage", async () => {
    const creds = service.listActivityCredentials(testAssessment.id);
    const targetCred = creds[0];
    assert.ok(targetCred);
    assert.equal(targetCred.token, undefined);

    const reissueRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/assessments/" + testAssessment.id + "/credentials/" + targetCred.id + "/reissue",
      headers: {
        "Content-Type": "application/json",
        "Cf-Access-Jwt-Assertion": teacherToken
      },
      body: { reason: "Studente ha cambiato postazione" }
    });
    assert.equal(reissueRes.statusCode, 200);
    assert.ok(reissueRes.body.accessCode);
    assert.notEqual(reissueRes.body.accessCode, targetCred.accessCode);
    assert.equal(reissueRes.body.status, "issued");
    assert.equal(reissueRes.body.token, undefined);
    assert.equal(reissueRes.body.token_hash, undefined);
  });

  await t.test("31. Concurrent Code Claiming: Two simultaneous claims yield exactly one valid session", async () => {
    // Generate new credentials for testAssessment
    const creds = service.generateActivityCredentials(testAssessment.id, { forceRegenerate: true });
    const targetStudent = creds[0];
    assert.ok(targetStudent);

    // Execute two concurrent claim requests with the identical code
    const [res1, res2] = await Promise.all([
      executeVirtualRequest({
        method: "POST",
        url: "/api/student/claim-code",
        headers: { "Content-Type": "application/json" },
        body: { accessCode: targetStudent.accessCode }
      }),
      executeVirtualRequest({
        method: "POST",
        url: "/api/student/claim-code",
        headers: { "Content-Type": "application/json" },
        body: { accessCode: targetStudent.accessCode }
      })
    ]);

    const statuses = [res1.statusCode, res2.statusCode].sort();
    assert.deepEqual(statuses, [200, 403], "Exactly one claim must succeed (200) and one must be rejected (403)");
    const successRes = res1.statusCode === 200 ? res1 : res2;
    const failRes = res1.statusCode === 403 ? res1 : res2;
    assert.ok(successRes.body.session?.token);
    assert.match(failRes.body.message, /già stato utilizzato/);
  });

  await t.test("32. Credential Reissue on Finalized Submission preserves submission integrity without response loss", async () => {
    // Submit attempt for target student
    const studentForReissue = service.addStudent({
      classId: testClass.id,
      firstName: "Davide",
      lastName: "Verdi",
      email: "d.verdi@scuola.example"
    });
    const creds = service.generateActivityCredentials(testAssessment.id);
    const targetCred = creds.find(c => c.studentId === studentForReissue.id);
    assert.ok(targetCred);

    const claimRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      headers: { "Content-Type": "application/json" },
      body: { accessCode: targetCred.accessCode }
    });
    assert.equal(claimRes.statusCode, 200);
    const token = claimRes.body.session.token;

    // Start and submit
    await executeVirtualRequest({
      method: "POST",
      url: `/api/student/activities/${testAssessment.id}/start`,
      headers: { "Content-Type": "application/json", "X-Student-Token": token },
      body: { revision: 1, responses: [] }
    });
    const subRes = await executeVirtualRequest({
      method: "POST",
      url: `/api/student/activities/${testAssessment.id}/submit`,
      headers: { "Content-Type": "application/json", "X-Student-Token": token },
      body: {
        revision: 2,
        responses: [{ itemId: testAssessment.items[0].id, responseText: "Risposta Davide definitiva" }]
      }
    });
    assert.equal(subRes.statusCode, 200);

    // Now teacher reissues credentials for this student
    const credRow = service.listActivityCredentials(testAssessment.id).find(c => c.studentId === studentForReissue.id);
    assert.ok(credRow);

    const reissueRes = await executeVirtualRequest({
      method: "POST",
      url: `/api/assessments/${testAssessment.id}/credentials/${credRow.id}/reissue`,
      headers: {
        "Content-Type": "application/json",
        "Cf-Access-Jwt-Assertion": teacherToken
      },
      body: { reason: "Recupero accesso studente" }
    });
    assert.equal(reissueRes.statusCode, 200);

    // Verify submission is still intact, submitted, and responses are unchanged
    const finalSub = service.getStudentSubmission(testAssessment.id, studentForReissue.id, { role: "teacher" });
    assert.equal(finalSub.status, "submitted");
    assert.equal(finalSub.responses.length, 1);
    assert.equal(finalSub.responses[0].response_text, "Risposta Davide definitiva");
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

    // 2. Add two distinct students and generate credentials
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

    const creds = service.generateActivityCredentials(multiAsm.id);
    const credA = creds.find(c => c.studentId === studA.id);
    const credB = creds.find(c => c.studentId === studB.id);
    assert.ok(credA && credB);

    // 3. Both students claim their respective credentials
    const [claimA, claimB] = await Promise.all([
      executeVirtualRequest({
        method: "POST",
        url: "/api/student/claim-code",
        headers: { "Content-Type": "application/json" },
        body: { accessCode: credA.accessCode }
      }),
      executeVirtualRequest({
        method: "POST",
        url: "/api/student/claim-code",
        headers: { "Content-Type": "application/json" },
        body: { accessCode: credB.accessCode }
      })
    ]);
    assert.equal(claimA.statusCode, 200);
    assert.equal(claimB.statusCode, 200);
    const tokenA = claimA.body.session.token;
    const tokenB = claimB.body.session.token;

    // 4. Both students start attempt with seat map
    await Promise.all([
      executeVirtualRequest({
        method: "POST",
        url: `/api/student/activities/${multiAsm.id}/start`,
        headers: { "Content-Type": "application/json", "X-Student-Token": tokenA },
        body: {
          seatRow: "Fila 2",
          seatDesk: "Banco 1",
          rightNeighborId: studB.id,
          rightNeighborName: "Federico Riva",
          responses: [],
          revision: 1
        }
      }),
      executeVirtualRequest({
        method: "POST",
        url: `/api/student/activities/${multiAsm.id}/start`,
        headers: { "Content-Type": "application/json", "X-Student-Token": tokenB },
        body: {
          seatRow: "Fila 2",
          seatDesk: "Banco 2",
          leftNeighborId: studA.id,
          leftNeighborName: "Elena Galli",
          responses: [],
          revision: 1
        }
      })
    ]);

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

  await t.test("34. IP Proxy & Header Anti-Spoofing: Direct public connections ignore client-forged IP headers", async () => {
    // Direct public IP attempting to rotate X-Forwarded-For and Cf-Connecting-Ip headers on every attempt
    const directPublicIp = "203.0.113.88";
    let clientCookie = null;

    for (let i = 0; i < 5; i++) {
      const res = await executeVirtualRequest({
        method: "POST",
        url: "/api/student/claim-code",
        remoteAddress: directPublicIp,
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": `1.2.3.${i}`,
          "Cf-Connecting-Ip": `10.0.0.${i}`,
          ...(clientCookie ? { Cookie: clientCookie } : {})
        },
        body: { accessCode: `WRONGSPOOF${i}` }
      });
      assert.equal(res.statusCode, 403);
      if (res.headers["set-cookie"]) {
        clientCookie = res.headers["set-cookie"].split(";")[0];
      }
    }

    // 6th attempt with yet another spoofed IP in header must be blocked with 429 TooManyRequests
    const blockedRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      remoteAddress: directPublicIp,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "8.8.8.8",
        "Cf-Connecting-Ip": "8.8.4.4",
        ...(clientCookie ? { Cookie: clientCookie } : {})
      },
      body: { accessCode: "WRONGSPOOF6" }
    });
    assert.equal(blockedRes.statusCode, 429);
    assert.equal(blockedRes.body.error, "TooManyRequests");
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
      maxScore: 10
    });
    // 2. Issue code to student
    const creds = service.assessments.generateActivityCredentials(timedAsm.id);
    const studentCred = creds.find(c => (c.studentId || c.student_id) === student1.id);
    assert.ok(studentCred);

    // 3. Student claims code and starts attempt
    const claimRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/student/claim-code",
      body: { accessCode: studentCred.accessCode || studentCred.access_code }
    });
    const sToken = claimRes.body.session?.token || claimRes.body.token;

    const startRes = await executeVirtualRequest({
      method: "POST",
      url: `/api/student/activities/${timedAsm.id}/start`,
      headers: { "X-Student-Token": sToken },
      body: {
        seatRow: "Fila 1",
        seatDesk: "Banco 1",
        revision: 1
      }
    });
    assert.equal(startRes.statusCode, 200);
    assert.ok(startRes.body.timer);
    assert.equal(startRes.body.timer.duration_minutes, 10);
    assert.equal(startRes.body.timer.extra_time_minutes, 0);
    assert.ok(startRes.body.timer.started_at);
    assert.ok(startRes.body.timer.expires_at);
    assert.ok(startRes.body.timer.time_remaining_seconds > 580);
    assert.equal(startRes.body.timer.is_time_expired, false);

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
    const uploadCredential = service.assessments.generateActivityCredentials(uploadAssessment.id)
      .find(c => (c.studentId || c.student_id) === student2.id);
    const uploadClaim = await executeVirtualRequest({
      method: "POST", url: "/api/student/claim-code",
      body: { accessCode: uploadCredential.accessCode || uploadCredential.access_code }
    });
    const uploadToken = uploadClaim.body.session?.token || uploadClaim.body.token;
    const uploadStart = await executeVirtualRequest({
      method: "POST", url: `/api/student/activities/${uploadAssessment.id}/start`,
      headers: { "X-Student-Token": uploadToken }, body: { revision: 1, responses: [] }
    });
    assert.equal(uploadStart.statusCode, 200);
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
      const credential = service.listActivityCredentials(uploadAssessment.id).find(c => c.studentId === student.id);
      const claim = await executeVirtualRequest({ method: "POST", url: "/api/student/claim-code", body: { accessCode: credential.accessCode } });
      assert.equal(claim.statusCode, 200);
      const token = claim.body.session.token;
      const started = await executeVirtualRequest({
        method: "POST", url: `/api/student/activities/${uploadAssessment.id}/start`,
        headers: { "X-Student-Token": token }, body: { revision: 1, responses: [] }
      });
      assert.equal(started.statusCode, 200);
      return token;
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
