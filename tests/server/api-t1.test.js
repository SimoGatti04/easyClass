import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { createHttpApp } from "../../src/server/http.js";
import { setTestAuthKeys, clearJwksCache } from "../../src/server/auth.js";
import { DatabaseManager } from "../../src/db/database.js";
import { FileStore } from "../../src/storage/filestore.js";
import { TeacherService } from "../../src/services/teacher-service.js";

test("Teacher Service — T1 REST API Suite", async (t) => {
  const tmpDir = path.resolve(process.cwd(), ".tmp", "test-api-t1-" + Date.now());
  const dbManager = new DatabaseManager(":memory:").init();
  const fileStore = new FileStore(tmpDir);
  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true
  });

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  const testKid = "t1-test-key-id";
  setTestAuthKeys({
    keys: new Map([[testKid, crypto.createPublicKey(publicKey)]])
  });

  const expectedAud = "test-teacher-web-aud";
  const teacherEmail = "docente@scuola.example";

  function createSignedJwt({
    sub = "teacher-1",
    email = teacherEmail,
    aud = expectedAud,
    exp = Math.floor(Date.now() / 1000) + 3600
  } = {}) {
    const header = { alg: "RS256", kid: testKid, typ: "JWT" };
    const payload = {
      iss: "https://simogatti.cloudflareaccess.com",
      sub,
      email,
      aud,
      exp,
      nbf: Math.floor(Date.now() / 1000) - 10
    };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${headerB64}.${payloadB64}`);
    const sigB64 = signer.sign(privateKey, "base64url");
    return `${headerB64}.${payloadB64}.${sigB64}`;
  }

  const app = await createHttpApp({
    service,
    authMode: "strict",
    authorizeTeacher: async (auth) => {
      return auth.user?.email === teacherEmail;
    },
    authConfig: {
      expectedAud,
      allowSyntheticAuth: true
    }
  });

  async function executeVirtualRequest({
    method = "GET",
    url = "/",
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

    process.nextTick(() => {
      if (body) {
        if (Buffer.isBuffer(body)) {
          req.emit("data", body);
        } else if (typeof body === "string") {
          req.emit("data", Buffer.from(body));
        } else {
          req.emit("data", Buffer.from(JSON.stringify(body)));
        }
      }
      req.emit("end");
    });

    await app.handleHttpRequest(req, res);
    await finishedPromise;

    const respBuffer = Buffer.concat(outChunks);
    let json = null;
    try {
      json = JSON.parse(respBuffer.toString("utf8"));
    } catch {}

    return {
      status: res.statusCode,
      headers: writtenHeaders,
      buffer: respBuffer,
      text: respBuffer.toString("utf8"),
      json
    };
  }

  t.after(() => {
    clearJwksCache();
    setTestAuthKeys(null);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  const validJwt = createSignedJwt();

  await t.test("Auth & CSRF verification", async () => {
    // 1. Unauthenticated -> 401
    const unauth = await executeVirtualRequest({ method: "GET", url: "/api/auth/me" });
    assert.equal(unauth.status, 401);

    // 2. Valid Cf-Access-Jwt-Assertion -> 200
    const authMe = await executeVirtualRequest({
      method: "GET",
      url: "/api/auth/me",
      headers: { "cf-access-jwt-assertion": validJwt }
    });
    assert.equal(authMe.status, 200);
    assert.equal(authMe.json.authenticated, true);
    assert.equal(authMe.json.teacherAuthorized, true);
    assert.equal(authMe.json.role, "teacher");

    // 3. Cookie CF_Authorization -> 200
    const cookieAuth = await executeVirtualRequest({
      method: "GET",
      url: "/api/auth/me",
      headers: { "cookie": `CF_Authorization=${validJwt}` }
    });
    assert.equal(cookieAuth.status, 200);
    assert.equal(cookieAuth.json.authenticated, true);

    // 4. Cross-site CSRF blocked on mutation
    const csrfBlocked = await executeVirtualRequest({
      method: "POST",
      url: "/api/classes",
      headers: {
        "cf-access-jwt-assertion": validJwt,
        "sec-fetch-site": "cross-site",
        "content-type": "application/json"
      },
      body: { name: "5B Informatica", academicYear: "2026/2027" }
    });
    assert.equal(csrfBlocked.status, 403);
  });

  let createdClassId = null;
  let createdSubjectId = null;
  let createdLessonId = null;

  await t.test("Context Setup: Class, Subject, Lesson creation", async () => {
    // POST /api/classes
    const clsRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/classes",
      headers: {
        "cf-access-jwt-assertion": validJwt,
        "content-type": "application/json"
      },
      body: { name: "4A Informatica", academicYear: "2026/2027", section: "A" }
    });
    assert.equal(clsRes.status, 201);
    assert.ok(clsRes.json.class.id);
    createdClassId = clsRes.json.class.id;

    // POST /api/subjects
    const subRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/subjects",
      headers: {
        "cf-access-jwt-assertion": validJwt,
        "content-type": "application/json"
      },
      body: { name: "Sistemi e Reti", classId: createdClassId, code: "SR4" }
    });
    assert.equal(subRes.status, 201);
    assert.ok(subRes.json.subject.id);
    createdSubjectId = subRes.json.subject.id;

    // POST /api/lessons
    const lesRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/lessons",
      headers: {
        "cf-access-jwt-assertion": validJwt,
        "content-type": "application/json"
      },
      body: {
        title: "Protocollo TCP e Handshake a Tre Vie",
        description: "Introduzione al livello di trasporto, connessione affidabile e three-way handshake",
        classId: createdClassId,
        subjectId: createdSubjectId,
        date: "2026-10-20"
      }
    });
    assert.equal(lesRes.status, 201);
    assert.ok(lesRes.json.lesson.id);
    createdLessonId = lesRes.json.lesson.id;
  });

  await t.test("Multipart file upload & source linking", async () => {
    const boundary = "---------------------------974767299852498929531610575";
    const fileContent = "# Appunti RFC 793\nIl protocollo TCP stabilisce connessioni affidabili tramite SYN, SYN-ACK, ACK.\n";
    const multipartBody = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="title"\r\n\r\n` +
      `RFC 793 Excerpt\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="lessonId"\r\n\r\n` +
      `${createdLessonId}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="classId"\r\n\r\n` +
      `${createdClassId}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="subjectId"\r\n\r\n` +
      `${createdSubjectId}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="rfc793.md"\r\n` +
      `Content-Type: text/markdown\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--\r\n`
    );

    const uploadRes = await executeVirtualRequest({
      method: "POST",
      url: "/api/materials/upload",
      headers: {
        "cf-access-jwt-assertion": validJwt,
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      body: multipartBody
    });

    assert.equal(uploadRes.status, 201);
    assert.ok(uploadRes.json.id);
    assert.equal(uploadRes.json.pedagogical_role, "support_material");
  });

  await t.test("Lesson Pack Generation, Workspace & Confirmation", async () => {
    // 1. Generate full pack
    const genRes = await executeVirtualRequest({
      method: "POST",
      url: `/api/lessons/${createdLessonId}/generate-pack`,
      headers: {
        "cf-access-jwt-assertion": validJwt,
        "content-type": "application/json"
      },
      body: {
        topic: "Protocollo TCP e Handshake",
        durationMinutes: 60,
        additionalInstructions: "Includi schema visivo ASCII per handshake"
      }
    });

    assert.equal(genRes.status, 200);
    const pack = genRes.json.pack;
    assert.ok(pack.artifacts.lessonPlan, "Lesson Plan must be present");
    assert.ok(pack.artifacts.teacherScript, "Teacher Script must be present");
    assert.ok(pack.artifacts.exercises, "Exercises must be present");
    assert.ok(pack.artifacts.studentMaterial, "Student Material must be present");

    // 2. Fetch pack workspace
    const packRes = await executeVirtualRequest({
      method: "GET",
      url: `/api/lessons/${createdLessonId}/pack`,
      headers: { "cf-access-jwt-assertion": validJwt }
    });
    assert.equal(packRes.status, 200);
    assert.equal(packRes.json.pack.artifacts.lessonPlan.title.includes("Piano Lezione"), true);

    // 3. Revise material
    const planId = pack.artifacts.lessonPlan.id;
    const revRes = await executeVirtualRequest({
      method: "POST",
      url: `/api/materials/${planId}/revise`,
      headers: {
        "cf-access-jwt-assertion": validJwt,
        "content-type": "application/json"
      },
      body: {
        instruction: "Aggiungi 10 minuti di debriefing finale"
      }
    });
    assert.equal(revRes.status, 200);
    assert.ok(revRes.json.result.material.current_version > 1);

    // 4. Confirm lesson preparation (version-bound)
    const confRes = await executeVirtualRequest({
      method: "POST",
      url: `/api/lessons/${createdLessonId}/confirm-preparation`,
      headers: {
        "cf-access-jwt-assertion": validJwt,
        "content-type": "application/json"
      },
      body: {
        notes: "Lezione verificata e pronta per martedì mattina"
      }
    });
    assert.equal(confRes.status, 200);
    assert.ok(confRes.json.confirmation.id);
    assert.equal(confRes.json.confirmation.notes, "Lezione verificata e pronta per martedì mattina");

    // Check pack again: confirmation must be present
    const packWithConf = await executeVirtualRequest({
      method: "GET",
      url: `/api/lessons/${createdLessonId}/pack`,
      headers: { "cf-access-jwt-assertion": validJwt }
    });
    assert.ok(packWithConf.json.pack.confirmation);
    assert.equal(packWithConf.json.pack.confirmation.notes, "Lezione verificata e pronta per martedì mattina");

    // 5. Semantic HTML Export
    const exportRes = await executeVirtualRequest({
      method: "GET",
      url: `/api/materials/${planId}/export?format=html`,
      headers: { "cf-access-jwt-assertion": validJwt }
    });
    assert.equal(exportRes.status, 200);
    assert.equal(exportRes.headers["content-type"], "text/html; charset=utf-8");
    assert.ok(exportRes.text.includes("<!DOCTYPE html>"));
    assert.ok(exportRes.text.includes("<main class=\"prose\">"));
  });
});
