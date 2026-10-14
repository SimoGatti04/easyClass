/**
 * Teacher Service — MCP Streamable HTTP & Web Server
 *
 * Implements:
 * 1. MCP Streamable HTTP specification over Node.js http.Server
 * 2. Fail-closed Cloudflare Access & OAuth Bearer token authentication for both /mcp and /api/*
 * 3. Session-to-principal isolation
 * 4. Protected Teacher REST API with role-based access control (protecting teacher scripts and solutions)
 * 5. Complete Teacher Management Web Interface with XSS prevention
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../mcp/server.js';
import { authenticateRequest, SessionPrincipalRegistry } from './auth.js';
import { createTeacherPrincipalAuthorizer } from './teacher-authorization.js';
import { TeacherService } from '../services/teacher-service.js';
import { PedagogicalRoles } from '../core/contracts.js';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 8770;
export const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024; // 25MB
export const REQUEST_TIMEOUT_MS = 30 * 1000;
export const MAX_CONCURRENT_SESSIONS = 100;
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://chatgpt.com',
  'https://mcp-teacher.simogatti.it',
  'https://class.simogatti.it'
];

export function isInit(body) {
  if (!body || typeof body !== 'object') return false;
  return isInitializeRequest(body) || body.method === 'initialize';
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let bytesRead = 0;
    const chunks = [];

    req.on('data', chunk => {
      bytesRead += chunk.length;
      if (bytesRead > maxBytes) {
        const err = new Error(`Request body exceeded limit of ${maxBytes} bytes`);
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

export async function createHttpApp(options = {}) {
  const isProduction =
    options.isProduction !== undefined
      ? options.isProduction
      : process.env.NODE_ENV === 'production';

  const defaultAuthMode = isProduction ? 'strict' : 'strict';
  const authMode = options.authMode || process.env.TEACHER_SERVICE_AUTH_MODE || defaultAuthMode;

  const service = options.service || new TeacherService({ mockAi: options.mockAi });
  // Authentication establishes identity only. Teacher membership is a distinct
  // application authorization decision and defaults to deny.
  const authorizeTeacher = options.authorizeTeacher || createTeacherPrincipalAuthorizer({
    teacherEmails: options.teacherEmails ?? process.env.TEACHER_SERVICE_TEACHER_EMAILS ?? ''
  });
  const isTeacherGrant = (grant) => grant === true || grant?.teacherAuthorized === true;
  const sessionRegistry = options.sessionRegistry || new SessionPrincipalRegistry();
  const activeTransports = new Map();
  const sessionActivity = new Map();

  function pruneInactive() {
    const now = Date.now();
    for (const [sid, lastSeen] of sessionActivity.entries()) {
      if (now - lastSeen > SESSION_IDLE_TIMEOUT_MS) {
        const trans = activeTransports.get(sid);
        if (trans) {
          try { trans.close(); } catch {}
          activeTransports.delete(sid);
        }
        sessionActivity.delete(sid);
        sessionRegistry.unregister(sid);
      }
    }
  }

  const configuredAllowedOrigins = options.allowedOrigins || (
    process.env.TEACHER_SERVICE_ALLOWED_ORIGINS
      ? process.env.TEACHER_SERVICE_ALLOWED_ORIGINS.split(',').map(s => s.trim())
      : DEFAULT_ALLOWED_ORIGINS
  );

  const authConfig = {
    expectedAud: options.authConfig?.expectedAud || process.env.TEACHER_SERVICE_CF_ACCESS_AUD || '',
    expectedIss: options.authConfig?.expectedIss ?? process.env.TEACHER_SERVICE_CF_ACCESS_ISS,
    certsUrl: options.authConfig?.certsUrl,
    authMode,
    bearerToken: options.authConfig?.bearerToken || process.env.TEACHER_SERVICE_BEARER_TOKEN
  };

  const handleHttpRequest = async (req, res) => {
    pruneInactive();

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;

    // CORS preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
      const origin = req.headers['origin'];
      if (origin && !configuredAllowedOrigins.includes(origin)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden', message: `Invalid Origin "${origin}"` }));
        return;
      }
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cf-Access-Jwt-Assertion, Mcp-Session-Id',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    // 1. Health check (unauthenticated public probe)
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            status: 'ok',
            service: 'teacher-service',
            transport: 'streamable-http',
            version: '0.1.0',
            uptimeSec: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
          },
          null,
          2
        )
      );
      return;
    }

    // 2. Web UI Dashboard (HTML)
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getTeacherWebUIHtml());
      return;
    }

    // 3. REST API endpoint (/api/*) — Strict authentication & authorization
    if (pathname.startsWith('/api/')) {
      // Origin check if present
      const originHeader = req.headers['origin'];
      if (originHeader && typeof originHeader === 'string') {
        if (!configuredAllowedOrigins.includes(originHeader)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden', message: `Invalid Origin "${originHeader}"` }));
          return;
        }
      }

      // Request size limit check
      const contentLengthHeader = req.headers['content-length'];
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (contentLength > MAX_PAYLOAD_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload Too Large', message: `Max allowed payload is ${MAX_PAYLOAD_BYTES} bytes` }));
          return;
        }
      }

      // Authenticate request consistently
      const authResult = await authenticateRequest(req, authConfig);
      if (!authResult.authenticated) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', message: authResult.error || 'Authentication required for Teacher Service REST API' }));
        return;
      }

      let teacherGrant = false;
      try { teacherGrant = isTeacherGrant(await authorizeTeacher(authResult)); } catch { teacherGrant = false; }
      if (!teacherGrant) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Authenticated principal is not authorized as a teacher' }));
        return;
      }
      authResult.teacherAuthorized = true;

      let bodyBuffer = Buffer.alloc(0);
      let parsedBody = null;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
          bodyBuffer = await readRequestBody(req, MAX_PAYLOAD_BYTES);
          if (bodyBuffer.length > 0) {
            try {
              parsedBody = JSON.parse(bodyBuffer.toString('utf8'));
            } catch {
              parsedBody = null;
            }
          }
        } catch (err) {
          res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request', message: err.message }));
          return;
        }
      }

      return handleRestApi(req, res, pathname, parsedUrl, service, authResult, parsedBody);
    }

    // 4. MCP Streamable HTTP endpoint (/mcp)
    if (pathname === '/mcp') {
      // Validate Origin header if present
      const originHeader = req.headers['origin'];
      if (originHeader && typeof originHeader === 'string') {
        if (!configuredAllowedOrigins.includes(originHeader)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: `Forbidden: Invalid Origin "${originHeader}"` },
              id: null
            })
          );
          return;
        }
      }

      // Check Content-Length header
      const contentLengthHeader = req.headers['content-length'];
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (contentLength > MAX_PAYLOAD_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: `Payload Too Large: Maximum allowed request size is ${MAX_PAYLOAD_BYTES} bytes`
              },
              id: null
            })
          );
          return;
        }
      }

      // Authenticate
      const authResult = await authenticateRequest(req, authConfig);
      if (!authResult.authenticated) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: `Unauthorized: ${authResult.error || 'Invalid or missing authentication credentials'}` },
            id: null
          })
        );
        return;
      }

      const clientPrincipal = authResult.principal;
      let teacherGrant = false;
      try { teacherGrant = await authorizeTeacher(authResult); } catch { teacherGrant = false; }
      if (!isTeacherGrant(teacherGrant)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32003, message: 'Authenticated principal is not authorized as a teacher' }, id: null }));
        return;
      }
      const teacherActor = {
        teacherAuthorized: true,
        actorId: typeof teacherGrant === 'object' ? (teacherGrant.actorId || teacherGrant.principal || clientPrincipal) : clientPrincipal,
        principal: clientPrincipal
      };

      // Read Body
      let bodyBuffer;
      try {
        bodyBuffer = await readRequestBody(req, MAX_PAYLOAD_BYTES);
      } catch (err) {
        res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: err.message },
            id: null
          })
        );
        return;
      }

      let parsedBody = null;
      if (bodyBuffer.length > 0) {
        try {
          parsedBody = JSON.parse(bodyBuffer.toString('utf8'));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32700, message: 'Parse error: Request body must be valid JSON' },
              id: null
            })
          );
          return;
        }
      }

      const sessionIdHeader = req.headers['mcp-session-id'];
      let transport = null;

      if (sessionIdHeader) {
        if (!sessionRegistry.has(sessionIdHeader)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Session Not Found: Unknown or expired session' },
              id: null
            })
          );
          return;
        }

        // Validate session-to-principal isolation
        if (!sessionRegistry.validate(sessionIdHeader, clientPrincipal)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Forbidden: Session belongs to a different principal' },
              id: null
            })
          );
          return;
        }

        transport = activeTransports.get(sessionIdHeader);
        if (!transport) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Session Not Found: Inactive session transport' },
              id: null
            })
          );
          return;
        }
        sessionActivity.set(sessionIdHeader, Date.now());
      } else if (isInit(parsedBody)) {
        if (activeTransports.size >= MAX_CONCURRENT_SESSIONS) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Service Unavailable: Maximum concurrent sessions reached' },
              id: null
            })
          );
          return;
        }

        transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: () => `session-${crypto.randomUUID()}`,
          enableJsonResponse: true,
          onsessioninitialized: (newSessionId) => {
            activeTransports.set(newSessionId, transport);
            sessionActivity.set(newSessionId, Date.now());
            sessionRegistry.bind(newSessionId, clientPrincipal);
          },
          onsessionclosed: (closedSessionId) => {
            activeTransports.delete(closedSessionId);
            sessionActivity.delete(closedSessionId);
            sessionRegistry.unregister(closedSessionId);
          }
        });

        const mcpServer = createMcpServer(service, { authorizeTeacher: async () => teacherActor });
        await mcpServer.connect(transport);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: Must be initialize request or include valid Mcp-Session-Id header' },
            id: null
          })
        );
        return;
      }

      // Build Web Standards Request
      const webHeaders = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const v of value) webHeaders.append(key, v);
          } else {
            webHeaders.set(key, value);
          }
        }
      }

      if (!webHeaders.has('accept') || !webHeaders.get('accept').includes('text/event-stream')) {
        webHeaders.set('accept', 'application/json, text/event-stream');
      }

      const webReq = new Request(parsedUrl.toString(), {
        method: req.method,
        headers: webHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' && bodyBuffer.length > 0 ? bodyBuffer : undefined,
        duplex: 'half'
      });

      try {
        const webRes = await transport.handleRequest(webReq, { parsedBody });
        const resHeaders = {};
        for (const [k, v] of webRes.headers.entries()) {
          resHeaders[k] = v;
        }

        res.writeHead(webRes.status, resHeaders);
        if (webRes.body) {
          const reader = webRes.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        res.end();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: `Internal server error: ${err.message}` },
            id: null
          })
        );
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', message: `Route not found: ${pathname}` }));
  };

  const server = http.createServer(handleHttpRequest);

  return {
    server,
    handleHttpRequest,
    start: (port = DEFAULT_PORT, host = DEFAULT_HOST) => {
      return new Promise((resolve, reject) => {
        server.listen(port, host, () => {
          resolve({ port, host, url: `http://${host}:${port}` });
        });
        server.on('error', reject);
      });
    },
    close: async () => {
      for (const trans of activeTransports.values()) {
        try { await trans.close(); } catch {}
      }
      activeTransports.clear();
      service.close();
      if (server.listening) {
        return new Promise((resolve) => server.close(resolve));
      }
      return Promise.resolve();
    }
  };
}

async function handleRestApi(req, res, pathname, parsedUrl, service, authResult, parsedBody) {
  res.setHeader('Content-Type', 'application/json');

  // Never derive roles from request parameters. The route is reached only after
  // the trusted application teacher-authorizer grants this principal.
  if (authResult.teacherAuthorized !== true) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Forbidden', message: 'Teacher authorization required' }));
    return;
  }
  const callerRole = 'teacher';
  const isStudent = callerRole === 'student';

  try {
    // GET /api/classes
    if (pathname === '/api/classes' && req.method === 'GET') {
      const classes = service.listClasses();
      res.writeHead(200);
      res.end(JSON.stringify({ classes }));
      return;
    }

    // GET /api/subjects
    if (pathname === '/api/subjects' && req.method === 'GET') {
      const classId = parsedUrl.searchParams.get('classId');
      const subjects = service.listSubjects({ classId });
      res.writeHead(200);
      res.end(JSON.stringify({ subjects }));
      return;
    }

    // GET /api/lessons
    if (pathname === '/api/lessons' && req.method === 'GET') {
      const classId = parsedUrl.searchParams.get('classId');
      const subjectId = parsedUrl.searchParams.get('subjectId');
      const lessons = service.listLessons({ classId, subjectId });
      res.writeHead(200);
      res.end(JSON.stringify({ lessons }));
      return;
    }

    // GET /api/materials
    if (pathname === '/api/materials' && req.method === 'GET') {
      const classId = parsedUrl.searchParams.get('classId');
      const subjectId = parsedUrl.searchParams.get('subjectId');
      const lessonId = parsedUrl.searchParams.get('lessonId');
      let materials = service.listMaterials({ classId, subjectId, lessonId });

      if (isStudent) {
        // Exclude teacher-only materials
        materials = materials.filter(m => m.pedagogical_role !== PedagogicalRoles.TEACHER_MATERIAL);
      }

      res.writeHead(200);
      res.end(JSON.stringify({ materials }));
      return;
    }

    // GET /api/materials/:id/export
    if (pathname.match(/^\/api\/materials\/([^/]+)\/export$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const format = parsedUrl.searchParams.get('format') || 'markdown';
      const exported = service.exportMaterialFile(id, format, { includeTeacherSolutions: !isStudent });

      res.setHeader('Content-Type', exported.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      res.writeHead(200);
      res.end(exported.data);
      return;
    }

    // GET /api/materials/:id
    if (pathname.match(/^\/api\/materials\/([^/]+)$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const material = service.getMaterial(id, null, { role: callerRole, includeTeacherSolutions: !isStudent });

      if (isStudent && material.pedagogical_role === PedagogicalRoles.TEACHER_MATERIAL) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Access denied to teacher-only material' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ material }));
      return;
    }

    // POST /api/materials
    if (pathname === '/api/materials' && req.method === 'POST') {
      if (isStudent) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Only teachers can create materials' }));
        return;
      }
      const mat = service.createMaterial(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ material: mat }));
      return;
    }

    // GET /api/ai-rules
    if (pathname === '/api/ai-rules' && req.method === 'GET') {
      const scope = parsedUrl.searchParams.get('scope');
      const targetId = parsedUrl.searchParams.get('targetId');
      const rules = service.listAiRules({ scope, targetId });
      res.writeHead(200);
      res.end(JSON.stringify({ rules }));
      return;
    }

    // POST /api/ai-rules
    if (pathname === '/api/ai-rules' && req.method === 'POST') {
      if (isStudent) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Only teachers can modify AI rules' }));
        return;
      }
      const rule = service.setAiRule(parsedBody || {}, {
        teacherAuthorized: true,
        actorId: authResult.principal
      });
      res.writeHead(201);
      res.end(JSON.stringify({ rule }));
      return;
    }

    // GET /api/assessments
    if (pathname === '/api/assessments' && req.method === 'GET') {
      const classId = parsedUrl.searchParams.get('classId');
      const assessments = service.listAssessments({ classId });
      res.writeHead(200);
      res.end(JSON.stringify({ assessments }));
      return;
    }

    // GET /api/assessments/:id
    if (pathname.match(/^\/api\/assessments\/([^/]+)$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const assessment = service.getAssessment(id, { role: callerRole, includeTeacherSolutions: !isStudent });
      res.writeHead(200);
      res.end(JSON.stringify({ assessment }));
      return;
    }

    // POST /api/assessments
    if (pathname === '/api/assessments' && req.method === 'POST') {
      if (isStudent) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Only teachers can create assessments' }));
        return;
      }
      const asm = service.createAssessment(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ assessment: asm }));
      return;
    }

    // GET /api/assessments/:id/submissions
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/submissions$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const submissions = service.listSubmissions(id);
      res.writeHead(200);
      res.end(JSON.stringify({ submissions }));
      return;
    }

    // POST /api/assessments/:id/submissions (Submit student attempt)
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/submissions$/) && req.method === 'POST') {
      const assessmentId = pathname.split('/')[3];
      const submission = service.importSubmission({ assessmentId, ...(parsedBody || {}) });
      res.writeHead(201);
      res.end(JSON.stringify({ submission }));
      return;
    }

    // POST /api/submissions/:id/grade
    if (pathname.match(/^\/api\/submissions\/([^/]+)\/grade$/) && req.method === 'POST') {
      const submissionId = pathname.split('/')[3];
      const result = await service.gradeSubmission({ submissionId, ...(parsedBody || {}) });
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // POST /api/submissions/:id/review
    if (pathname.match(/^\/api\/submissions\/([^/]+)\/review$/) && req.method === 'POST') {
      if (isStudent) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Only teachers can review grades' }));
        return;
      }
      const submissionId = pathname.split('/')[3];
      const result = service.reviewGrading({ submissionId, ...(parsedBody || {}) });
      res.writeHead(200);
      res.end(JSON.stringify({ submission: result }));
      return;
    }

    // GET /api/assessments/:id/export
    if (pathname.match(/^\/api\/assessments\/([^/]+)\/export$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const format = parsedUrl.searchParams.get('format') || 'csv';
      const results = service.exportAssessmentResults(id, format);
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="assessment_${id}_results.csv"`);
        res.writeHead(200);
        res.end(results);
      } else if (format === 'json') {
        res.writeHead(200);
        res.end(JSON.stringify(results, null, 2));
      } else {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.writeHead(200);
        res.end(results);
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }));
  } catch (err) {
    const statusCode = err.name === 'NotFoundError' ? 404 : (err.name === 'ValidationError' ? 400 : 500);
    res.writeHead(statusCode);
    res.end(JSON.stringify({ error: err.name || 'Error', message: err.message }));
  }
}

function getTeacherWebUIHtml() {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Teacher Service — Dashboard Docente</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 1.5rem; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
    h1 { font-size: 1.6rem; margin: 0; }
    .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-teacher { background: #e0f2fe; color: #0369a1; }
    .badge-student { background: #dcfce7; color: #15803d; }
    .badge-support { background: #f1f5f9; color: #475569; }
    .badge-assessable { background: #fef08a; color: #854d0e; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
    .tab-btn { background: none; border: none; padding: 0.75rem 1.25rem; font-size: 0.95rem; font-weight: 500; cursor: pointer; color: var(--text-muted); border-bottom: 2px solid transparent; }
    .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    th, td { text-align: left; padding: 0.6rem; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    th { font-weight: 600; color: var(--text-muted); }
    input, select, textarea, button { font-family: inherit; font-size: 0.9rem; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 6px; }
    button.btn-primary { background: var(--primary); color: white; border: none; cursor: pointer; font-weight: 500; }
    button.btn-primary:hover { background: var(--primary-dark); }
    .auth-bar { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Teacher Service</h1>
      <p style="margin: 0.2rem 0 0; color: var(--text-muted); font-size: 0.85rem;">Piattaforma di Gestione Materiali Didattici, Curricolo e Valutazione con Assistenza AI</p>
    </div>
    <div class="auth-bar">
      <span style="color: var(--text-muted);">Autenticazione:</span>
      <input type="password" id="token-input" placeholder="Bearer Token (opzionale)" style="width: 200px;" />
      <button class="btn-primary" onclick="saveAuthToken()">Salva</button>
    </div>
  </header>

  <nav class="tabs">
    <button class="tab-btn active" onclick="switchTab('tab-materials')">Materiali Didattici</button>
    <button class="tab-btn" onclick="switchTab('tab-classes')">Classi e Lezioni</button>
    <button class="tab-btn" onclick="switchTab('tab-rules')">Regole Operative AI</button>
    <button class="tab-btn" onclick="switchTab('tab-assessments')">Verifiche e Valutazione</button>
  </nav>

  <main>
    <!-- TAB MATERIALI -->
    <section id="tab-materials" class="tab-content">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1.1rem; margin: 0;">Materiali Disponibili</h2>
          <button class="btn-primary" onclick="loadMaterials()">Aggiorna</button>
        </div>
        <div id="materials-table-wrap" style="margin-top: 1rem;">Caricamento...</div>
      </div>
    </section>

    <!-- TAB CLASSI -->
    <section id="tab-classes" class="tab-content" style="display: none;">
      <div class="card">
        <h2 style="font-size: 1.1rem; margin: 0 0 1rem;">Struttura Classi e Corsi</h2>
        <div id="classes-list-wrap">Caricamento...</div>
      </div>
    </section>

    <!-- TAB REGOLE AI -->
    <section id="tab-rules" class="tab-content" style="display: none;">
      <div class="card">
        <h2 style="font-size: 1.1rem; margin: 0 0 1rem;">Regole Operative AI Configurate (Dossier 09)</h2>
        <div id="rules-list-wrap">Caricamento...</div>
      </div>
    </section>

    <!-- TAB ASSESSMENTS -->
    <section id="tab-assessments" class="tab-content" style="display: none;">
      <div class="card">
        <h2 style="font-size: 1.1rem; margin: 0 0 1rem;">Verifiche e Valutazione</h2>
        <div id="assessments-list-wrap">Caricamento...</div>
      </div>
    </section>
  </main>

  <script>
    // XSS Sanitizer: Escape user-controlled strings before inserting into DOM
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function getAuthHeaders() {
      const headers = { 'Accept': 'application/json' };
      const token = localStorage.getItem('ts_bearer_token');
      if (token) headers['Authorization'] = 'Bearer ' + token;
      return headers;
    }

    function saveAuthToken() {
      const val = document.getElementById('token-input').value.trim();
      if (val) {
        localStorage.setItem('ts_bearer_token', val);
        alert('Token salvato.');
      } else {
        localStorage.removeItem('ts_bearer_token');
        alert('Token rimosso.');
      }
      loadMaterials();
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      const activeTab = document.getElementById(tabId);
      if (activeTab) activeTab.style.display = 'block';
      event.target.classList.add('active');

      if (tabId === 'tab-materials') loadMaterials();
      if (tabId === 'tab-classes') loadClasses();
      if (tabId === 'tab-rules') loadRules();
      if (tabId === 'tab-assessments') loadAssessments();
    }

    async function loadMaterials() {
      const wrap = document.getElementById('materials-table-wrap');
      try {
        const res = await fetch('/api/materials', { headers: getAuthHeaders() });
        if (!res.ok) {
          wrap.innerHTML = '<p style="color: red;">Errore caricamento (' + res.status + '): ' + escapeHtml(res.statusText) + '</p>';
          return;
        }
        const data = await res.json();
        const mats = data.materials || [];
        if (mats.length === 0) {
          wrap.innerHTML = '<p>Nessun materiale presente.</p>';
          return;
        }

        let html = '<table><thead><tr><th>Titolo</th><th>Ruolo</th><th>Versione</th><th>Tipo</th><th>Azioni</th></tr></thead><tbody>';
        for (const m of mats) {
          const roleBadgeClass = 'badge-' + (m.pedagogical_role === 'teacher_material' ? 'teacher' : (m.pedagogical_role === 'student_material' ? 'student' : (m.pedagogical_role === 'assessable_material' ? 'assessable' : 'support')));
          html += '<tr>' +
            '<td><strong>' + escapeHtml(m.title) + '</strong></td>' +
            '<td><span class="badge ' + roleBadgeClass + '">' + escapeHtml(m.pedagogical_role) + '</span></td>' +
            '<td>v' + escapeHtml(m.current_version) + '</td>' +
            '<td>' + escapeHtml(m.resource_type) + '</td>' +
            '<td><a href="/api/materials/' + encodeURIComponent(m.id) + '/export?format=markdown" target="_blank">Export MD</a> | <a href="/api/materials/' + encodeURIComponent(m.id) + '/export?format=html" target="_blank">HTML</a></td>' +
            '</tr>';
        }
        html += '</tbody></table>';
        wrap.innerHTML = html;
      } catch (err) {
        wrap.innerHTML = '<p style="color: red;">Errore di rete: ' + escapeHtml(err.message) + '</p>';
      }
    }

    async function loadClasses() {
      const wrap = document.getElementById('classes-list-wrap');
      try {
        const res = await fetch('/api/classes', { headers: getAuthHeaders() });
        const data = await res.json();
        const list = data.classes || [];
        if (list.length === 0) {
          wrap.innerHTML = '<p>Nessuna classe registrata.</p>';
          return;
        }
        let html = '<ul>';
        for (const c of list) {
          html += '<li><strong>' + escapeHtml(c.name) + '</strong> (' + escapeHtml(c.academic_year) + ') - ' + escapeHtml(c.description || '') + '</li>';
        }
        html += '</ul>';
        wrap.innerHTML = html;
      } catch (err) {
        wrap.innerHTML = '<p style="color: red;">Errore: ' + escapeHtml(err.message) + '</p>';
      }
    }

    async function loadRules() {
      const wrap = document.getElementById('rules-list-wrap');
      try {
        const res = await fetch('/api/ai-rules', { headers: getAuthHeaders() });
        const data = await res.json();
        const rules = data.rules || [];
        if (rules.length === 0) {
          wrap.innerHTML = '<p>Nessuna regola AI definita.</p>';
          return;
        }
        let html = '<ul>';
        for (const r of rules) {
          html += '<li><strong>' + escapeHtml(r.title) + '</strong> [Scope: ' + escapeHtml(r.scope) + ']: <em>' + escapeHtml(r.instruction_text) + '</em></li>';
        }
        html += '</ul>';
        wrap.innerHTML = html;
      } catch (err) {
        wrap.innerHTML = '<p style="color: red;">Errore: ' + escapeHtml(err.message) + '</p>';
      }
    }

    async function loadAssessments() {
      const wrap = document.getElementById('assessments-list-wrap');
      try {
        const res = await fetch('/api/assessments', { headers: getAuthHeaders() });
        const data = await res.json();
        const list = data.assessments || [];
        if (list.length === 0) {
          wrap.innerHTML = '<p>Nessuna verifica registrata.</p>';
          return;
        }
        let html = '<ul>';
        for (const a of list) {
          html += '<li><strong>' + escapeHtml(a.title) + '</strong> (' + escapeHtml(a.duration_minutes) + ' min, max ' + escapeHtml(a.max_score) + ' pt) - Stato: ' + escapeHtml(a.status) + ' | <a href="/api/assessments/' + encodeURIComponent(a.id) + '/export?format=report" target="_blank">Report</a></li>';
        }
        html += '</ul>';
        wrap.innerHTML = html;
      } catch (err) {
        wrap.innerHTML = '<p style="color: red;">Errore: ' + escapeHtml(err.message) + '</p>';
      }
    }

    // Auto-load token & initial tab
    const savedToken = localStorage.getItem('ts_bearer_token');
    if (savedToken) document.getElementById('token-input').value = savedToken;
    loadMaterials();
  </script>
</body>
</html>`;
}
