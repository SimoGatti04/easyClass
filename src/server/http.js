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
import { authenticateRequest, SessionPrincipalRegistry, validateCsrf } from './auth.js';
import { parseMultipartFormData } from './multipart.js';
import { createStaticFileHandler } from './static.js';
import path from 'node:path';
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

  const defaultAuthMode = 'strict';
  const authMode = options.authMode || process.env.TEACHER_SERVICE_AUTH_MODE || defaultAuthMode;
  if (isProduction && authMode !== 'strict') {
    throw new Error(`Security violation: authMode "${authMode}" is strictly forbidden in production`);
  }

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

  const mcpAud = options.authConfig?.mcpAud
    || (options.authConfig?.webAud ? null : options.authConfig?.expectedAud)
    || process.env.TEACHER_SERVICE_CF_ACCESS_AUD
    || '';

  const webAud = options.authConfig?.webAud
    || (options.authConfig?.mcpAud ? null : options.authConfig?.expectedAud)
    || process.env.TEACHER_SERVICE_WEB_CF_ACCESS_AUD
    || '';

  const baseAuthConfig = {
    isProduction,
    allowSyntheticAuth: isProduction ? false : (options.authConfig?.allowSyntheticAuth ?? (process.env.NODE_ENV !== 'production')),
    expectedIss: options.authConfig?.expectedIss ?? process.env.TEACHER_SERVICE_CF_ACCESS_ISS,
    certsUrl: options.authConfig?.certsUrl,
    authMode,
    bearerToken: options.authConfig?.bearerToken || process.env.TEACHER_SERVICE_BEARER_TOKEN
  };

  const mcpAuthConfig = {
    ...baseAuthConfig,
    expectedAud: mcpAud
  };

  const webAuthConfig = {
    ...baseAuthConfig,
    expectedAud: webAud
  };

  const staticHandler = createStaticFileHandler({ rootDir: options.staticDir || path.resolve(process.cwd(), 'client') });

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

    // 2. Web UI Dashboard & Static Assets (SPA)
    if (pathname === '/' || pathname.startsWith('/client/') || (!pathname.startsWith('/api/') && !pathname.startsWith('/mcp') && pathname !== '/health')) {
      const handled = staticHandler(req, res, pathname);
      if (handled) return;
    }

    // 3. REST API endpoint (/api/*) — Strict authentication & authorization
    if (pathname.startsWith('/api/')) {
      // Origin check if present
      const originHeader = req.headers['origin'];
      if (originHeader && typeof originHeader === 'string') {
        let isOriginAllowed = configuredAllowedOrigins.includes(originHeader);
        if (!isOriginAllowed) {
          try {
            const parsed = new URL(originHeader);
            const reqHost = (req.headers['host'] || '').trim().toLowerCase();
            if (parsed.host.toLowerCase() === reqHost) {
              isOriginAllowed = true;
            }
          } catch {}
        }
        if (!isOriginAllowed) {
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

      // CSRF validation for non-safe methods (Dossier 01, Web security)
      const csrfCheck = validateCsrf(req, configuredAllowedOrigins);
      if (!csrfCheck.valid) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden', message: csrfCheck.error }));
        return;
      }

      // Authenticate request consistently
      const authResult = await authenticateRequest(req, webAuthConfig);
      if (!authResult.authenticated) {
        const sc = authResult.statusCode || 401;
        const errType = sc === 500 ? 'Internal Server Error' : (sc === 403 ? 'Forbidden' : 'Unauthorized');
        res.writeHead(sc, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errType, message: authResult.error || 'Authentication required for Teacher Service REST API' }));
        return;
      }

      let teacherGrant = false;
      try { teacherGrant = isTeacherGrant(await authorizeTeacher(authResult)); } catch { teacherGrant = false; }
      if (!teacherGrant) {
        if (pathname === '/api/auth/me' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            authenticated: true,
            principal: authResult.principal,
            user: authResult.user || null,
            teacherAuthorized: false,
            role: 'unauthorized'
          }));
          return;
        }
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Authenticated principal is not authorized as a teacher' }));
        return;
      }
      authResult.teacherAuthorized = true;

      let bodyBuffer = Buffer.alloc(0);
      let parsedBody = null;
      let multipartData = null;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
          bodyBuffer = await readRequestBody(req, MAX_PAYLOAD_BYTES);
          const ctype = req.headers['content-type'] || '';
          if (ctype.includes('multipart/form-data')) {
            multipartData = parseMultipartFormData(bodyBuffer, ctype);
          } else if (bodyBuffer.length > 0) {
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

      return handleRestApi(req, res, pathname, parsedUrl, service, authResult, parsedBody, multipartData);
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
      const authResult = await authenticateRequest(req, mcpAuthConfig);
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

async function handleRestApi(req, res, pathname, parsedUrl, service, authResult, parsedBody, multipartData) {
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
    // GET /api/auth/me
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        authenticated: true,
        principal: authResult.principal,
        user: authResult.user || null,
        teacherAuthorized: true,
        role: callerRole
      }));
      return;
    }

    // POST /api/classes
    if (pathname === '/api/classes' && req.method === 'POST') {
      const cls = service.createClass(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ class: cls }));
      return;
    }

    // POST /api/subjects
    if (pathname === '/api/subjects' && req.method === 'POST') {
      const sub = service.createSubject(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ subject: sub }));
      return;
    }

    // POST /api/lessons
    if (pathname === '/api/lessons' && req.method === 'POST') {
      const les = service.createLesson(parsedBody || {});
      res.writeHead(201);
      res.end(JSON.stringify({ lesson: les }));
      return;
    }

    // GET /api/lessons/:id/pack
    if (pathname.match(/^\/api\/lessons\/([^/]+)\/pack$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const pack = service.getLessonPack(id, { role: callerRole, includeTeacherSolutions: !isStudent });
      res.writeHead(200);
      res.end(JSON.stringify({ pack }));
      return;
    }

    // POST /api/lessons/:id/generate-pack
    if (pathname.match(/^\/api\/lessons\/([^/]+)\/generate-pack$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const pack = await service.generateLessonPack({
        lessonId: id,
        ...(parsedBody || {})
      });
      res.writeHead(200);
      res.end(JSON.stringify({ pack }));
      return;
    }

    // POST /api/lessons/:id/confirm-preparation
    if (pathname.match(/^\/api\/lessons\/([^/]+)\/confirm-preparation$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const confirmation = service.confirmLessonPreparation({
        lessonId: id,
        notes: parsedBody?.notes || '',
        actorId: authResult.principal
      });
      res.writeHead(200);
      res.end(JSON.stringify({ confirmation }));
      return;
    }

    // GET /api/lessons/:id
    if (pathname.match(/^\/api\/lessons\/([^/]+)$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const lesson = service.getLesson(id);
      res.writeHead(200);
      res.end(JSON.stringify({ lesson }));
      return;
    }

    // PUT /api/lessons/:id
    if (pathname.match(/^\/api\/lessons\/([^/]+)$/) && req.method === 'PUT') {
      const id = pathname.split('/')[3];
      const lesson = service.updateLesson(id, parsedBody || {});
      res.writeHead(200);
      res.end(JSON.stringify({ lesson }));
      return;
    }

    // POST /api/materials/upload
    if (pathname === '/api/materials/upload' && req.method === 'POST') {
      if (!multipartData || !multipartData.file) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'ValidationError', message: 'No file uploaded in multipart request' }));
        return;
      }
      const { file, fields } = multipartData;
      const result = await service.importFile({
        fileBuffer: file.buffer,
        filename: file.filename,
        title: fields.title || file.filename,
        classId: fields.classId || null,
        subjectId: fields.subjectId || null,
        lessonId: fields.lessonId || null,
        pedagogicalRole: fields.pedagogicalRole || 'support_material',
        tags: fields.tags ? fields.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      });
      res.writeHead(201);
      res.end(JSON.stringify(result));
      return;
    }

    // PUT /api/materials/:id
    if (pathname.match(/^\/api\/materials\/([^/]+)$/) && req.method === 'PUT') {
      const id = pathname.split('/')[3];
      const mat = service.updateMaterial(id, {
        ...(parsedBody || {}),
        updatedBy: authResult.principal
      });
      res.writeHead(200);
      res.end(JSON.stringify({ material: mat }));
      return;
    }

    // POST /api/materials/:id/revise
    if (pathname.match(/^\/api\/materials\/([^/]+)\/revise$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const result = await service.reviseMaterial({
        materialId: id,
        ...(parsedBody || {})
      });
      res.writeHead(200);
      res.end(JSON.stringify({ result }));
      return;
    }

    // POST /api/materials/:id/regenerate-section
    if (pathname.match(/^\/api\/materials\/([^/]+)\/regenerate-section$/) && req.method === 'POST') {
      const id = pathname.split('/')[3];
      const result = await service.regenerateSection({
        materialId: id,
        ...(parsedBody || {})
      });
      res.writeHead(200);
      res.end(JSON.stringify({ result }));
      return;
    }

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
    const statusCode = err.name === 'NotFoundError' ? 404 : (err.name === 'ValidationError' ? 400 : (err.name === 'ConflictError' ? 409 : 500));
    res.writeHead(statusCode);
    res.end(JSON.stringify({ error: err.name || 'Error', message: err.message }));
  }
}
