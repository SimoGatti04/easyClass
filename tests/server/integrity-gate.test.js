import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { createHttpApp } from "../../src/server/http.js";
import { createMcpServer } from "../../src/mcp/server.js";
import { DatabaseManager } from "../../src/db/database.js";
import { FileStore } from "../../src/storage/filestore.js";
import { TeacherService } from "../../src/services/teacher-service.js";
import { setTestAuthKeys, clearJwksCache } from "../../src/server/auth.js";
import { ValidationError } from "../../src/core/errors.js";

function signTestToken(privateKey, { email = "teacher@school.example", aud = "test-web-aud", iss = "https://auth.simogatti.it" } = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-gate-key" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    email,
    sub: email,
    aud,
    iss,
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, "base64url");
  return `${header}.${payload}.${signature}`;
}

test("Feature gate server-side C6: TEACHER_SERVICE_ENABLE_INTEGRITY_ANALYSIS", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integrity-gate-"));
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  setTestAuthKeys({ keys: new Map([["test-gate-key", publicKey]]) });
  clearJwksCache();

  t.after(() => {
    clearJwksCache();
    setTestAuthKeys(null);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function executeRequest(app, {
    method = "GET",
    url = "/health",
    headers = {},
    body = null
  }) {
    const socket = new EventEmitter();
    socket.setTimeout = () => {};
    socket.remoteAddress = "127.0.0.1";
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    const reqHeaders = {
      host: "localhost:8770",
      origin: "http://localhost:8770",
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
        req.emit("data", Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf-8"));
      }
      req.emit("end");
    });

    await app.handleHttpRequest(req, res);

    return finishedPromise.then(() => {
      const rawBody = Buffer.concat(outChunks).toString("utf-8");
      let parsedJson = null;
      try { parsedJson = JSON.parse(rawBody); } catch {}
      return { statusCode: res.statusCode, headers: writtenHeaders, body: parsedJson, raw: rawBody };
    });
  }

  await t.test("A. Conservative default: Feature DISABLED", async () => {
    const db = new DatabaseManager(":memory:").init();
    const files = new FileStore(path.join(tmpDir, "disabled-files"));
    // Default constructor: enableIntegrityAnalysis is false
    const service = new TeacherService({ dbManager: db, fileStore: files, mockAi: true });
    assert.equal(service.enableIntegrityAnalysis, false, "Default must be false");

    // 1. Direct service methods fail-closed with ValidationError
    assert.throws(
      () => service.analyzeIntegrityEvidence("any-assessment-id"),
      (err) => err instanceof ValidationError && err.message.includes("disabilitata")
    );
    assert.throws(
      () => service.recordIntegrityReview({ assessmentId: "any", evidenceId: "any", decision: "reviewed_no_action", idempotencyKey: "test-001" }),
      (err) => err instanceof ValidationError && err.message.includes("disabilitata")
    );

    // 2. HTTP App behaviour
    const app = await createHttpApp({
      service,
      authMode: "strict",
      teacherEmails: "teacher@school.example",
      authConfig: { webAud: "test-web-aud", expectedIss: "https://auth.simogatti.it" }
    });

    const teacherToken = signTestToken(privateKey);
    const authHeaders = {
      "cf-access-jwt-assertion": teacherToken,
      "cookie": `CF_Authorization=${teacherToken}`
    };

    // /api/auth/me reports feature disabled
    const meRes = await executeRequest(app, { method: "GET", url: "/api/auth/me", headers: authHeaders });
    assert.equal(meRes.statusCode, 200);
    assert.equal(meRes.body.features?.integrityAnalysis, false);

    // REST integrity preview returns 404
    const previewRes = await executeRequest(app, {
      method: "GET",
      url: "/api/assessments/asm-test-123/integrity-preview",
      headers: authHeaders
    });
    assert.equal(previewRes.statusCode, 404);
    assert.match(previewRes.body.message, /disabilitata/);

    // REST integrity review returns 404
    const reviewRes = await executeRequest(app, {
      method: "POST",
      url: "/api/assessments/asm-test-123/integrity-reviews",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: { evidenceId: "ev-1", decision: "reviewed_no_action", idempotencyKey: "key-123" }
    });
    assert.equal(reviewRes.statusCode, 404);

    // Ordinary operations (classes, lessons, monitoring) remain fully functional
    const classesRes = await executeRequest(app, { method: "GET", url: "/api/classes", headers: authHeaders });
    assert.equal(classesRes.statusCode, 200);

    await app.close();

    // 3. MCP Server behaviour
    const mcpServer = createMcpServer(service, {
      authorizeTeacher: async () => ({ teacherAuthorized: true, actorId: "test-teacher" })
    });
    // Request tools list via MCP SDK internal handler
    const listHandler = mcpServer._requestHandlers?.get("tools/list");
    assert.ok(listHandler, "Must have tools/list handler");
    const toolsList = await listHandler({ method: "tools/list", params: {} });
    const toolNames = toolsList.tools.map(t => t.name);
    assert.ok(!toolNames.includes("analyze_integrity_evidence"), "analyze_integrity_evidence must NOT be listed when disabled");
    assert.ok(!toolNames.includes("record_integrity_review"), "record_integrity_review must NOT be listed when disabled");
    assert.ok(toolNames.includes("list_classes"), "Standard tools must be listed");

    // Call tool directly when disabled must fail closed
    const callHandler = mcpServer._requestHandlers?.get("tools/call");
    const callResult = await callHandler({ method: "tools/call", params: { name: "analyze_integrity_evidence", arguments: { assessmentId: "asm-1" } } });
    assert.equal(callResult.isError, true);
    assert.match(callResult.content[0].text, /disabilitata/);
  });

  await t.test("B. Explicitly ENABLED in synthetic environment", async () => {
    const db = new DatabaseManager(":memory:").init();
    const files = new FileStore(path.join(tmpDir, "enabled-files"));
    const service = new TeacherService({
      dbManager: db,
      fileStore: files,
      mockAi: true,
      enableIntegrityAnalysis: true
    });
    assert.equal(service.enableIntegrityAnalysis, true, "Must be true when explicitly enabled");

    const app = await createHttpApp({
      service,
      authMode: "strict",
      teacherEmails: "teacher@school.example",
      authConfig: { webAud: "test-web-aud", expectedIss: "https://auth.simogatti.it" }
    });

    const teacherToken = signTestToken(privateKey);
    const authHeaders = {
      "cf-access-jwt-assertion": teacherToken,
      "cookie": `CF_Authorization=${teacherToken}`
    };

    // /api/auth/me reports feature enabled
    const meRes = await executeRequest(app, { method: "GET", url: "/api/auth/me", headers: authHeaders });
    assert.equal(meRes.statusCode, 200);
    assert.equal(meRes.body.features?.integrityAnalysis, true);

    // MCP Server lists tools
    const mcpServer = createMcpServer(service, {
      authorizeTeacher: async () => ({ teacherAuthorized: true, actorId: "test-teacher" })
    });
    const listHandler = mcpServer._requestHandlers?.get("tools/list");
    const toolsList = await listHandler({ method: "tools/list", params: {} });
    const toolNames = toolsList.tools.map(t => t.name);
    assert.ok(toolNames.includes("analyze_integrity_evidence"), "Must be listed when enabled");
    assert.ok(toolNames.includes("record_integrity_review"), "Must be listed when enabled");

    await app.close();
  });
});
