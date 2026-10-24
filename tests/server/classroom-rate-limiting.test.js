import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { createHttpApp } from "../../src/server/http.js";
import { DatabaseManager } from "../../src/db/database.js";
import { FileStore } from "../../src/storage/filestore.js";
import { TeacherService } from "../../src/services/teacher-service.js";
import { ClaimRateLimiter } from "../../src/server/claim-rate-limiter.js";

test("Classroom-compatible claim code rate limiting suite", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "classroom-rate-limit-"));
  const dbPath = path.join(tmpDir, "teacher.sqlite");
  const dbManager = new DatabaseManager(dbPath).init();
  const fileStore = new FileStore(path.join(tmpDir, "files"));
  const service = new TeacherService({ dbManager, fileStore, mockAi: true });

  const testClass = service.createClass({ name: "5A Informatica", academicYear: "2026/2027" });
  const testSubject = service.createSubject({ classId: testClass.id, name: "Telecomunicazioni" });
  const studentMaterial = service.createMaterial({
    title: "Dispensa NAT",
    contentText: "Approfondimento sul NAT e condivisione IP.",
    pedagogicalRole: "student_material"
  });
  service.publishMaterial(studentMaterial.id, { versionNumber: 1 });

  const assessment = service.createAssessment({
    title: "Verifica Reti",
    classId: testClass.id,
    subjectId: testSubject.id,
    status: "active",
    items: [
      {
        type: "multiple_choice",
        questionText: "Cosa fa il NAT?",
        options: ["Traduzione indirizzi", "Instradamento dinamico"],
        maxScore: 10,
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1
      }
    ]
  });
  // Create 30 students
  const students = [];
  for (let i = 1; i <= 30; i++) {
    const student = service.addStudent({
      classId: testClass.id,
      firstName: `Studente${i}`,
      lastName: `Cognome${i}`
    });
    students.push(student);
  }
  const creds = service.generateActivityCredentials(assessment.id);
  const validCodes = creds.map(c => c.accessCode);

  const rateLimiter = new ClaimRateLimiter(dbManager, {
    ipMaxFails: 60,
    ipBurstMaxFails: 35,
    deviceMaxFails: 5,
    codeMaxFails: 5,
    windowMs: 5 * 60 * 1000,
    blockMs: 5 * 60 * 1000,
    burstWindowMs: 10 * 1000
  });

  const app = await createHttpApp({
    service,
    claimRateLimiter: rateLimiter,
    trustedProxyCidrs: ["10.0.0.1/32"]
  });

  async function executeClaim({
    ip = "198.51.100.25",
    accessCode,
    deviceId = null,
    headers = {}
  }) {
    const socket = new EventEmitter();
    socket.setTimeout = () => {};
    socket.remoteAddress = ip;
    const req = new http.IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/student/claim-code";
    const reqHeaders = {
      host: "localhost:8770",
      origin: "http://localhost:8770",
      "content-type": "application/json",
      ...headers
    };
    if (deviceId) {
      reqHeaders["x-student-device-id"] = deviceId;
    }
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
      const hdrs = typeof args[0] === "object" ? args[0] : (args[1] || {});
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

    const bodyObj = { accessCode, ...(deviceId ? { deviceId } : {}) };
    process.nextTick(() => {
      req.emit("data", Buffer.from(JSON.stringify(bodyObj), "utf-8"));
      req.emit("end");
    });

    await app.handleHttpRequest(req, res);

    return finishedPromise.then(() => {
      const rawBody = Buffer.concat(outChunks).toString("utf-8");
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
    service.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("1. 30 students under same NAT can make typos without blocking the classroom", async () => {
    const natIp = "198.51.100.25";
    // Each of the 30 students makes 1 typo
    for (let i = 0; i < 30; i++) {
      const devId = `device-student-${i + 1}`;
      const typoRes = await executeClaim({
        ip: natIp,
        deviceId: devId,
        accessCode: "WRONG-TYPO-" + i
      });
      assert.equal(typoRes.statusCode, 403, "Typo should fail with 400 Bad Request, not 429");
    }

    // Now all 30 students enter their correct code
    for (let i = 0; i < 30; i++) {
      const devId = `device-student-${i + 1}`;
      const okRes = await executeClaim({
        ip: natIp,
        deviceId: devId,
        accessCode: validCodes[i]
      });
      assert.equal(okRes.statusCode, 200, `Student ${i + 1} must succeed with 200 OK`);
      assert.ok(okRes.body.session?.token, "Must return session token");
    }
  });

  await t.test("2. Automated brute-force with rotating codes is blocked by burst limit", async () => {
    const botIp = "198.51.100.50";
    let blockedAt = null;

    // Send 26 requests with distinct codes rapidly
    for (let i = 1; i <= 36; i++) {
      const res = await executeClaim({
        ip: botIp,
        deviceId: `bot-dev-${i}`,
        accessCode: `RANDOM-CODE-${i}-${Date.now()}`
      });
      if (res.statusCode === 429) {
        blockedAt = i;
        assert.ok(res.headers["retry-after"], "429 must include Retry-After header");
        assert.match(res.body.message, /rapida successione|Troppi tentativi/);
        break;
      }
    }
    assert.equal(blockedAt, 36, "36th attempt in rapid succession must be blocked with 429");
  });

  await t.test("3. Targeted brute force against a single code is blocked after 5 attempts", async () => {
    const attackerIp = "198.51.100.77";
    const targetCode = validCodes[0];

    for (let i = 1; i <= 5; i++) {
      const res = await executeClaim({
        ip: attackerIp,
        deviceId: `attacker-${i}`,
        accessCode: targetCode + "-X" // wrong code variant
      });
      assert.equal(res.statusCode, 403);
    }

    // 6th attempt on the same code variant
    const blockedRes = await executeClaim({
      ip: attackerIp,
      deviceId: "attacker-6",
      accessCode: targetCode + "-X"
    });
    assert.equal(blockedRes.statusCode, 429);
    assert.match(blockedRes.body.message, /questo codice/);
  });

  await t.test("4. Single student making 5 typos is blocked on their device, but peers on same NAT are not", async () => {
    const classroomIp = "198.51.100.88";
    const unluckyStudentDev = "dev-unlucky-student";
    const peerStudentDev = "dev-good-peer";

    for (let i = 1; i <= 5; i++) {
      const res = await executeClaim({
        ip: classroomIp,
        deviceId: unluckyStudentDev,
        accessCode: `MISTAKE-${i}`
      });
      assert.equal(res.statusCode, 403);
    }

    // 6th attempt by unlucky student
    const blockedRes = await executeClaim({
      ip: classroomIp,
      deviceId: unluckyStudentDev,
      accessCode: validCodes[1]
    });
    assert.equal(blockedRes.statusCode, 429);
    assert.match(blockedRes.body.message, /questo dispositivo/);

    // Issue a fresh student credential for this test
    const freshStudent = service.addStudent({ classId: testClass.id, firstName: "FreshPeer", lastName: "FreshLastName" });
    const freshCred = service.generateActivityCredentials(assessment.id).find(c => c.studentId === freshStudent.id);
    const peerRes = await executeClaim({
      ip: classroomIp,
      deviceId: peerStudentDev,
      accessCode: freshCred.accessCode
    });
    assert.equal(peerRes.statusCode, 200, "Peer student on same NAT must succeed unhindered");
  });

  await t.test("5. Anti-spoofing: Untrusted peers cannot forge CF-Connecting-IP or X-Forwarded-For", async () => {
    const untrustedSocketIp = "198.51.100.99";
    const spoofedIp = "8.8.8.8";

    // Untrusted client sends spoofed headers
    for (let i = 1; i <= 5; i++) {
      const res = await executeClaim({
        ip: untrustedSocketIp,
        deviceId: `spoof-dev-${i}`,
        accessCode: `SPOOF-CODE-${i}`,
        headers: {
          "cf-connecting-ip": spoofedIp,
          "x-forwarded-for": spoofedIp
        }
      });
      assert.equal(res.statusCode, 403);
    }

    // Verify rate limit table recorded untrustedSocketIp, NOT spoofedIp
    const row = dbManager.prepare(
      "SELECT identifier FROM student_claim_rate_limits WHERE scope = 'ip' AND identifier = ?"
    ).get(untrustedSocketIp);
    assert.ok(row, "Rate limiter must attribute failures to actual TCP socket IP, not spoofed header");

    const spoofRow = dbManager.prepare(
      "SELECT identifier FROM student_claim_rate_limits WHERE scope = 'ip' AND identifier = ?"
    ).get(spoofedIp);
    assert.equal(spoofRow, undefined, "Spoofed IP must not exist in rate limit table");
  });

  await t.test("6. Rate limiting survives process restart via SQLite persistence", async () => {
    const testIp = "198.51.100.120";
    const devId = "restart-test-device";

    // 5 failures
    for (let i = 1; i <= 5; i++) {
      rateLimiter.recordFailure({ ip: testIp, deviceId: devId, code: "CODE-RESTART" });
    }

    // Simulate process restart by creating a new limiter instance on the same SQLite database
    const freshLimiter = new ClaimRateLimiter(dbManager, {
      deviceMaxFails: 5,
      ipMaxFails: 60
    });

    const check = freshLimiter.checkLimit({ ip: testIp, deviceId: devId, code: "CODE-RESTART" });
    assert.equal(check?.blocked, true, "New limiter instance must immediately enforce limits from SQLite");
  });
});
