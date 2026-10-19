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

test("T1 Workflow End-to-End Acceptance Suite", async (t) => {
  const tmpDir = path.resolve(process.cwd(), ".tmp", "test-t1-e2e-" + Date.now());
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

  const testKid = "t1-e2e-kid";
  setTestAuthKeys({
    keys: new Map([[testKid, crypto.createPublicKey(publicKey)]])
  });

  const expectedAud = "cf-access-aud-class";
  const teacherEmail = "prof.<user>@scuola.example";
  const unauthorizedEmail = "studente@scuola.example";

  function createSignedJwt({
    email = teacherEmail,
    sub = email,
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

  async function executeRequest({
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

  const teacherJwt = createSignedJwt({ email: teacherEmail });
  const studentJwt = createSignedJwt({ email: unauthorizedEmail });

  // 1. Web Authentication & Role Boundaries
  await t.test("Authentication & Server-Side Authorization", async () => {
    // Unauthenticated
    const unauth = await executeRequest({ method: "GET", url: "/api/classes" });
    assert.equal(unauth.status, 401);

    // Unauthorized email -> 403 Forbidden
    const unauthEmail = await executeRequest({
      method: "GET",
      url: "/api/classes",
      headers: { "cf-access-jwt-assertion": studentJwt }
    });
    assert.equal(unauthEmail.status, 403);

    // Authorized teacher -> 200 OK
    const authOk = await executeRequest({
      method: "GET",
      url: "/api/auth/me",
      headers: { "cf-access-jwt-assertion": teacherJwt }
    });
    assert.equal(authOk.status, 200);
    assert.equal(authOk.json.teacherAuthorized, true);
    assert.equal(authOk.json.user.email, teacherEmail);
  });

  let classId = null;
  let subjectId = null;
  let lessonId = null;

  // 2. Onboarding & Context Setup
  await t.test("Organization Context Setup", async () => {
    const cls = await executeRequest({
      method: "POST",
      url: "/api/classes",
      headers: { "cf-access-jwt-assertion": teacherJwt, "content-type": "application/json" },
      body: { name: "5B Informatica", academicYear: "2026/2027", section: "B" }
    });
    assert.equal(cls.status, 201);
    classId = cls.json.class.id;

    const sub = await executeRequest({
      method: "POST",
      url: "/api/subjects",
      headers: { "cf-access-jwt-assertion": teacherJwt, "content-type": "application/json" },
      body: { name: "Tecnologie e Progettazione di Sistemi Informatici", classId, code: "TPSIT" }
    });
    assert.equal(sub.status, 201);
    subjectId = sub.json.subject.id;

    const les = await executeRequest({
      method: "POST",
      url: "/api/lessons",
      headers: { "cf-access-jwt-assertion": teacherJwt, "content-type": "application/json" },
      body: {
        title: "Protocollo WebSocket e Comunicazione Bidirezionale Full-Duplex",
        description: "Differenze con HTTP polling, handshake di upgrade e frame RFC 6455",
        classId,
        subjectId,
        date: "2026-10-21"
      }
    });
    assert.equal(les.status, 201);
    lessonId = les.json.lesson.id;
  });

  // 3. Real Multipart File Upload
  await t.test("Real Multipart File Upload & Document Preservation", async () => {
    const boundary = "---------------------------123456789012345678901234567";
    const docText = "# RFC 6455 Overview\nThe WebSocket Protocol enables two-way communication between a client and a remote host.";
    const multipart = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="title"\r\n\r\n` +
      `RFC 6455 Guide\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="classId"\r\n\r\n` +
      `${classId}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="subjectId"\r\n\r\n` +
      `${subjectId}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="lessonId"\r\n\r\n` +
      `${lessonId}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="rfc6455.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${docText}\r\n` +
      `--${boundary}--\r\n`
    );

    const up = await executeRequest({
      method: "POST",
      url: "/api/materials/upload",
      headers: {
        "cf-access-jwt-assertion": teacherJwt,
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      body: multipart
    });

    assert.equal(up.status, 201);
    assert.ok(up.json.id);
    assert.ok(up.json.original_file_sha256);
  });

  // 4. Generation, Workspace, Partial Retry, Revision & Preparation Confirmation
  await t.test("Lesson Pack Lifecycle: Generation, Partial Retry, Revision & Confirmation", async () => {
    // Generate entire pack
    const gen = await executeRequest({
      method: "POST",
      url: `/api/lessons/${lessonId}/generate-pack`,
      headers: { "cf-access-jwt-assertion": teacherJwt, "content-type": "application/json" },
      body: {
        topic: "WebSocket e Full-Duplex",
        durationMinutes: 60,
        additionalInstructions: "Focus su framing e ping/pong"
      }
    });

    assert.equal(gen.status, 200);
    const { pack } = gen.json;
    assert.ok(pack.artifacts.lessonPlan);
    assert.ok(pack.artifacts.teacherScript);
    assert.ok(pack.artifacts.exercises);
    assert.ok(pack.artifacts.studentMaterial);

    // Verify partial regeneration / retry of exercises only
    const retryExercises = await executeRequest({
      method: "POST",
      url: `/api/lessons/${lessonId}/generate-pack`,
      headers: { "cf-access-jwt-assertion": teacherJwt, "content-type": "application/json" },
      body: {
        targetArtifacts: ["exercises"],
        additionalInstructions: "Includi esercizio su frammentazione frame"
      }
    });
    assert.equal(retryExercises.status, 200);
    assert.ok(retryExercises.json.pack.artifacts.exercises);

    // Manual edit on Lesson Plan -> creates new version v2
    const plan = pack.artifacts.lessonPlan;
    const manualEdit = await executeRequest({
      method: "PUT",
      url: `/api/materials/${plan.id}`,
      headers: { "cf-access-jwt-assertion": teacherJwt, "content-type": "application/json" },
      body: {
        contentText: plan.content + "\n\n### Note docente aggiunte a mano\nVerificare disponibilità wi-fi aula computer.",
        changeSummary: "Note aula aggiunte manualmente"
      }
    });
    assert.equal(manualEdit.status, 200);
    assert.equal(manualEdit.json.material.current_version, 2);

    // AI revision on Student Material
    const studentMat = pack.artifacts.studentMaterial;
    const aiRev = await executeRequest({
      method: "POST",
      url: `/api/materials/${studentMat.id}/revise`,
      headers: { "cf-access-jwt-assertion": teacherJwt, "content-type": "application/json" },
      body: {
        instruction: "Semplifica la spiegazione del bit MASK per gli studenti"
      }
    });
    assert.equal(aiRev.status, 200);
    assert.ok(aiRev.json.result.material.current_version > 1);

    // Confirm Lesson Preparation (version-bound)
    const conf = await executeRequest({
      method: "POST",
      url: `/api/lessons/${lessonId}/confirm-preparation`,
      headers: { "cf-access-jwt-assertion": teacherJwt, "content-type": "application/json" },
      body: {
        notes: "Lesson Pack approvato e validato per la lezione di domani"
      }
    });
    assert.equal(conf.status, 200);
    assert.ok(conf.json.confirmation.id);
    assert.equal(conf.json.confirmation.artifactVersions.lessonPlan.version, 2);

    // Verify lesson status remains "planned", NOT marked "completed" prematurely!
    const lesCheck = await executeRequest({
      method: "GET",
      url: `/api/lessons/${lessonId}`,
      headers: { "cf-access-jwt-assertion": teacherJwt }
    });
    assert.equal(lesCheck.json.lesson.status, "planned");

    // Multi-format Exports
    const exportHtml = await executeRequest({
      method: "GET",
      url: `/api/materials/${plan.id}/export?format=html`,
      headers: { "cf-access-jwt-assertion": teacherJwt }
    });
    assert.equal(exportHtml.status, 200);
    assert.equal(exportHtml.headers["content-type"], "text/html; charset=utf-8");
    assert.ok(exportHtml.text.includes("<main class=\"prose\">"));

    const exportMd = await executeRequest({
      method: "GET",
      url: `/api/materials/${plan.id}/export?format=markdown`,
      headers: { "cf-access-jwt-assertion": teacherJwt }
    });
    assert.equal(exportMd.status, 200);
    assert.ok(exportMd.text.includes("Note docente aggiunte a mano"));
  });
});
